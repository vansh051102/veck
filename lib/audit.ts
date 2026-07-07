import { prisma } from './db'
import { createChildLogger } from './logger'

const log = createChildLogger('audit')

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
    log.error({ err: error, action, resourceType, resourceId }, 'audit log write failed')
  }
}
