import { prisma } from './db'
import { calculateSlaDeadline } from './workflow'
import { createSopChecklistsForStage } from './sop-checklists'
import { pickAssignee } from './auto-assign'
import type { Prisma } from '@prisma/client'

export interface CreateLeadInput {
  orgId: string
  contactId: string
  companyName: string
  priority?: string
  notes?: string
  source?: string
  sourceDetails?: Prisma.InputJsonValue
  externalId?: string
  tags?: string[]
  createdById: string
}

/**
 * Creates a lead plus its NEW_LEAD checklist and initial timeline event, in
 * a single transaction. Shared by the authenticated POST /api/v1/leads route
 * and external ingestion webhooks (e.g. IndiaMART) so both paths stay in
 * sync on what "a new lead" means, instead of duplicating this logic.
 */
export async function createLeadWithDefaults(input: CreateLeadInput) {
  const now = new Date()
  const stage = 'New Lead'

  return prisma.$transaction(async (tx) => {
    // Auto-assignment (round-robin by capacity) when enabled in Settings
    const assignedToId = await pickAssignee(tx, input.orgId)

    const created = await tx.lead.create({
      data: {
        ...(assignedToId && { assignedToId, assignedAt: now }),
        orgId: input.orgId,
        contactId: input.contactId,
        companyName: input.companyName,
        priority: input.priority || 'Medium',
        notes: input.notes,
        source: input.source,
        sourceDetails: input.sourceDetails,
        externalId: input.externalId,
        tags: input.tags || [],
        stage,
        stageChangedAt: now,
        slaCreatedAt: now,
        slaDeadline: calculateSlaDeadline(stage, now),
        createdById: input.createdById,
      },
    })

    // SOP Step 1 checklists (Registration + Initial Contact) - the required
    // ones gate the lead from leaving "New Lead" until complete.
    await createSopChecklistsForStage(tx, created.id, stage)

    await tx.timeline.create({
      data: {
        leadId: created.id,
        events: {
          create: {
            type: 'lead_created',
            title: 'Lead created',
            description: `Lead created for ${input.companyName}`,
            createdBy: input.createdById,
          },
        },
      },
    })

    return created
  })
}
