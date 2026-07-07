import { prisma } from '@/lib/db'
import { supabaseAdmin, getOrganizationUsers } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/rbac'
import { successResponse, withErrorHandler, ValidationError, ConflictError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { z } from 'zod'

const CreateUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  territory: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
})

// GET /api/v1/users - List users in the caller's org (for assignment pickers etc.)
export const GET = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.USERS_READ)

  const users = await getOrganizationUsers(orgId)
  const activeUsers = users.filter((u) => u.status === 'active')

  return successResponse(activeUsers)
})

// POST /api/v1/users - Create a new user in the organization
export const POST = withErrorHandler(async (req) => {
  const ctx = await validateRequest(req)
  const { orgId } = ctx
  rbacService.requirePermission(await rbacService.getUserPermissions(ctx.userId), PERMISSIONS.USERS_CREATE)

  const body = await req.json()
  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid user data', parsed.error.flatten())
  }

  const { email, password, fullName, role, department, designation, territory, branch } = parsed.data

  // Check for duplicate email within org
  const existingUser = await prisma.user.findFirst({
    where: { orgId, email },
  })
  if (existingUser) {
    throw new ConflictError('A user with this email already exists in your organization')
  }

  // 1. Create Supabase auth user
  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm so they can log in immediately
  })

  if (authError) throw new ValidationError('Failed to create auth user', { message: authError.message })
  if (!authUser) throw new ValidationError('Failed to create auth user')

  // 2. Create user in database
  const dbUser = await prisma.user.create({
    data: {
      id: authUser.id,
      email,
      fullName,
      orgId,
      role,
      department: department || null,
      designation: designation || null,
      territory: territory || null,
      branch: branch || null,
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

  return successResponse(dbUser, { statusCode: 201 })
})
