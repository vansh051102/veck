import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler, UnauthorizedError } from '@/lib/api-response'
import { TERMINAL_STAGES } from '@/lib/lead-stages'
import { secureEqual } from '@/lib/secure-compare'
import { sendSLABreachEmail, sendSLAWarningEmail } from '@/lib/sla-email'

export const GET = withErrorHandler(async (req: Request) => {
  const secret = process.env.CRON_SECRET
  if (!secret || !secureEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    throw new UnauthorizedError('Invalid cron secret')
  }

  const now = new Date()

  // Mark breached leads (legacy Lead.slaBreached field)
  const result = await prisma.lead.updateMany({
    where: {
      slaBreached: false,
      slaDeadline: { lt: now },
      stage: { notIn: [...TERMINAL_STAGES] },
    },
    data: { slaBreached: true },
  })

  // Find pending SLA clocks that haven't been notified yet
  const pendingClocks = await prisma.slaClock.findMany({
    where: {
      status: 'pending',
      targetMinutes: { not: null },
    },
    include: { rule: true },
  })

  // Detect breaches and warnings
  let emailsSent = 0
  let warningsSent = 0

  for (const clock of pendingClocks) {
    const timeElapsed = clock.elapsedBusinessMinutes || 0
    const target = clock.targetMinutes || 0
    const percentUsed = (timeElapsed / target) * 100
    const isBreached = clock.deadline && clock.deadline < now

    // Fetch lead first
    const lead = await prisma.lead.findUnique({ where: { id: clock.entityId } })
    if (!lead) {
      console.warn(`[SLA] Lead not found: ${clock.entityId}`)
      continue
    }

    // Then fetch assigned user and escalee
    const [assignedUser, escaleeUser] = await Promise.all([
      lead.assignedToId
        ? prisma.user.findUnique({
            where: { id: lead.assignedToId },
            select: { id: true, fullName: true, email: true },
          })
        : Promise.resolve(null),
      clock.rule?.escalateToRoleId
        ? prisma.user.findFirst({
            where: { role: clock.rule.escalateToRoleId },
            select: { id: true, fullName: true, email: true },
          })
        : Promise.resolve(null),
    ])

    // HANDLE BREACH (100%+ of target reached)
    if (isBreached && !clock.notificationSentAt) {
      const breachedByMinutes = Math.max(0, timeElapsed - target)

      // Claim the clock before sending. `pendingClocks` was read at the top of
      // the run, so two overlapping invocations both see notificationSentAt as
      // null and would both email. This conditional update is atomic in
      // Postgres: exactly one runner matches and gets count 1, the loser gets 0
      // and moves on. Cheaper than a global lock, and runs stay parallel.
      const claimed = await prisma.slaClock.updateMany({
        where: { id: clock.id, notificationSentAt: null, status: 'pending' },
        data: { notificationSentAt: now, status: 'breached', escalatedAt: now },
      })
      if (claimed.count === 0) continue

      // Only send to escalee if configured, otherwise to assigned user
      const notifyUser = escaleeUser || assignedUser
      if (notifyUser?.email) {
        const emailResult = await sendSLABreachEmail({
          orgId: clock.orgId,
          slaClockId: clock.id,
          leadId: clock.entityId,
          leadName: lead?.companyName || 'Unknown Lead',
          assignedToId: assignedUser?.id || '',
          assignedToName: assignedUser?.fullName || 'Unknown',
          managerEmail: notifyUser.email,
          department: clock.rule?.department || null,
          stage: clock.stage,
          targetMinutes: target,
          elapsedBusinessMinutes: timeElapsed,
          breachedByMinutes,
          slaRuleName: clock.rule?.id,
        })

        if (emailResult.success) {
          emailsSent++
        } else {
          // The claim above already recorded the breach; a failed send is not
          // retried on purpose, so a broken mailbox can't re-alert every run.
          console.warn(`[SLA] Email send failed for clock ${clock.id}: ${emailResult.reason}`)
        }
      } else {
        console.log(`[SLA] Breach marked but no email sent (no manager email): ${clock.id}`)
      }
    }
    // HANDLE WARNING (80%+ but not breached yet)
    else if (!isBreached && percentUsed >= 80 && !clock.warnedAt && assignedUser?.email) {
      // Same claim-before-send guard as the breach path above.
      const claimedWarning = await prisma.slaClock.updateMany({
        where: { id: clock.id, warnedAt: null },
        data: { warnedAt: now },
      })
      if (claimedWarning.count === 0) continue

      const emailResult = await sendSLAWarningEmail({
        orgId: clock.orgId,
        slaClockId: clock.id,
        leadId: clock.entityId,
        leadName: lead?.companyName || 'Unknown Lead',
        assignedToId: assignedUser.id,
        assignedToName: assignedUser.fullName || 'Unknown',
        managerEmail: assignedUser.email,
        department: clock.rule?.department || null,
        stage: clock.stage,
        targetMinutes: target,
        elapsedBusinessMinutes: timeElapsed,
        breachedByMinutes: 0,
        percentUsed,
        slaRuleName: clock.rule?.id,
      })

      if (emailResult.success) {
        warningsSent++
      } else {
        // Unlike a breach, a warning stays worth retrying — release the claim so
        // the next run can try again after a transient mail failure.
        await prisma.slaClock.updateMany({
          where: { id: clock.id },
          data: { warnedAt: null },
        })
        console.warn(`[SLA] Warning email send failed for clock ${clock.id}: ${emailResult.reason}`)
      }
    }
  }

  return successResponse({
    checkedAt: now.toISOString(),
    newlyBreached: result.count,
    clocksProcessed: pendingClocks.length,
    emailsSent,
    warningsSent,
  })
})
