import { prisma } from '@/lib/db'
import { successResponse, paginatedResponse, withErrorHandler, ValidationError } from '@/lib/api-response'
import { validateRequest } from '@/lib/middleware/validate-headers'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/rbac'
import { z } from 'zod'

const CreateProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  specifications: z.any().default({}),
  basePrice: z.number().positive('Base price must be positive'),
  currency: z.string().default('INR'),
  unit: z.string().default('kg'),
  minStock: z.number().int().min(0).default(10),
  maxStock: z.number().int().min(0).default(1000),
  defaultSupplierId: z.string().optional(),
  imageUrl: z.string().optional(),
  datasheet: z.string().optional(),
})

export const GET = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ERP_INVENTORY_READ,
  )

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')))
  const search = url.searchParams.get('search')
  const category = url.searchParams.get('category')
  const active = url.searchParams.get('active') !== 'false'

  const where = {
    orgId: ctx.orgId,
    active,
    ...(category && { category }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { sku: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
      include: { inventory: { select: { currentStock: true, reserved: true } }, suppliers: { select: { id: true, name: true } } },
    }),
    prisma.product.count({ where }),
  ])

  return paginatedResponse(products, { page, limit, total, totalPages: Math.ceil(total / limit) })
})

export const POST = withErrorHandler(async (req: Request) => {
  const ctx = await validateRequest(req)
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ERP_INVENTORY_EDIT,
  )

  const body = await req.json()
  const parsed = CreateProductSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError(
      'Invalid input',
      parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    )
  }

  const existing = await prisma.product.findUnique({
    where: { orgId_sku: { orgId: ctx.orgId, sku: parsed.data.sku } },
  })
  if (existing) {
    throw new ValidationError(`Product with SKU "${parsed.data.sku}" already exists`)
  }

  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      specifications: parsed.data.specifications ?? {},
      orgId: ctx.orgId,
    },
  })

  await prisma.inventory.create({
    data: {
      orgId: ctx.orgId,
      productId: product.id,
      currentStock: 0,
      reserved: 0,
    },
  })

  return successResponse(product, { statusCode: 201 })
})