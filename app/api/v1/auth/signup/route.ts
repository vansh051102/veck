import { signUp } from '@/lib/auth'
import { seedDefaultRoles } from '@/lib/seed-roles'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { authLimiter, rateLimitResponse } from '@/lib/rate-limit'
import { z } from 'zod'

const SignUpSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  orgName: z.string().min(2, 'Organization name is required'),
})

export const POST = withErrorHandler(async (req) => {
  // Rate limit: 10 signups per minute per IP
  const { allowed, retryAfter } = authLimiter.check(req)
  if (!allowed) return rateLimitResponse(retryAfter)

  const body = await req.json()

  // Validate input
  const validation = SignUpSchema.safeParse(body)
  if (!validation.success) {
    throw new ValidationError(
      'Invalid input',
      validation.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }))
    )
  }

  const { email, password, fullName, orgName } = validation.data

  // Create user and organization
  const result = await signUp(email, password, fullName, orgName)

  // Seed default roles for the new org (fire-and-forget — don't block signup)
  seedDefaultRoles(result.org.id).catch((err) =>
    console.error(`Failed to seed roles for org ${result.org.id}:`, err)
  )

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
    { statusCode: 201, message: 'User created successfully' }
  )
})
