/**
 * Seed demo contacts + leads for the admin@veck.local workspace.
 * Run: npx tsx scripts/seed-mock-leads.ts
 */
import { PrismaClient } from '@prisma/client'
import { createSopChecklistsForStage } from '../lib/sop-checklists'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'admin@veck.local'

type SeedLead = {
  company: string
  firstName: string
  lastName: string
  email: string
  phone: string
  stage: string
  priority: string
  source: string
  requirement: string
  contactOutcome?: string | null
  assigned?: boolean
  status?: string
  dealLostReason?: string
  quotationNumber?: string
  productCategory?: string
  quotationValue?: number
  supplierMargin?: number
  slaBreached?: boolean
  daysAgo: number
}

const SEEDS: SeedLead[] = [
  {
    company: 'Bangalore Fabricators Pvt Ltd',
    firstName: 'Ravi',
    lastName: 'Shetty',
    email: 'ravi.shetty@bfpl.demo',
    phone: '+919800100101',
    stage: 'New Lead',
    priority: 'Urgent',
    source: 'IndiaMART',
    requirement: 'MS ERW pipes 40NB × 3.2mm — 12 MT for shed fabrication',
    assigned: false,
    daysAgo: 0,
  },
  {
    company: 'Hosur Industrial Supplies',
    firstName: 'Priya',
    lastName: 'Nair',
    email: 'priya.nair@his.demo',
    phone: '+919800100102',
    stage: 'New Lead',
    priority: 'High',
    source: 'WhatsApp',
    requirement: 'GI pipes medium class — 200 lengths for site stock',
    assigned: true,
    daysAgo: 1,
  },
  {
    company: 'Ashoka Borewell Works',
    firstName: 'Suresh',
    lastName: 'Gowda',
    email: 'suresh@mbw.demo',
    phone: '+919800100103',
    stage: 'Contacted',
    priority: 'High',
    source: 'Phone',
    requirement: 'Casing pipes 6" & 8" — urgent borewell project',
    contactOutcome: 'connected',
    assigned: true,
    daysAgo: 2,
  },
  {
    company: 'Whitefield Builders',
    firstName: 'Ananya',
    lastName: 'Rao',
    email: 'ananya.rao@wb.demo',
    phone: '+919800100104',
    stage: 'Contacted',
    priority: 'Medium',
    source: 'Website',
    requirement: 'Square tubes 40×40×2mm — apartment railing job',
    contactOutcome: 'not_received',
    assigned: true,
    daysAgo: 3,
  },
  {
    company: 'Peenya Engineering Co',
    firstName: 'Karthik',
    lastName: 'Menon',
    email: 'karthik@pec.demo',
    phone: '+919800100105',
    stage: 'Contacted',
    priority: 'Urgent',
    source: 'Referral',
    requirement: 'MS plates 8mm & 10mm — laser cutting ready stock',
    contactOutcome: 'connected',
    assigned: true,
    daysAgo: 1,
    slaBreached: true,
  },
  {
    company: 'Chennai Tube Traders',
    firstName: 'Vignesh',
    lastName: 'Iyer',
    email: 'vignesh@ctt.demo',
    phone: '+919800100106',
    stage: 'Qualified',
    priority: 'High',
    source: 'IndiaMART',
    requirement: 'ERW pipes 25NB–80NB mixed — 25 MT monthly offtake',
    contactOutcome: 'connected',
    assigned: true,
    daysAgo: 4,
  },
  {
    company: 'Mysore Steel Structures',
    firstName: 'Deepa',
    lastName: 'Krishna',
    email: 'deepa@mss.demo',
    phone: '+919800100107',
    stage: 'Qualified',
    priority: 'Medium',
    source: 'Email',
    requirement: 'Hollow sections 50×50 & 75×75 — warehouse frame',
    contactOutcome: 'connected',
    assigned: true,
    daysAgo: 5,
  },
  {
    company: 'Kolar Agro Implements',
    firstName: 'Manjunath',
    lastName: 'Patil',
    email: 'manju@kai.demo',
    phone: '+919800100108',
    stage: 'Quote Sent',
    priority: 'High',
    source: 'Phone',
    requirement: 'GI pipes heavy class — 8 MT with cutting',
    contactOutcome: 'connected',
    assigned: true,
    daysAgo: 6,
    quotationNumber: 'QT-2026-0142',
    productCategory: 'GI Pipes',
    quotationValue: 485000,
    supplierMargin: 12.5,
  },
  {
    company: 'Electronic City MEP',
    firstName: 'Farhan',
    lastName: 'Ahmed',
    email: 'farhan@ecmep.demo',
    phone: '+919800100109',
    stage: 'Quote Sent',
    priority: 'Urgent',
    source: 'WhatsApp',
    requirement: 'MS pipes + fittings package for HVAC supports',
    contactOutcome: 'connected',
    assigned: true,
    daysAgo: 2,
    quotationNumber: 'QT-2026-0158',
    productCategory: 'MS Pipes',
    quotationValue: 920000,
    supplierMargin: 14,
    slaBreached: true,
  },
  {
    company: 'Tumkur Metal Mart',
    firstName: 'Lakshmi',
    lastName: 'Prasad',
    email: 'lakshmi@tmm.demo',
    phone: '+919800100110',
    stage: 'Order Confirmed',
    priority: 'High',
    source: 'Referral',
    requirement: 'Confirmed PO: ERW 40NB × 200 lengths + transport',
    contactOutcome: 'connected',
    assigned: true,
    status: 'closed_won',
    daysAgo: 8,
    quotationNumber: 'QT-2026-0110',
    productCategory: 'ERW Pipes',
    quotationValue: 312000,
    supplierMargin: 11,
  },
  {
    company: 'Nandi Constructions',
    firstName: 'Arjun',
    lastName: 'Reddy',
    email: 'arjun@nandi.demo',
    phone: '+919800100111',
    stage: 'Order Confirmed',
    priority: 'Medium',
    source: 'Website',
    requirement: 'Order confirmed — square tubes for site phase 2',
    contactOutcome: 'connected',
    assigned: true,
    status: 'closed_won',
    daysAgo: 12,
    quotationNumber: 'QT-2026-0098',
    productCategory: 'Hollow Sections',
    quotationValue: 678000,
    supplierMargin: 13,
  },
  {
    company: 'Bellary Rolling Mills',
    firstName: 'Imran',
    lastName: 'Khan',
    email: 'imran@brm.demo',
    phone: '+919800100112',
    stage: 'Order Closed',
    priority: 'Medium',
    source: 'IndiaMART',
    requirement: 'Delivered & closed — MS plates 6mm / 4 MT',
    contactOutcome: 'connected',
    assigned: true,
    status: 'closed_won',
    daysAgo: 20,
    quotationNumber: 'QT-2026-0071',
    productCategory: 'MS Plates',
    quotationValue: 245000,
    supplierMargin: 10,
  },
  {
    company: 'Coimbatore Gate Works',
    firstName: 'Selvi',
    lastName: 'Murugan',
    email: 'selvi@cgw.demo',
    phone: '+919800100113',
    stage: 'Deal Lost',
    priority: 'Low',
    source: 'Phone',
    requirement: 'Gate fabrication tubes — lost on price',
    contactOutcome: 'connected',
    assigned: true,
    status: 'closed_lost',
    dealLostReason: 'Price Not Accepted',
    daysAgo: 15,
    quotationNumber: 'QT-2026-0088',
    productCategory: 'Square Tubes',
    quotationValue: 156000,
    supplierMargin: 9,
  },
  {
    company: 'Rate Shopper Traders',
    firstName: 'Unknown',
    lastName: 'Caller',
    email: 'rates@shopper.demo',
    phone: '+919800100114',
    stage: 'Disqualified',
    priority: 'Low',
    source: 'IndiaMART',
    requirement: 'Only asking rates — no genuine requirement',
    contactOutcome: 'connected',
    assigned: true,
    status: 'disqualified',
    dealLostReason: 'Non-Genuine / Rate Enquiry',
    daysAgo: 7,
  },
  {
    company: 'Out of Area Fabricator',
    firstName: 'Rahul',
    lastName: 'Verma',
    email: 'rahul@oaf.demo',
    phone: '+919800100115',
    stage: 'Disqualified',
    priority: 'Medium',
    source: 'WhatsApp',
    requirement: 'Delivery to Guwahati — not serviceable',
    contactOutcome: 'not_received',
    assigned: false,
    status: 'disqualified',
    dealLostReason: 'Location Not Serviceable',
    daysAgo: 9,
  },
]

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, orgId: true, fullName: true },
  })
  if (!admin) {
    throw new Error(`Admin user ${ADMIN_EMAIL} not found. Create the account first.`)
  }

  console.log(`Seeding for ${admin.fullName} / org ${admin.orgId}`)

  let created = 0
  for (const seed of SEEDS) {
    const existingContact = await prisma.contact.findFirst({
      where: { orgId: admin.orgId, OR: [{ email: seed.email }, { phone: seed.phone }] },
    })
    if (existingContact) {
      console.log(`skip (exists): ${seed.company}`)
      continue
    }

    const createdAt = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000)
    const slaHours =
      seed.stage === 'New Lead'
        ? 1
        : seed.stage === 'Contacted'
          ? 24
          : seed.stage === 'Qualified'
            ? 3
            : seed.stage === 'Quote Sent'
              ? 144
              : seed.stage === 'Order Confirmed'
                ? 72
                : 24
    const slaDeadline = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000)
    const isTerminal = ['Order Closed', 'Deal Lost', 'Disqualified'].includes(seed.stage)

    await prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          orgId: admin.orgId,
          firstName: seed.firstName,
          lastName: seed.lastName,
          email: seed.email,
          phone: seed.phone,
          source: seed.source,
          createdById: admin.id,
          createdAt,
          updatedAt: createdAt,
        },
      })

      const lead = await tx.lead.create({
        data: {
          orgId: admin.orgId,
          contactId: contact.id,
          companyName: seed.company,
          stage: seed.stage,
          stageChangedAt: createdAt,
          stageChangedBy: admin.id,
          contactOutcome: seed.contactOutcome ?? null,
          priority: seed.priority,
          status: seed.status ?? 'open',
          dealLostReason: seed.dealLostReason ?? null,
          dealLostDate: seed.dealLostReason ? createdAt : null,
          requirement: seed.requirement,
          source: seed.source,
          notes: `Demo seed — ${seed.stage}`,
          tags: ['demo', seed.stage.toLowerCase().replace(/\s+/g, '-')],
          assignedToId: seed.assigned === false ? null : admin.id,
          assignedAt: seed.assigned === false ? null : createdAt,
          supplierMargin: seed.supplierMargin ?? null,
          quotationNumber: seed.quotationNumber ?? null,
          productCategory: seed.productCategory ?? null,
          quotationValue: seed.quotationValue ?? null,
          slaCreatedAt: createdAt,
          slaDeadline: isTerminal
            ? new Date(createdAt.getTime() + 365 * 24 * 60 * 60 * 1000)
            : slaDeadline,
          slaBreached: Boolean(seed.slaBreached),
          lastActivityAt: createdAt,
          createdAt,
          updatedAt: createdAt,
          createdById: admin.id,
        },
      })

      await createSopChecklistsForStage(tx, lead.id, seed.stage, 'admin')

      // DB may still have legacy Timeline.orgId NOT NULL — set via raw SQL if needed
      await tx.$executeRawUnsafe(
        `INSERT INTO "Timeline" ("id","leadId","orgId","createdAt","updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $3)
         ON CONFLICT ("leadId") DO NOTHING`,
        lead.id,
        admin.orgId,
        createdAt
      )
      const timeline = await tx.timeline.findUnique({ where: { leadId: lead.id } })
      if (timeline) {
        await tx.timelineEvent.create({
          data: {
            timelineId: timeline.id,
            type: 'lead_created',
            title: 'Lead created (demo seed)',
            description: `${seed.company} — ${seed.stage}`,
            createdBy: admin.id,
            createdAt,
          },
        })
      }
    })

    created++
    console.log(`+ ${seed.stage.padEnd(16)} ${seed.company}`)
  }

  console.log(`Done. Created ${created} leads.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
