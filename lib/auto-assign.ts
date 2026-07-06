// ============================================================================
// AUTO-ASSIGNMENT ENGINE
// ============================================================================
// When Settings.autoAssignmentEnabled is on, new leads are assigned
// automatically. Supported rules (Settings.autoAssignmentRule.rule_type):
//   - "least_open_leads" (default): the active user with the fewest open
//     leads gets the next one. Capacity-based; converges to even distribution.
//   - "round_robin": cycles through active users in stable alphabetical order,
//     picking the next user after whoever received the most recent lead.

import type { Prisma } from '@prisma/client'

export async function pickAssignee(
  tx: Prisma.TransactionClient,
  orgId: string
): Promise<string | null> {
  const settings = await tx.settings.findUnique({ where: { orgId } })
  if (!settings?.autoAssignmentEnabled) return null

  const users = await tx.user.findMany({
    where: { orgId, status: 'active' },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })
  if (users.length === 0) return null

  const rule = (settings.autoAssignmentRule as { rule_type?: string } | null)?.rule_type

  if (rule === 'round_robin') {
    const lastLead = await tx.lead.findFirst({
      where: { orgId, assignedToId: { not: null } },
      orderBy: { assignedAt: 'desc' },
      select: { assignedToId: true },
    })
    const lastIndex = lastLead?.assignedToId
      ? users.findIndex((u) => u.id === lastLead.assignedToId)
      : -1
    return users[(lastIndex + 1) % users.length].id
  }

  // Default: least_open_leads
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
