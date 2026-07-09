import { prisma } from './db'
import { calculateSlaDeadline } from './workflow'
import { createSopChecklistsForStage } from './sop-checklists'
import { pickAssignee } from './auto-assign'
import { TERMINAL_STAGES } from './lead-stages'
import type { Prisma, Lead } from '@prisma/client'

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
  /** Explicit assignee (e.g. from an import row) — bypasses auto-assignment when set. */
  assignedToId?: string
}

export type CreateLeadResult =
  | { duplicate: false; lead: Lead }
  | {
      duplicate: true
      existingLead: {
        id: string
        companyName: string
        stage: string
        assignedTo: { fullName: string } | null
      }
    }

/**
 * Creates a lead plus its NEW_LEAD checklist and initial timeline event, in
 * a single transaction. Shared by the authenticated POST /api/v1/leads route
 * and external ingestion webhooks (e.g. IndiaMART) so both paths stay in
 * sync on what "a new lead" means, instead of duplicating this logic.
 *
 * Before creating, checks for an existing open lead with the same contactId.
 * If found, returns { duplicate: true, existingLead } instead of creating.
 */
export async function createLeadWithDefaults(input: CreateLeadInput): Promise<CreateLeadResult> {
  const now = new Date()
  const stage = 'New Lead'

  return prisma.$transaction(async (tx) => {
    // Duplicate check: if this contact already has an open lead in the org,
    // return the existing one instead of creating a second.
    const existingLead = await tx.lead.findFirst({
      where: {
        orgId: input.orgId,
        contactId: input.contactId,
        stage: { notIn: [...TERMINAL_STAGES] },
      },
      select: {
        id: true,
        companyName: true,
        stage: true,
        assignedTo: { select: { fullName: true } },
      },
    })

    if (existingLead) {
      return { duplicate: true, existingLead }
    }

    // Explicit assignee wins; otherwise fall back to auto-assignment
    // (round-robin by capacity) when enabled in Settings.
    const assignedToId =
      input.assignedToId ??
      (await pickAssignee(tx, input.orgId, {
        source: input.source,
        sourceDetails: input.sourceDetails,
        at: now,
      }))

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
        orgId: input.orgId,
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

    return { duplicate: false, lead: created }
  })
}
