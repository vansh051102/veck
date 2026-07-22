import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { seedDefaultRoles } from '@/lib/seed-roles'
import { defaultWorkflowStages } from '@/lib/workflow-stages'
import { PERMISSIONS } from '@/lib/rbac'
import { successResponse, withErrorHandler, ValidationError, ForbiddenError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'

const CreateOrgSchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional(),
  country: z.string().optional(),
})

// GET /api/v1/organizations — companies the admin can manage
export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  if (ctx.role !== 'admin') {
    throw new ForbiddenError('Admin access required')
  }

  // v1: return the caller's org (multi-org membership can expand later)
  const orgs = await prisma.organization.findMany({
    where: { id: ctx.orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      industry: true,
      country: true,
      subscriptionPlan: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return successResponse(
    orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      industry: o.industry,
      country: o.country,
      subscriptionPlan: o.subscriptionPlan,
      createdAt: o.createdAt,
      memberCount: o._count.users,
    }))
  )
})

// POST /api/v1/organizations — create a new company (admin)
export const POST = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  if (ctx.role !== 'admin') {
    throw new ForbiddenError('Admin access required')
  }
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.SETTINGS_EDIT
  )

  const body = await req.json()
  const parsed = CreateOrgSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError('Invalid organization', parsed.error.flatten())
  }

  const slug =
    parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' +
    Date.now().toString(36)

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name: parsed.data.name,
        slug,
        industry: parsed.data.industry,
        country: parsed.data.country ?? 'India',
      },
    })

    await seedDefaultRoles(created.id, tx)

    await tx.settings.create({
      data: {
        orgId: created.id,
        updatedBy: ctx.userId,
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

    return created
  })

  return successResponse(org, { statusCode: 201 })
})
