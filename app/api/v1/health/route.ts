import { healthCheck } from '@/lib/db'
import { successResponse, errorResponse, withErrorHandler } from '@/lib/api-response'

export const GET = withErrorHandler(async (req) => {
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
      status: 'unhealthy',
      ...health,
    },
    { statusCode: 503 }
  )
})
