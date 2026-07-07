import { NextResponse } from 'next/server'
import { AppError } from './errors'
import { logger } from './logger'

// Re-export all error classes for backward compatibility
export {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
} from './errors'

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

export function successResponse<T>(
  data: T,
  meta: { statusCode?: number; message?: string } = {}
) {
  const statusCode = meta.statusCode || 200

  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        statusCode,
        timestamp: new Date().toISOString(),
        message: meta.message,
      },
    },
    { status: statusCode }
  )
}

export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  },
  meta: { statusCode?: number } = {}
) {
  const statusCode = meta.statusCode || 200

  return NextResponse.json(
    {
      success: true,
      data,
      pagination,
      meta: {
        statusCode,
        timestamp: new Date().toISOString(),
      },
    },
    { status: statusCode }
  )
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
        meta: {
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
        },
      },
      { status: error.statusCode }
    )
  }

  if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any
    let message = 'Database error'
    let statusCode = 400

    if (prismaError.code === 'P2002') {
      message = `Unique constraint violation on ${prismaError.meta?.target?.join(', ')}`
    } else if (prismaError.code === 'P2025') {
      message = 'Record not found'
      statusCode = 404
    } else if (prismaError.code === 'P2003') {
      message = 'Foreign key constraint violation'
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message,
        },
        meta: {
          statusCode,
          timestamp: new Date().toISOString(),
        },
      },
      { status: statusCode }
    )
  }

  logger.error({ err: error }, 'Unhandled error in API route')

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
      meta: {
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    },
    { status: 500 }
  )
}

// ============================================================================
// WRAPPER FOR API ROUTES
// ============================================================================

export function withErrorHandler<Args extends unknown[]>(
  handler: (req: Request, ...args: Args) => Promise<NextResponse>
) {
  return async (req: Request, ...args: Args) => {
    const start = Date.now()
    try {
      const res = await handler(req, ...args)
      const duration = Date.now() - start
      logger.info(
        { method: req.method, url: req.url, status: res.status, duration },
        'API request'
      )
      return res
    } catch (error) {
      const duration = Date.now() - start
      logger.error(
        { method: req.method, url: req.url, duration, err: error },
        'API request failed'
      )
      return errorResponse(error)
    }
  }
}

// ============================================================================
// PAGINATION UTILITIES
// ============================================================================

export function getPaginationParams(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  maxLimit = 100
) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit))),
    maxLimit
  )

  const skip = (page - 1) * limit

  return { page, limit, skip }
}

export async function getTotal(query: Promise<any>) {
  try {
    return await query
  } catch {
    return 0
  }
}
