import { signUp } from '@/lib/auth'
import { successResponse, errorResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { z } from 'zod'

const SignUpSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  orgName: z.string().min(2, 'Organization name is required'),
})

export const POST = withErrorHandler(async (req) => {
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
