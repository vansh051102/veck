/**
 * Integration test — requires a real Postgres. Skipped unless TEST_DATABASE_URL
 * is set, so `npx jest` stays green on a machine with no database.
 *
 * The cron jobs in app/api/v1/cron/{sla-check,follow-up-nudges} guard against
 * overlapping runs by *claiming* each row with a conditional updateMany before
 * acting on it. The whole guarantee is that Postgres applies `UPDATE ... WHERE`
 * atomically: of N racing updates against one row, exactly one sees the row in
 * its pre-claim state and reports count 1. A mocked Prisma client returns
 * whatever it is told to, so it cannot demonstrate that — this can only be
 * proved against a real server.
 */
import { PrismaClient } from '@prisma/client'

const TEST_DB = process.env.TEST_DATABASE_URL
const describeIfDb = TEST_DB ? describe : describe.skip

describeIfDb('cron claim guards are atomic under concurrency', () => {
  // Constructed in beforeAll, not at describe scope: Jest still evaluates the
  // body of a skipped describe to build the test tree, and PrismaClient throws
  // when handed an undefined url.
  let prisma: PrismaClient
  const stamp = Date.now()
  let orgId: string
  let leadId: string

  // Activity.leadId and Lead.createdById are real foreign keys, so the seed has
  // to walk the whole chain: Organization -> User -> Contact -> Lead.
  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DB as string } } })

    const org = await prisma.organization.create({
      data: { name: 'Concurrency Test Org', slug: `concurrency-test-${stamp}` },
    })
    orgId = org.id

    const user = await prisma.user.create({
      data: { orgId, email: `concurrency-${stamp}@test.local`, fullName: 'Concurrency Test User' },
    })

    const contact = await prisma.contact.create({
      data: {
        orgId,
        firstName: 'Concurrency',
        lastName: 'Test',
        email: `contact-${stamp}@test.local`,
        phone: '0000000000',
        source: 'test',
        createdById: user.id,
      },
    })

    const lead = await prisma.lead.create({
      data: {
        orgId,
        contactId: contact.id,
        companyName: 'Concurrency Test Co',
        slaDeadline: new Date(Date.now() + 3_600_000),
        createdById: user.id,
      },
    })
    leadId = lead.id
  })

  afterAll(async () => {
    if (!prisma) return
    // Everything seeded above cascades from Organization.
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('lets exactly one racer claim an unnotified SLA clock', async () => {
    const clock = await prisma.slaClock.create({
      data: {
        orgId,
        entityType: 'Lead',
        entityId: 'lead-under-test',
        stage: 'New Lead',
        trigger: 'stage_entered',
        targetMinutes: 60,
        status: 'pending',
      },
    })

    const now = new Date()
    // Ten runners fire the exact claim from sla-check/route.ts simultaneously.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        prisma.slaClock.updateMany({
          where: { id: clock.id, notificationSentAt: null, status: 'pending' },
          data: { notificationSentAt: now, status: 'breached', escalatedAt: now },
        })
      )
    )

    const winners = results.filter((r) => r.count === 1)
    expect(winners).toHaveLength(1)
    expect(results.filter((r) => r.count === 0)).toHaveLength(9)

    // The losers must not have moved the row a second time.
    const after = await prisma.slaClock.findUniqueOrThrow({ where: { id: clock.id } })
    expect(after.status).toBe('breached')
    expect(after.notificationSentAt).not.toBeNull()
  })

  it('lets exactly one racer claim a warning via warnedAt', async () => {
    const clock = await prisma.slaClock.create({
      data: {
        orgId,
        entityType: 'Lead',
        entityId: 'lead-warning',
        stage: 'Contacted',
        trigger: 'stage_entered',
        targetMinutes: 1440,
        status: 'pending',
      },
    })

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        prisma.slaClock.updateMany({
          where: { id: clock.id, warnedAt: null },
          data: { warnedAt: new Date() },
        })
      )
    )

    expect(results.filter((r) => r.count === 1)).toHaveLength(1)
  })

  it('releasing a warning claim makes it claimable again (failed-email retry)', async () => {
    const clock = await prisma.slaClock.create({
      data: {
        orgId,
        entityType: 'Lead',
        entityId: 'lead-retry',
        stage: 'Contacted',
        trigger: 'stage_entered',
        targetMinutes: 1440,
        status: 'pending',
      },
    })

    const first = await prisma.slaClock.updateMany({
      where: { id: clock.id, warnedAt: null },
      data: { warnedAt: new Date() },
    })
    expect(first.count).toBe(1)

    // sla-check releases the claim when the warning email fails to send.
    await prisma.slaClock.updateMany({ where: { id: clock.id }, data: { warnedAt: null } })

    const second = await prisma.slaClock.updateMany({
      where: { id: clock.id, warnedAt: null },
      data: { warnedAt: new Date() },
    })
    expect(second.count).toBe(1)
  })

  it('lets exactly one racer claim a follow-up task via the metadata JSON path', async () => {
    // Also proves the `NOT: { metadata: { path: [...] } }` filter used by
    // follow-up-nudges is valid against a real server, not just the type checker.
    const task = await prisma.activity.create({
      data: {
        orgId,
        leadId,
        type: 'task',
        status: 'pending',
        title: 'Daily follow-up (day 1 of 6)',
        scheduledFor: new Date(Date.now() - 60_000),
        metadata: {},
        createdBy: 'system',
      },
    })

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        prisma.activity.updateMany({
          where: {
            id: task.id,
            status: 'pending',
            NOT: { metadata: { path: ['nudged'], equals: true } },
          },
          data: { metadata: { nudged: true } },
        })
      )
    )

    expect(results.filter((r) => r.count === 1)).toHaveLength(1)

    // A subsequent run must find nothing left to claim.
    const rerun = await prisma.activity.updateMany({
      where: {
        id: task.id,
        status: 'pending',
        NOT: { metadata: { path: ['nudged'], equals: true } },
      },
      data: { metadata: { nudged: true } },
    })
    expect(rerun.count).toBe(0)
  })
})
