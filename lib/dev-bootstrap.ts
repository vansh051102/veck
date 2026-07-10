import { prisma } from './db'
import { signUp } from './auth'
import { isAuthDisabled } from './dev-auth'

export type DevSessionUser = {
  id: string
  orgId: string
  role: string
  status: string
  department: string | null
  designation: string | null
}

function toSessionUser(user: {
  id: string
  orgId: string
  role: string
  status: string
  department: string | null
  designation: string | null
}): DevSessionUser {
  return {
    id: user.id,
    orgId: user.orgId,
    role: user.role,
    status: user.status,
    department: user.department,
    designation: user.designation,
  }
}

/** First active admin, else any active user; auto-provisions in DISABLE_AUTH mode. */
export async function resolveDevBypassUser(): Promise<DevSessionUser | null> {
  const admin = await prisma.user.findFirst({
    where: { status: 'active', role: 'admin' },
    orderBy: { createdAt: 'asc' },
  })
  if (admin) return toSessionUser(admin)

  const anyUser = await prisma.user.findFirst({
    where: { status: 'active' },
    orderBy: { createdAt: 'asc' },
  })
  if (anyUser) return toSessionUser(anyUser)

  if (!isAuthDisabled()) return null

  const email = process.env.DEV_ADMIN_EMAIL ?? 'dev@veck.local'
  const password = process.env.DEV_ADMIN_PASSWORD ?? 'devpassword123'

  try {
    const { user } = await signUp(email, password, 'Dev Admin', 'Dev Workspace')
    return toSessionUser(user)
  } catch {
    const existing = await prisma.user.findFirst({
      where: { email },
      orderBy: { createdAt: 'asc' },
    })
    return existing ? toSessionUser(existing) : null
  }
}
