import { NextResponse } from 'next/server'
import { supabase } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/internal/session - Resolves a Supabase access token to the app's
// User row (with org/role/status). This exists so that middleware.ts, which
// runs in the Edge Runtime and therefore CANNOT use Prisma directly (Prisma's
// query engine requires a Node.js process), can still gate routes on
// database state. Middleware forwards the caller's access token here over
// HTTP; this route runs in the normal Node.js runtime where Prisma works.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  }

  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !authUser) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Self-service email changes (see app/(app)/profile/page.tsx) go through
  // Supabase's own confirm-by-link flow, so authUser.email only updates once
  // the user clicks the confirmation link. This runs on effectively every
  // authenticated request, so it's the earliest safe point to mirror the
  // confirmed change into our own User row — no webhook needed. Wrapped so
  // a rare unique-constraint collision can't break session resolution.
  if (authUser.email && user.email !== authUser.email) {
    try {
      await prisma.user.update({ where: { id: user.id }, data: { email: authUser.email } })
    } catch (err) {
      console.error('Failed to sync confirmed email change:', err)
    }
  }

  return NextResponse.json({
    id: user.id,
    orgId: user.orgId,
    role: user.role,
    status: user.status,
    department: user.department,
    designation: user.designation,
  })
}
