import { healthCheck } from '@/lib/db'
import { successResponse, withErrorHandler } from '@/lib/api-response'

export const GET = withErrorHandler(async () => {
  const health = await healthCheck()

  if (health.status === 'ok') {
    return successResponse({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  }

  return successResponse(
    {
      ...health,
      status: 'unhealthy',
    },
    { statusCode: 503 }
  )
})
