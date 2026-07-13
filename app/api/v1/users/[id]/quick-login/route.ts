import { prisma } from '@/lib/db'
import { supabaseAdmin } from '@/lib/auth'
import { successResponse, withErrorHandler, NotFoundError, InternalServerError } from '@/lib/api-response'
import { validateRequestWithRole } from '@/lib/middleware/validate-headers'

// POST /api/v1/users/[id]/quick-login - Admin-only. Mints a one-time Supabase
// magic link for another user in the same org, so an admin can open it in a
// new tab and QA the app as that user without knowing their password.
export const POST = withErrorHandler(async (req, { params }: { params: { id: string } }) => {
  const ctx = await validateRequestWithRole(req, ['admin'])

  const target = await prisma.user.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { email: true },
  })
  if (!target) throw new NotFoundError('User not found')

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
  })
  if (error || !data?.properties?.action_link) {
    throw new InternalServerError('Failed to generate login link')
  }

  return successResponse({ loginUrl: data.properties.action_link })
})
