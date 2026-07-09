'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/permissions'
import { ValidationError } from '@/lib/errors'
import { getActionContext } from './_context'
import { withAction } from './_result'
import { ConvertLeadSchema } from './schemas'
import { convertLead } from '../../services/erp/conversion.service'

// Lead → Customer + draft SalesOrder. Flagship CRM→ERP transition.
export const convertLeadToCustomer = withAction(async (raw: unknown) => {
  const ctx = await getActionContext()
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ERP_ORDERS_EDIT
  )

  const parsed = ConvertLeadSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError('Invalid conversion input', parsed.error.flatten())
  }
  const input = parsed.data

  const result = await prisma.$transaction((tx) => convertLead(tx, ctx, input))

  await logAudit(
    ctx.orgId,
    ctx.userId,
    'CONVERT_LEAD',
    'Lead',
    input.leadId,
    result.customer.name,
    { customerId: result.customer.id, salesOrderId: result.salesOrder.id }
  )
  revalidatePath(`/leads/${input.leadId}`)

  return result
})
