import { prisma } from '@/lib/db'
import { successResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/rbac'
import { z } from 'zod'

const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  specifications: z.any().optional(),
  basePrice: z.number().positive().optional(),
  currency: z.string().optional(),
  unit: z.string().optional(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).optional(),
  defaultSupplierId: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  datasheet: z.string().nullable().optional(),
  active: z.boolean().optional(),
  discontinued: z.boolean().optional(),
})

export const GET = withErrorHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ERP_INVENTORY_READ,
  )

  const product = await prisma.product.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    include: { inventory: true, suppliers: { select: { id: true, name: true } } },
  })
  if (!product) throw new ValidationError('Product not found')

  return successResponse(product)
})

export const PUT = withErrorHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ERP_INVENTORY_EDIT,
  )

  const body = await req.json()
  const parsed = UpdateProductSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError(
      'Invalid input',
      parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    )
  }

  const product = await prisma.product.findFirst({ where: { id: params.id, orgId: ctx.orgId } })
  if (!product) throw new ValidationError('Product not found')

  const updated = await prisma.product.update({ where: { id: params.id }, data: parsed.data })
  return successResponse(updated)
})

export const DELETE = withErrorHandler(async (req: Request, { params }: { params: { id: string } }) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ERP_INVENTORY_EDIT,
  )

  const product = await prisma.product.findFirst({ where: { id: params.id, orgId: ctx.orgId } })
  if (!product) throw new ValidationError('Product not found')

  await prisma.product.update({ where: { id: params.id }, data: { active: false, discontinued: true } })
  return successResponse({ deleted: true })
})