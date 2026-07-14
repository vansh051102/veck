import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'

interface KRAPerformance {
  scopeType: string
  scopeId: string
  scopeName: string
  metric: string
  period: string
  value: number
  target: number | null
  status: string
}

export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)

  const url = new URL(req.url)
  const scope = url.searchParams.get('scope') || 'user'
  const scopeId = url.searchParams.get('scopeId')
  const metric = url.searchParams.get('metric')
  const period = url.searchParams.get('period') || 'day'

  // Default to today if no period specified
  const today = new Date().toISOString().split('T')[0]

  const snapshots = await prisma.kpiSnapshot.findMany({
    where: {
      orgId: ctx.orgId,
      scopeType: scope,
      ...(scopeId ? { scopeId } : {}),
      ...(metric ? { metric } : {}),
      bucket: period === 'day' ? today : undefined,
    },
  })

  // Fetch scope names (user names, etc)
  const performance: KRAPerformance[] = await Promise.all(
    snapshots.map(async (snapshot) => {
      let scopeName = snapshot.scopeId
      if (snapshot.scopeType === 'user') {
        const user = await prisma.user.findUnique({
          where: { id: snapshot.scopeId },
        })
        scopeName = user?.fullName || snapshot.scopeId
      }

      return {
        scopeType: snapshot.scopeType,
        scopeId: snapshot.scopeId,
        scopeName,
        metric: snapshot.metric,
        period: snapshot.bucket,
        value: Number(snapshot.value),
        target: null, // Targets not yet configured in Phase 1
        status: 'collecting',
      }
    })
  )

  return successResponse(performance)
})
