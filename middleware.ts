import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from './lib/db'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/api/v1/auth/signup',
  '/api/v1/auth/signin',
  '/api/v1/auth/forgot-password',
  '/api/v1/health',
]

// Admin-only routes
const ADMIN_ROUTES = ['/admin']

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  // Allow public routes without authentication
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return res
  }

  // Require authentication for protected routes
  if (!session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Get user from database
  let user
  try {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { org: true },
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // Check if user is active
  if (user.status !== 'active') {
    return NextResponse.redirect(new URL('/auth/inactive', req.url))
  }

  // Check admin access
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    if (user.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Attach user info to headers for API routes
  res.headers.set('x-user-id', user.id)
  res.headers.set('x-org-id', user.orgId)
  res.headers.set('x-user-role', user.role)

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.+\\.\\w+$).*)'],
}
