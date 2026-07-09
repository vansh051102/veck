import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/inactive',
  '/api/v1/auth/signup',
  '/api/v1/auth/signin',
  // NOTE: password reset goes through Supabase directly from the
  // /auth/forgot-password page - there is intentionally no API route for it.
  '/api/v1/health',
  // Called by this middleware itself (see below) - must stay public to
  // avoid infinite recursion through the middleware matcher.
  '/api/internal/session',
  // External webhooks - server-to-server, no user session exists. Each
  // webhook route does its own auth (see e.g. INDIAMART_WEBHOOK_SECRET).
  '/api/v1/webhooks',
  // Scheduler endpoints - server-to-server, authenticated via CRON_SECRET
  // inside the route handler itself.
  '/api/v1/cron',
]

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Get session - this is a lightweight cookie/JWT check and is safe to run
  // in the Edge Runtime that middleware executes in.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  // Allow public routes without authentication
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return res
  }

  // Require authentication for protected routes
  if (!session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Resolve the Supabase session to our app's User row (org, role, status).
  // NOTE: this can't be done with Prisma directly here - middleware runs in
  // the Edge Runtime, and Prisma's query engine requires a Node.js process.
  // Instead we call an internal Node.js API route over HTTP, which is the
  // supported way to bridge Edge middleware to a database lookup.
  let sessionData: { id: string; orgId: string; role: string; status: string; department: string | null; designation: string | null } | null = null
  try {
    const sessionRes = await fetch(new URL('/api/internal/session', req.url), {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (sessionRes.ok) {
      sessionData = await sessionRes.json()
    }
  } catch (error) {
    console.error('Error resolving session:', error)
  }

  if (!sessionData) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // Check if user is active
  if (sessionData.status !== 'active') {
    return NextResponse.redirect(new URL('/auth/inactive', req.url))
  }

  // NOTE: /admin (admin workspace) is intentionally not role-gated here — a
  // home-org "member" can be a workspace admin of another org via Membership.
  // Authorization happens per-request in /api/v1/admin/* route handlers.

  // Attach user info to the *request* headers so downstream route handlers
  // can read them. Setting headers on `res` only affects the response sent
  // to the browser - it does NOT forward anything to route handlers.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-user-id', sessionData.id)
  requestHeaders.set('x-org-id', sessionData.orgId)
  requestHeaders.set('x-user-role', sessionData.role)
  requestHeaders.set('x-user-department', sessionData.department ?? '')
  requestHeaders.set('x-user-designation', sessionData.designation ?? '')

  const nextRes = NextResponse.next({ request: { headers: requestHeaders } })
  // Preserve any cookies Supabase set on `res` (session refresh).
  res.cookies.getAll().forEach((cookie) => nextRes.cookies.set(cookie))
  return nextRes
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.+\\.\\w+$).*)'],
}
