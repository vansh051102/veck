// ============================================================================
// AUTO-ASSIGNMENT ENGINE
// ============================================================================
// When Settings.autoAssignmentEnabled is on, new leads are assigned
// automatically. Supported rule (Settings.autoAssignmentRule.rule_type):
//   - "least_open_leads" (default): the active user with the fewest open
//     leads gets the next one. This is capacity-based round-robin: it
//     converges to an even distribution and needs no rotation state.

import type { Prisma } from '@prisma/client'

export async function pickAssignee(
  tx: Prisma.TransactionClient,
  orgId: string
): Promise<string | null> {
  const settings = await tx.settings.findUnique({ where: { orgId } })
  if (!settings?.autoAssignmentEnabled) return null

  const users = await tx.user.findMany({
    where: { orgId, status: 'active' },
    select: { id: true },
  })
  if (users.length === 0) return null

  const counts = await tx.lead.groupBy({
    by: ['assignedToId'],
    where: { orgId, status: 'open', assignedToId: { not: null } },
    _count: { _all: true },
  })
  const countByUser = new Map(counts.map((c) => [c.assignedToId as string, c._count._all]))

  let best: string | null = null
  let bestCount = Number.POSITIVE_INFINITY
  for (const user of users) {
    const count = countByUser.get(user.id) ?? 0
    if (count < bestCount) {
      best = user.id
      bestCount = count
    }
  }
  return best
}
