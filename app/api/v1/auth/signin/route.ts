import { signIn } from '@/lib/auth'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { rateLimitResponse } from '@/lib/rate-limit'
import { authLimiter } from '@/lib/rate-limit-db'
import { z } from 'zod'

const SignInSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

export const POST = withErrorHandler(async (req) => {
  // Rate limit: 10 sign-in attempts per minute per IP
  const { allowed, retryAfter } = await authLimiter.check(req)
  if (!allowed) return rateLimitResponse(retryAfter)

  const body = await req.json()

  // Validate input
  const validation = SignInSchema.safeParse(body)
  if (!validation.success) {
    throw new ValidationError(
      'Invalid input',
      validation.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }))
    )
  }

  const { email, password } = validation.data

  // Sign in
  const result = await signIn(email, password)

  return successResponse({
    session: result.session,
    user: {
      id: result.user?.id,
      email: result.user?.email,
    },
  })
})
