import { signUp } from '@/lib/auth'
import { SignUpSchema } from '@/lib/validation'
import {
  successResponse,
  withErrorHandler,
  ValidationError,
  ConflictError,
} from '@/lib/api-response'
import { authLimiter, rateLimitResponse } from '@/lib/rate-limit'

export const POST = withErrorHandler(async (req) => {
  const { allowed, retryAfter } = authLimiter.check(req)
  if (!allowed) return rateLimitResponse(retryAfter)

  const body = await req.json()
  const validation = SignUpSchema.safeParse(body)
  if (!validation.success) {
    throw new ValidationError(
      'Invalid input',
      validation.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
    )
  }

  const { email, password, fullName, orgName } = validation.data

  try {
    const result = await signUp(email, password, fullName, orgName)
    return successResponse(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
        },
        org: {
          id: result.org.id,
          name: result.org.name,
          slug: result.org.slug,
        },
      },
      { statusCode: 201, message: 'Workspace created successfully' }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const lower = message.toLowerCase()
    if (
      lower.includes('already') ||
      lower.includes('registered') ||
      lower.includes('exists') ||
      lower.includes('duplicate') ||
      lower.includes('unique')
    ) {
      throw new ConflictError('An account with this email already exists. Sign in instead.')
    }
    throw err
  }
})
