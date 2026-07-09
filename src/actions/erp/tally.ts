'use server'

import { prisma } from '@/lib/db'
import { rbacService } from '@/lib/services/rbac.service'
import { PERMISSIONS } from '@/lib/permissions'
import { ValidationError } from '@/lib/errors'
import { getActionContext } from './_context'
import { withAction } from './_result'
import { EnqueueTallySchema } from './schemas'
import { enqueue } from '../../services/erp/tally-sync.service'

// Queue an entity (invoice / sales order / ledger) for the next Tally push.
export const enqueueForTally = withAction(async (raw: unknown) => {
  const ctx = await getActionContext()
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ERP_TALLY_SYNC
  )

  const parsed = EnqueueTallySchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError('Invalid Tally enqueue request', parsed.error.flatten())
  }
  const { entityType, entityId, format } = parsed.data

  return prisma.$transaction((tx) =>
    enqueue(tx, { orgId: ctx.orgId, entityType, entityId, format, createdBy: ctx.userId })
  )
})

// Reset this org's failed rows back to pending for the worker to retry.
// ponytail: worker enforces maxAttempts per row — Prisma updateMany can't
// compare attempts to maxAttempts columns, so we requeue all failed here.
export const retryFailedTallySync = withAction(async () => {
  const ctx = await getActionContext()
  rbacService.requirePermission(
    await rbacService.getUserPermissions(ctx.userId),
    PERMISSIONS.ERP_TALLY_SYNC
  )

  const { count } = await prisma.tallySyncQueue.updateMany({
    where: { orgId: ctx.orgId, status: 'failed' },
    data: { status: 'pending', lastError: null },
  })
  return { requeued: count }
})
