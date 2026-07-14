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

  // redirectTo must be a fixed, trusted URL — never derived from request
  // headers (Origin/Referer are caller-controlled, so trusting them here
  // would let a caller redirect the target user's magic-link session token
  // to an attacker-chosen host). App is pinned to app.veck.in; override via
  // APP_URL env if that ever changes.
  const appUrl = process.env.APP_URL ?? 'https://app.veck.in'

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
    options: { redirectTo: `${appUrl}/dashboard` },
  })
  if (error || !data?.properties?.action_link) {
    throw new InternalServerError('Failed to generate login link')
  }

  return successResponse({ loginUrl: data.properties.action_link })
})
