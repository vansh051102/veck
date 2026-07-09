import { headers } from 'next/headers'
import { verifyUserContext, type RequestContext } from '@/lib/middleware/validate-headers'

// Server Actions have no `Request` object, but middleware.ts injects the same
// x-user-id / x-org-id headers on page routes (its matcher covers them), so we
// read them via next/headers and reuse the exact DB re-verification that API
// routes get through validateRequest.
export async function getActionContext(): Promise<RequestContext> {
  const h = headers()
  return verifyUserContext(h.get('x-user-id'), h.get('x-org-id'))
}
