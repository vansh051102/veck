import { NextResponse } from 'next/server'

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', 400, message, details)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', 403, message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource} not found`)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', 409, message)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super('RATE_LIMIT_EXCEEDED', 429, message)
    this.name = 'RateLimitError'
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super('INTERNAL_SERVER_ERROR', 500, message)
    this.name = 'InternalServerError'
  }
}

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

  // Handle Prisma errors
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

  // Unexpected error
  console.error('Unexpected error:', error)

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
    try {
      return await handler(req, ...args)
    } catch (error) {
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

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateOrgId(orgId: string | null | undefined): orgId is string {
  return typeof orgId === 'string' && orgId.length > 0
}

export function validateUserId(userId: string | null | undefined): userId is string {
  return typeof userId === 'string' && userId.length > 0
}

export function extractOrgAndUserIds(
  headers: Headers
): { orgId: string; userId: string } | null {
  const orgId = headers.get('x-org-id')
  const userId = headers.get('x-user-id')

  if (!orgId || !userId) return null

  return { orgId, userId }
}

export function extractUserRole(headers: Headers): string | null {
  return headers.get('x-user-role')
}
