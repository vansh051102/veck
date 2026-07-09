import { prisma } from './db'
import { seedDefaultRoles } from './seed-roles'
import { supabase, supabaseAdmin } from './supabase-clients'
import { createChildLogger } from './logger'
import { ValidationError } from './errors'

const log = createChildLogger('auth')

// Re-export Supabase clients for backward compatibility
export { supabase, supabaseAdmin }

// ============================================================================
// ORGANIZATION PROVISIONING (shared by signup and the admin workspace)
// ============================================================================

export interface ProvisionOrganizationInput {
  name: string
  industry?: string | null
  country?: string | null
}

/**
 * Create an organization with its default roles and settings. Shared by
 * public signup and "+ New company" in the admin workspace.
 */
export async function provisionOrganization(
  input: ProvisionOrganizationInput,
  createdByUserId: string
) {
  const slugBase = input.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const org = await prisma.organization.create({
    data: {
      name: input.name,
      slug: slugBase + '-' + Date.now(),
      subscriptionPlan: 'free',
      industry: input.industry || null,
      ...(input.country ? { country: input.country } : {}),
    },
  })

  await seedDefaultRoles(org.id)

  await prisma.settings.create({
    data: {
      orgId: org.id,
      updatedBy: createdByUserId,
      workflowStages: {
        stages: ['New Lead', 'Contacted', 'Qualified', 'Quote Sent', 'Closed Won', 'Deal Lost', 'Disqualified'],
      },
    },
  })

  return org
}

export interface CreateOrgUserInput {
  email: string
  password: string
  fullName: string
  role: string
  department?: string | null
  designation?: string | null
  territory?: string | null
  branch?: string | null
}

/**
 * Create a Supabase auth user + org User row + home-org Membership. Shared by
 * POST /users and the admin workspace. The caller is responsible for
 * org-scoping/global email pre-checks and RBAC.
 */
export async function createOrgUser(orgId: string, input: CreateOrgUserInput) {
  const { data: { user: authUser }, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true, // Auto-confirm so they can log in immediately
    })

  if (authError) throw new ValidationError('Failed to create auth user', { message: authError.message })
  if (!authUser) throw new ValidationError('Failed to create auth user')

  const dbUser = await prisma.user.create({
    data: {
      id: authUser.id,
      email: input.email,
      fullName: input.fullName,
      orgId,
      role: input.role,
      department: input.department || null,
      designation: input.designation || null,
      territory: input.territory || null,
      branch: input.branch || null,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      department: true,
      designation: true,
      territory: true,
      branch: true,
      status: true,
      createdAt: true,
    },
  })

  // Home-org membership (mirrors the migration backfill invariant)
  await prisma.membership.create({
    data: {
      userId: dbUser.id,
      orgId,
      role: input.role === 'admin' ? 'admin' : 'member',
    },
  })

  return dbUser
}

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
      email_confirm: true, // Auto-confirm so they can log in immediately
    })

    if (authError) throw authError
    if (!user) throw new Error('Failed to create user')

    const org = await provisionOrganization({ name: orgName }, user.id)

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

    await prisma.membership.create({
      data: { userId: dbUser.id, orgId: org.id, role: 'admin' },
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
