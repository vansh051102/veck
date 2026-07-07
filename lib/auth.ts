import { createClient } from '@supabase/supabase-js'
import { prisma } from './db'
import { seedDefaultRoles } from './seed-roles'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    // 1. Create Supabase user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) throw authError
    if (!user) throw new Error('Failed to create user')

    // 2. Create organization
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug: orgName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
        subscriptionPlan: 'free',
      },
    })

    // 3. Create user in database
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

    // 4. Seed default roles (admin, sales, purchase, etc.) for the new org
    await seedDefaultRoles(org.id)

    // 5. Create default settings
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
    console.error('SignUp error:', error)
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
    console.error('SignIn error:', error)
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
    console.error('Get current user error:', error)
    return null
  }
}

export async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession()
  if (error) throw error
  return data
}

// ============================================================================
// PERMISSION & ACCESS CONTROL
// ============================================================================

export async function checkPermission(userId: string, permission: string): Promise<boolean> {
  try {
    const { getUserPermissions } = await import('./rbac')
    const permissions = await getUserPermissions(userId)
    if (permissions.includes('*')) return true
    return permissions.includes(permission)
  } catch (error) {
    console.error('Permission check error:', error)
    return false
  }
}

export async function hasAnyPermission(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  try {
    const { checkAnyPermission } = await import('./rbac')
    return await checkAnyPermission(userId, permissions)
  } catch (error) {
    console.error('Permission check error:', error)
    return false
  }
}

export async function hasAllPermissions(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  try {
    const { getUserPermissions } = await import('./rbac')
    const userPermissions = await getUserPermissions(userId)
    if (userPermissions.includes('*')) return true
    return permissions.every((p) => userPermissions.includes(p))
  } catch (error) {
    console.error('Permission check error:', error)
    return false
  }
}

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

export async function createRole(
  orgId: string,
  name: string,
  permissions: string[],
  description?: string
) {
  return await prisma.role.create({
    data: {
      orgId,
      name,
      permissions,
      description,
    },
  })
}

export async function updateRole(
  roleId: string,
  permissions: string[],
  description?: string
) {
  return await prisma.role.update({
    where: { id: roleId },
    data: {
      permissions,
      ...(description && { description }),
    },
  })
}

export async function assignRoleToUser(userId: string, role: string) {
  return await prisma.user.update({
    where: { id: userId },
    data: { role },
    include: { org: true },
  })
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export async function logAudit(
  orgId: string,
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  resourceName?: string,
  changes?: any,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId,
        userId,
        action,
        resourceType,
        resourceId,
        resourceName,
        changes,
        ipAddress,
      },
    })
  } catch (error) {
    console.error('Audit log error:', error)
    // Don't throw - audit logging shouldn't break the main operation
  }
}

// ============================================================================
// ORGANIZATION MANAGEMENT
// ============================================================================

export async function getUserOrganization(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { org: true },
    })
    return user?.org || null
  } catch (error) {
    console.error('Get org error:', error)
    return null
  }
}

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

export async function updateUserStatus(userId: string, status: 'active' | 'inactive' | 'suspended') {
  return await prisma.user.update({
    where: { id: userId },
    data: { status },
  })
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
    console.error('Session validation error:', error)
    return null
  }
}

export async function getSessionUser(session: any) {
  if (!session?.user?.id) return null
  return await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { org: true },
  })
}
