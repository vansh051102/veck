import { AppError } from '@/lib/errors'
import { createChildLogger } from '@/lib/logger'

const log = createChildLogger('erp-action')

// Server Actions can't use withErrorHandler (that returns a NextResponse). This
// is its analogue: it maps thrown AppErrors to a plain, serializable result the
// client can branch on, and swallows unexpected errors to a generic message
// (never leak internals across the action boundary).
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

export function withAction<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>
): (...args: A) => Promise<ActionResult<T>> {
  return async (...args: A) => {
    try {
      return { success: true, data: await fn(...args) }
    } catch (error) {
      if (error instanceof AppError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
          },
        }
      }
      log.error({ err: error }, 'Unhandled error in ERP server action')
      return {
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
      }
    }
  }
}
