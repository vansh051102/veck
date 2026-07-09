// Server-side module-access enforcement. One line after validateRequest in a
// module's entry routes:
//   await requireModule(ctx.orgId, 'leads')

import { prisma } from '@/lib/db'
import { ForbiddenError } from '@/lib/errors'
import { isModuleEnabled, type ModuleKey } from '@/lib/modules'

export async function requireModule(orgId: string, key: ModuleKey): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { moduleAccess: true },
  })
  if (!isModuleEnabled(org?.moduleAccess ?? null, key)) {
    throw new ForbiddenError('This module is disabled for your company')
  }
}
