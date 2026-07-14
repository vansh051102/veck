import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'

interface BreachTrend {
  date: string
  breachCount: number
  totalCount: number
  breachRate: number
  department: string | null
}

export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)

  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '7')
  const department = url.searchParams.get('department')

  // Get breach data for the last N days
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const clocks = await prisma.slaClock.findMany({
    where: {
      orgId: ctx.orgId,
      createdAt: { gte: startDate },
    },
    include: {
      rule: true,
    },
  })

  // Group by date and department
  const trends: BreachTrend[] = []
  const groupedByDate = new Map<string, typeof clocks>()

  clocks.forEach((clock) => {
    const date = clock.createdAt.toISOString().split('T')[0]
    if (!groupedByDate.has(date)) groupedByDate.set(date, [])
    groupedByDate.get(date)!.push(clock)
  })

  // Calculate trends
  Array.from(groupedByDate.entries()).forEach(([date, dayClock]) => {
    const filtered = !department ? dayClock : dayClock.filter((c) => c.rule?.department === department)
    const breached = filtered.filter((c) => c.status === 'breached').length

    if (filtered.length > 0) {
      trends.push({
        date,
        breachCount: breached,
        totalCount: filtered.length,
        breachRate: (breached / filtered.length) * 100,
        department: department || 'all',
      })
    }
  })

  return successResponse(trends.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
})
