import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'

interface SLABreach {
  leadId: string
  leadName: string
  assignedToUserId: string
  assignedToName: string
  department: string | null
  stage: string
  slaRule: string | null
  targetMinutes: number | null
  elapsedBusinessMinutes: number | null
  deadline: string | null
  status: string
  breachedByMinutes: number | null
  lastUpdated: string
}

export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const department = url.searchParams.get('department')

  const clocks = await prisma.slaClock.findMany({
    where: {
      orgId: ctx.orgId,
      status: { in: ['breached', 'overdue'] },
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    },
    include: {
      rule: true,
    },
  })

  // Fetch lead details and user info for each clock
  const breaches: SLABreach[] = await Promise.all(
    clocks.map(async (clock) => {
      if (clock.entityType !== 'Lead') return null

      const lead = await prisma.lead.findUnique({
        where: { id: clock.entityId },
        include: { assignedTo: true },
      })

      if (!lead) return null

      // Filter by department if specified
      if (department && lead.department !== department) return null

      const elapsedMinutes = clock.elapsedBusinessMinutes || 0
      const targetMinutes = clock.targetMinutes || 0
      const breachedByMinutes = targetMinutes > 0 ? Math.max(0, elapsedMinutes - targetMinutes) : null

      return {
        leadId: lead.id,
        leadName: lead.name,
        assignedToUserId: lead.assignedToId,
        assignedToName: lead.assignedTo?.name || 'Unassigned',
        department: lead.department,
        stage: clock.stage,
        slaRule: clock.rule?.id || null,
        targetMinutes: clock.targetMinutes,
        elapsedBusinessMinutes: clock.elapsedBusinessMinutes,
        deadline: clock.deadline?.toISOString() || null,
        status: clock.status,
        breachedByMinutes,
        lastUpdated: clock.updatedAt.toISOString(),
      }
    })
  )

  const filtered = breaches.filter(Boolean) as SLABreach[]
  return successResponse(filtered)
})
