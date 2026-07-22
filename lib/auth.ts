import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import { seedDefaultRoles } from './seed-roles'
import { supabase, supabaseAdmin } from './supabase-clients'
import { createChildLogger } from './logger'
import { defaultWorkflowStages } from './workflow-stages'

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
  const normalizedEmail = email.trim().toLowerCase()
  let authUserId: string | null = null

  try {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })
    if (existing) {
      throw new Error('An account with this email already exists. Sign in instead.')
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim() },
    })

    if (authError) {
      const msg = authError.message?.toLowerCase() ?? ''
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        throw new Error('An account with this email already exists. Sign in instead.')
      }
      throw authError
    }
    if (!user) throw new Error('Failed to create user')
    authUserId = user.id

    const slugBase = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)

    // One transaction for all four writes: previously these ran as separate
    // calls, so a failure in seedDefaultRoles or settings.create after the
    // org/user rows were already committed left them orphaned — no Supabase
    // Auth account (the catch block below only cleans that up), but a User
    // row that permanently blocks that email from ever signing up again via
    // the "already exists" check above, with no way back in. Now either all
    // four commit together or none do.
    const { org, dbUser } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName.trim(),
          slug: `${slugBase || 'workspace'}-${Date.now()}`,
          subscriptionPlan: 'free',
        },
      })

      const dbUser = await tx.user.create({
        data: {
          id: user.id,
          email: normalizedEmail,
          fullName: fullName.trim(),
          orgId: org.id,
          role: 'admin',
          department: null,
          defaultDashboard: '/admin',
        },
        include: { org: true },
      })

      await seedDefaultRoles(org.id, tx)

      await tx.settings.create({
        data: {
          orgId: org.id,
          updatedBy: user.id,
          workflowStages: { stages: defaultWorkflowStages() } as unknown as Prisma.InputJsonValue,
          moduleAccess: {
            leads: true,
            lead_message_logs: true,
            contacts: true,
            lead_generation_campaigns: false,
            customer_folders: true,
            auto_create_folders: true,
            quotations: true,
          } as Prisma.InputJsonValue,
          roleHierarchy: [] as Prisma.InputJsonValue,
        },
      })

      return { org, dbUser }
    })

    return { user: dbUser, org }
  } catch (error) {
    // Roll back orphaned Auth user if Prisma provisioning failed after createUser
    if (authUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
      } catch (cleanupErr) {
        log.error({ err: cleanupErr, authUserId }, 'signUp cleanup failed')
      }
    }
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
      phone: true,
      role: true,
      department: true,
      designation: true,
      territory: true,
      branch: true,
      reportsToId: true,
      status: true,
      lastLogin: true,
      createdAt: true,
    },
  })
}
