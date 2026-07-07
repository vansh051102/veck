import { z } from 'zod'
import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'

const UpdateSelfSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
})

// PUT /api/v1/users/me - Self-service profile update. Deliberately separate
// from the admin-only PUT /api/v1/users/[id] (which forbids self-edit of
// role/status): this route has no permission check at all, because "edit
// your own name" isn't an RBAC concern — it's scoped to the caller's own
// row structurally (no :id param exists for anyone to tamper with), and the
// schema only accepts fullName, never role/department/status/email.
export const PUT = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  const { userId } = ctx

  const body = await req.json()
  const parsed = UpdateSelfSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid profile data', parsed.error.flatten())
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { fullName: parsed.data.fullName },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      department: true,
      designation: true,
    },
  })

  return successResponse(user)
})
