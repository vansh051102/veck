// ============================================================================
// SOP CHECKLIST TEMPLATES (from PHASE1_SOP_INTEGRATED_PLAN.md)
// ============================================================================
// Each lead stage has mandatory checklists that are auto-created when the
// lead ENTERS that stage. Checklists with `isRequired: true` block the lead
// from leaving the stage until complete (enforced by lib/workflow.ts).
//
// Pure data + a helper that runs inside a Prisma transaction, so it is usable
// from both lead creation and the stage-change route.

import type { Prisma } from '@prisma/client'

export interface SopChecklistTemplate {
  title: string
  description: string
  isRequired: boolean
  items: string[]
}

export const SOP_CHECKLISTS_BY_STAGE: Record<string, SopChecklistTemplate[]> = {
  'New Lead': [
    {
      title: 'New Lead Registration Checklist',
      description: 'SOP Step 1: Initial Registration',
      isRequired: true,
      items: [
        'Customer Name Entered',
        'Company Name Entered',
        'Contact Number Entered',
        'Email ID Entered',
      ],
    },
    {
      title: 'Initial Contact Checklist',
      description: 'SOP Step 1: First Contact Actions',
      isRequired: true,
      items: [
        'Product Catalogue Sent',
        'Company Brochure Sent',
        'Introduction Message Sent',
        'Call Attempt #1 Made',
      ],
    },
  ],
  Contacted: [
    {
      title: 'Contacted Qualification Checklist',
      description: 'SOP Step 2: Full Requirement Qualification',
      isRequired: true,
      items: [
        // Customer
        'Customer Type Identified',
        'Decision Maker Identified',
        'Active Requirement Confirmed',
        // Requirement
        'Product Identified',
        'Application Identified',
        'Quantity Identified',
        'Delivery Location Identified',
        'Timeline Identified',
        // Specifications
        'Size Confirmed',
        'Thickness Confirmed',
        'Length Confirmed',
        'Diameter Confirmed (if applicable)',
        'Grade Confirmed (if applicable)',
        'Brand Confirmed (if applicable)',
        'Colour Confirmed (if applicable)',
        'Cutting Requirement Confirmed',
        'Punching Requirement Confirmed',
        'Special Requirements Recorded',
        // Commercial
        'Transportation Requirement Understood',
        'Payment Expectation Understood',
        'Credit Requirement Understood',
        'Approximate Budget Discussed',
      ],
    },
    {
      title: 'Lead Validation Checklist',
      description: 'SOP Step 2: Validation Before Qualification',
      isRequired: true,
      items: [
        'Serviceable Location',
        'Viable Quantity',
        'Product Supplied by VECK',
        'Genuine Requirement',
        'Commercially Viable Opportunity',
      ],
    },
  ],
  Qualified: [
    {
      title: 'Qualified Checklist',
      description: 'SOP Step 3: Handover to Purchase & Quotation',
      isRequired: true,
      items: [
        // Customer
        'Customer Details Verified',
        'Delivery Location Confirmed',
        // Requirement
        'Product Confirmed',
        'Specifications Complete',
        'Quantity Confirmed',
        'Special Requirements Recorded',
        // Commercial
        'Timeline Confirmed',
        'Transportation Requirement Confirmed',
        'Payment Expectation Understood',
        'Target Margin Communicated',
        // Purchase
        'Complete Enquiry Shared with Purchase',
        'Purchase Acknowledged',
        'SLA Tracked',
        // Quotation
        'Quotation Verified',
        'Quotation Sent',
        'Customer Called',
        'CRM Updated',
      ],
    },
  ],
  'Quote Sent': [
    {
      title: 'Quote Sent Checklist',
      description: 'SOP Step 4: Follow-up Until Decision',
      // Not required: Quote Sent exits to terminal stages (Closed Won /
      // Deal Lost), and the loss path must never be blocked by a checklist.
      isRequired: false,
      items: [
        'Quotation Sent',
        'Customer Called',
        'Receipt Confirmed',
        'Customer Feedback Collected',
        'Expected Decision Date Recorded',
        'Objections Recorded',
        'Daily Follow-up Completed',
        'Escalation Completed (if required)',
        'Final Outcome Recorded',
        'Deal Lost Reason Selected (if applicable)',
      ],
    },
  ],
}

/**
 * Creates the SOP checklists for a stage the lead just entered. Skips any
 * checklist (by title) that already exists on the lead, so re-entering a
 * stage or racing requests never duplicate checklists.
 */
export async function createSopChecklistsForStage(
  tx: Prisma.TransactionClient,
  leadId: string,
  stage: string
): Promise<void> {
  const templates = SOP_CHECKLISTS_BY_STAGE[stage]
  if (!templates || templates.length === 0) return

  const existing = await tx.checklist.findMany({
    where: { leadId, title: { in: templates.map((t) => t.title) } },
    select: { title: true },
  })
  const existingTitles = new Set(existing.map((c) => c.title))

  for (const template of templates) {
    if (existingTitles.has(template.title)) continue
    await tx.checklist.create({
      data: {
        leadId,
        title: template.title,
        description: template.description,
        isRequired: template.isRequired,
        items: { create: template.items.map((title) => ({ title })) },
      },
    })
  }
}
