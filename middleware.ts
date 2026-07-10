import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAuthDisabled } from '@/lib/dev-auth'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/inactive',
  '/api/v1/auth/signup',
  '/api/v1/auth/signin',
  '/api/v1/health',
  '/api/internal/session',
  '/api/v1/webhooks',
  '/api/v1/cron',
]

const ADMIN_ROUTES = ['/admin']

type SessionData = {
  id: string
  orgId: string
  role: string
  status: string
  department: string | null
  designation: string | null
}

// Short-lived cache + single-flight so parallel API calls share one
// /api/internal/session round-trip instead of stampeding Prisma.
const SESSION_TTL_MS = 30_000
const sessionCache = new Map<string, { data: SessionData; expires: number }>()
const sessionInflight = new Map<string, Promise<SessionData | null>>()

async function resolveSession(req: NextRequest, accessToken?: string): Promise<SessionData | null> {
  const cacheKey = accessToken ?? '__dev__'
  const hit = sessionCache.get(cacheKey)
  if (hit && hit.expires > Date.now()) {
    return hit.data
  }

  const pending = sessionInflight.get(cacheKey)
  if (pending) return pending

  const promise = (async (): Promise<SessionData | null> => {
    try {
      const sessionRes = await fetch(new URL('/api/internal/session', req.url), {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      })
      if (sessionRes.ok) {
        const data = (await sessionRes.json()) as SessionData
        sessionCache.set(cacheKey, { data, expires: Date.now() + SESSION_TTL_MS })
        return data
      }
    } catch (error) {
      console.error('Error resolving session:', error)
    }
    return null
  })().finally(() => {
    sessionInflight.delete(cacheKey)
  })

  sessionInflight.set(cacheKey, promise)
  return promise
}

function attachUserHeaders(req: NextRequest, res: NextResponse, sessionData: SessionData) {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-user-id', sessionData.id)
  requestHeaders.set('x-org-id', sessionData.orgId)
  requestHeaders.set('x-user-role', sessionData.role)
  requestHeaders.set('x-user-department', sessionData.department ?? '')
  requestHeaders.set('x-user-designation', sessionData.designation ?? '')

  const nextRes = NextResponse.next({ request: { headers: requestHeaders } })
  res.cookies.getAll().forEach((cookie) => nextRes.cookies.set(cookie))
  return nextRes
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return res
  }

  const isApi = pathname.startsWith('/api/')

  // Dev bypass: skip login redirects; always impersonate dev user (ignore stale cookies).
  if (isAuthDisabled()) {
    // API routes: don't block on session HTTP — validateRequest resolves the bypass user.
    if (isApi) {
      const hit = sessionCache.get('__dev__')
      if (hit && hit.expires > Date.now()) {
        return attachUserHeaders(req, res, hit.data)
      }
      void resolveSession(req)
      return res
    }
    const sessionData = await resolveSession(req)
    if (sessionData) {
      return attachUserHeaders(req, res, sessionData)
    }
    return res
  }

  const supabase = createMiddlewareClient(
    { req, res },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // API fast path: use cached session headers when available. On cache miss,
  // pass through immediately — the route's validateRequest resolves the Bearer
  // token. Warm the cache in the background for the next request.
  if (isApi) {
    const cacheKey = session.access_token
    const hit = sessionCache.get(cacheKey)
    if (hit && hit.expires > Date.now()) {
      return attachUserHeaders(req, res, hit.data)
    }
    void resolveSession(req, session.access_token)
    return res
  }

  const sessionData = await resolveSession(req, session.access_token)

  if (!sessionData) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  if (sessionData.status !== 'active') {
    return NextResponse.redirect(new URL('/auth/inactive', req.url))
  }

  if (ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
    if (sessionData.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return attachUserHeaders(req, res, sessionData)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.+\\.\\w+$).*)'],
}
