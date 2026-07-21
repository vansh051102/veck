jest.mock('@/lib/logger', () => {
  const stub = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }
  // api-response.ts imports createChildLogger as well as logger; omitting it
  // made the module throw "createChildLogger is not a function" on import.
  return { logger: stub, createChildLogger: () => stub }
})

import { successResponse, errorResponse, paginatedResponse, getPaginationParams, withErrorHandler } from '../api-response'
import { ValidationError, UnauthorizedError, NotFoundError, ConflictError } from '../errors'
import { logger } from '../logger'

const mockedLogger = logger as unknown as { error: jest.Mock; info: jest.Mock }

describe('successResponse', () => {
  it('returns a 200 JSON envelope with success: true and data', async () => {
    const res = await successResponse({ id: '1', name: 'test' }).json()
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ id: '1', name: 'test' })
    expect(res.meta.statusCode).toBe(200)
    expect(res.meta.timestamp).toBeDefined()
  })

  it('uses a custom status code when provided', async () => {
    const res = successResponse(null, { statusCode: 201 })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.meta.statusCode).toBe(201)
  })

  it('includes an optional message in meta', async () => {
    const res = await successResponse({}, { message: 'Created' }).json()
    expect(res.meta.message).toBe('Created')
  })
})

describe('paginatedResponse', () => {
  it('returns pagination metadata alongside data', async () => {
    const res = await paginatedResponse(
      [{ id: 1 }],
      { page: 2, limit: 10, total: 25, totalPages: 3 }
    ).json()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([{ id: 1 }])
    expect(res.pagination).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 })
    expect(res.meta.statusCode).toBe(200)
  })
})

describe('errorResponse', () => {
  it('returns 400 for ValidationError', async () => {
    const res = errorResponse(new ValidationError('Invalid input'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('Invalid input')
  })

  it('includes ValidationError details when present', async () => {
    const res = await errorResponse(new ValidationError('Bad', { field: 'email' })).json()
    expect(res.error.details).toEqual({ field: 'email' })
  })

  it('returns 401 for UnauthorizedError', async () => {
    const res = errorResponse(new UnauthorizedError())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 for NotFoundError', async () => {
    const res = errorResponse(new NotFoundError('Lead'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('Lead not found')
  })

  it('returns 409 for ConflictError', async () => {
    const res = errorResponse(new ConflictError('Duplicate'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('returns 500 for unknown errors', async () => {
    mockedLogger.error.mockClear()
    const res = errorResponse(new Error('something broke'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    expect(mockedLogger.error).toHaveBeenCalled()
  })

  it('maps P2002 prisma error to 400 with constraint info', async () => {
    const prismaErr = new Error('Unique constraint')
    prismaErr.name = 'PrismaClientKnownRequestError'
    ;(prismaErr as any).code = 'P2002'
    ;(prismaErr as any).meta = { target: ['email'] }
    const res = errorResponse(prismaErr)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('DATABASE_ERROR')
    expect(body.error.message).toContain('email')
  })

  it('maps P2025 prisma error to 404', async () => {
    const prismaErr = new Error('Not found')
    prismaErr.name = 'PrismaClientKnownRequestError'
    ;(prismaErr as any).code = 'P2025'
    const res = errorResponse(prismaErr)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.message).toBe('Record not found')
  })
})

describe('getPaginationParams', () => {
  it('defaults to page 1, limit 20', () => {
    const params = getPaginationParams(new URLSearchParams())
    expect(params).toEqual({ page: 1, limit: 20, skip: 0 })
  })

  it('parses page and limit from query string', () => {
    const params = getPaginationParams(new URLSearchParams('page=3&limit=15'))
    expect(params).toEqual({ page: 3, limit: 15, skip: 30 })
  })

  it('caps limit at 100', () => {
    const params = getPaginationParams(new URLSearchParams('limit=500'))
    expect(params.limit).toBe(100)
  })

  it('floor page at 1', () => {
    const params = getPaginationParams(new URLSearchParams('page=0'))
    expect(params.page).toBe(1)
  })
})

describe('withErrorHandler', () => {
  it('returns the handler response on success', async () => {
    const handler = withErrorHandler(async () => new Response('ok', { status: 200 }) as any)
    const res = await handler(new Request('http://localhost/api/test'))
    expect(res.status).toBe(200)
  })

  it('catches errors and returns error response', async () => {
    mockedLogger.error.mockClear()
    const handler = withErrorHandler(async () => { throw new NotFoundError('Lead') })
    const res = await handler(new Request('http://localhost/api/test'))
    expect(res.status).toBe(404)
  })
})