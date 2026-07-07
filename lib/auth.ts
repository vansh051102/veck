import { prisma } from './db'
import { seedDefaultRoles } from './seed-roles'
import { supabase, supabaseAdmin } from './supabase-clients'
import { createChildLogger } from './logger'

const log = createChildLogger('auth')

// Re-export Supabase clients for backward compatibility
export { supabase, supabaseAdmin }

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  orgName: string
) {
  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) throw authError
    if (!user) throw new Error('Failed to create user')

    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug: orgName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
        subscriptionPlan: 'free',
      },
    })

    const dbUser = await prisma.user.create({
      data: {
        id: user.id,
        email,
        fullName,
        orgId: org.id,
        role: 'admin',
      },
      include: { org: true },
    })

    await seedDefaultRoles(org.id)

    await prisma.settings.create({
      data: {
        orgId: org.id,
        updatedBy: user.id,
        workflowStages: {
          stages: ['New Lead', 'Contacted', 'Qualified', 'Quote Sent', 'Closed Won', 'Deal Lost', 'Disqualified'],
        },
      },
    })

    return { user: dbUser, org }
  } catch (error) {
    log.error({ err: error }, 'signUp failed')
    throw error
  }
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  } catch (error) {
    log.error({ err: error }, 'signIn failed')
    throw error
  }
}

export async function signOut() {
  return await supabase.auth.signOut()
}

export async function getCurrentUser(session: any) {
  if (!session?.user) return null

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { org: true },
    })
    return user
  } catch (error) {
    log.error({ err: error }, 'getCurrentUser failed')
    return null
  }
}

export async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession()
  if (error) throw error
  return data
}

// ============================================================================
// SESSION VALIDATION
// ============================================================================

export async function validateSession(token: string) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch (error) {
    log.error({ err: error }, 'session validation failed')
    return null
  }
}

// ============================================================================
// USER MANAGEMENT (used by API routes)
// ============================================================================

export async function getOrganizationUsers(orgId: string) {
  return await prisma.user.findMany({
    where: { orgId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      lastLogin: true,
      createdAt: true,
    },
  })
}
