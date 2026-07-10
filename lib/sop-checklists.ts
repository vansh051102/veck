// ============================================================================
// SOP CHECKLIST TEMPLATES
// ============================================================================
// Sales Order Management, Marketing Telecaller, and Purchase procurement SOPs.
// Required checklists block leaving a stage (enforced by assertRequiredChecklistsComplete).
// Role-aware templates: marketing gets a lighter New Lead / Contacted set;
// sales/admin get the full sales SOP; purchase stages get procurement checklists.

import type { Prisma } from '@prisma/client'
import { ValidationError } from './api-response'

export interface SopChecklistTemplate {
  title: string
  description: string
  isRequired: boolean
  items: string[]
}

/** Full Sales Order Management SOP (default for sales / admin / dual role). */
export const SALES_SOP_CHECKLISTS: Record<string, SopChecklistTemplate[]> = {
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
        'City / Location Entered',
        'Lead Source Entered',
        'Date & Time Received Entered',
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
        'Call Outcome Recorded',
      ],
    },
  ],
  Contacted: [
    {
      title: 'Contacted Qualification Checklist',
      description: 'SOP Step 2: Full Requirement Qualification',
      isRequired: true,
      items: [
        'Customer Type Identified',
        'Decision Maker Identified',
        'Active Requirement Confirmed',
        'Product Identified',
        'Application Identified',
        'Quantity Identified',
        'Delivery Location Identified',
        'Timeline Identified',
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
        'Customer Details Verified',
        'Delivery Location Confirmed',
        'Product Confirmed',
        'Specifications Complete',
        'Quantity Confirmed',
        'Special Requirements Recorded',
        'Timeline Confirmed',
        'Transportation Requirement Confirmed',
        'Payment Expectation Understood',
        'Target Margin Communicated',
        'Complete Enquiry Shared with Purchase',
        'Purchase Acknowledged',
        'SLA Tracked',
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
      isRequired: false,
      items: [
        'Quotation Sent',
        'Customer Called',
        'Receipt Confirmed',
        'Customer Feedback Collected',
        'Competitor Information Collected (if applicable)',
        'Expected Decision Date Recorded',
        'Objections Recorded',
        'CRM Updated',
        'Daily Follow-up Completed',
        'Escalation Completed (if required)',
        'Final Outcome Recorded',
        'Deal Lost Reason Selected (if applicable)',
      ],
    },
  ],
  'Order Confirmed': [
    {
      title: 'Order Registration Checklist',
      description: 'Post-order Phase 1: Order Registration',
      isRequired: true,
      items: [
        'Order Recorded',
        'Customer Details Verified',
        'Material Recorded',
        'Order Number Recorded',
        'Invoice Number Recorded (when generated)',
        'Invoice Value Recorded',
        'Margin Recorded',
        'Advance Recorded',
        'Accounts Confirmation Received',
      ],
    },
    {
      title: 'Customer Coordination Checklist',
      description: 'Post-order Phase 2: Customer Coordination',
      isRequired: true,
      items: [
        'WhatsApp Group Created',
        'Group Name Confirmed',
        'Group DP Updated',
        'Customer Expectations Recorded',
        'Billing Address Verified',
        'Delivery Address Verified',
        'Delivery Location Verified',
        'Transportation Terms Confirmed',
        'Freight Terms Confirmed',
        'Test Certificate Requirement Confirmed',
        'Payment Mode Confirmed',
        'Payment Terms Explained',
        'Dispatch After Full Payment Explained',
        'Customer Acknowledgement Received',
        'Delivery Date Confirmed',
        'PI Verified',
        'CRM Updated',
      ],
    },
    {
      title: 'Pre-Dispatch & Dispatch Checklist',
      description: 'Post-order Phases 3–4: Pre-dispatch and Dispatch',
      isRequired: true,
      items: [
        'One Day Prior Follow-up Completed',
        'Unloading Readiness Confirmed',
        'Balance Payment Reminder Sent',
        'Approximate Invoice Value Shared',
        'Approximate Delivery Time Shared',
        'Vehicle Booking Requested',
        'Dummy Invoice Sent',
        'Vehicle Photo Sent',
        'Test Certificate Sent',
        'Weighment Slip Sent',
        'Balance Payment Received',
        'Accounts Confirmed Payment',
        'Tax Invoice Generated',
        'Driver Number Shared',
        'Dispatch Approved',
        'Full Payment Collected Before Dispatch',
      ],
    },
    {
      title: 'Delivery & Closure Checklist',
      description: 'Post-order Phases 5–6: Delivery and Order Closure',
      isRequired: true,
      items: [
        'Delivery Confirmed',
        'Google Review Requested',
        'Google Review Received',
        'Complaint Recorded (if applicable)',
        'Complaint Resolved (if applicable)',
        'Delay Recorded (if applicable)',
        'Reason for Delay Recorded (if applicable)',
        'CRM Closed',
      ],
    },
  ],
  'Order Closed': [],
}

/** Marketing Telecaller / Lead Generation SOP (lighter intake). */
export const MARKETING_SOP_CHECKLISTS: Record<string, SopChecklistTemplate[]> = {
  'New Lead': [
    {
      title: 'New Lead Checklist',
      description: 'Marketing SOP Step 1: First Contact',
      isRequired: true,
      items: [
        'Lead Entered in CRM',
        'Initial Call Made',
        'Company Introduction Given',
        'Customer Business Verified',
        'CRM Updated',
        'Outcome Recorded',
      ],
    },
  ],
  Contacted: [
    {
      title: 'Contacted Checklist',
      description: 'Marketing SOP Step 2: Qualification',
      isRequired: true,
      items: [
        'Customer Type Identified',
        'Decision Maker Identified (if available)',
        'Genuine Requirement Confirmed',
        'Product Identified',
        'Application Identified',
        'Approximate Quantity Collected',
        'Delivery Location Recorded',
        'Timeline Recorded',
        'Size Collected',
        'Thickness Collected',
        'Length Collected',
        'Diameter Collected (if applicable)',
        'Grade Collected (if applicable)',
        'Brand Preference Recorded',
        'Colour Preference Recorded',
        'Cutting Requirement Recorded',
        'Punching Requirement Recorded',
        'CRM Updated',
        'Follow-up Date Recorded',
      ],
    },
  ],
  Qualified: [
    {
      title: 'Qualified Handover Checklist',
      description: 'Marketing SOP Step 3: Assign to Sales',
      isRequired: true,
      items: [
        'Customer Details Complete',
        'Contact Information Verified',
        'Product Confirmed',
        'Specifications Collected',
        'Quantity Recorded',
        'Delivery Location Recorded',
        'Timeline Recorded',
        'Sales Executive Assigned',
        'Requirement Explained',
        'Special Notes Shared',
        'Urgency Communicated',
        'Customer Expectations Shared',
        'CRM Updated',
        'Ownership Transferred',
      ],
    },
  ],
}

/** Purchase Order Procurement SOP (post Order Confirmed). */
export const PURCHASE_SOP_CHECKLISTS: Record<string, SopChecklistTemplate[]> = {
  Qualified: [
    {
      title: 'Purchase Quotation Checklist',
      description: 'Purchase: Pricing handoff at Qualified',
      isRequired: true,
      items: [
        'Enquiry Details Reviewed',
        'Specifications Verified',
        'Vendor Options Identified',
        'Pricing Prepared',
        'Margin Confirmed',
        'Quotation Ready for Sales',
      ],
    },
  ],
  'Order Confirmed': [
    {
      title: 'Purchase Order Review Checklist',
      description: 'Purchase Phase 1: Order Received',
      isRequired: true,
      items: [
        'Order Number Recorded',
        'Order Date Recorded',
        'Customer Recorded',
        'Material Confirmed',
        'Quantity Confirmed',
        'UOM Confirmed',
        'Order Priority Recorded',
        'Supplier Identified',
        '3 Vendor Comparison Completed',
        'Negotiation Completed',
        'Supplier Called Before PO',
        'Material Availability Confirmed',
        'Material Specification Verified',
        'Quantity Verified',
        'Loading Point Confirmed',
        'Purchase Supplier Finalised',
        'Owner Approval Received (if required)',
        'PO Generated Same Day',
        'PO Acknowledged',
        'PO Filed',
        'Sales Informed',
        'Planning Informed',
        'Handover Completed',
        'Cutting Requirement Confirmed',
        'Bending Charges Confirmed',
        'Punching Requirement Confirmed',
        'Handling Charges Confirmed',
        'Other Charges Confirmed',
      ],
    },
    {
      title: 'Purchase Pre-Dispatch Checklist',
      description: 'Purchase Phase 2: Pre-Dispatch',
      isRequired: true,
      items: [
        'Material Availability Reconfirmed',
        'Quantity Reconfirmed',
        'Dispatch Readiness Reconfirmed',
        'Loading Schedule Reconfirmed',
        'Planning Informed of Changes',
        'Sales Informed of Delays (if any)',
      ],
    },
    {
      title: 'Purchase Dispatch Verification Checklist',
      description: 'Purchase Phase 3: Dispatch Day',
      isRequired: true,
      items: [
        'Supplier Invoice Verified',
        'Supplier Invoice Matched with PO',
        'Material Matches PO',
        'Quantity Matches PO',
        'Specifications Match PO',
        'Additional Charges Match PO',
      ],
    },
    {
      title: 'Purchase Closure Checklist',
      description: 'Purchase Phase 4: Post Dispatch / Closure',
      isRequired: false,
      items: [
        'Purchase Status Updated',
        'Pending Actions Recorded',
        'Remarks Updated',
        'Vendor Performance Reviewed',
        'Procurement Closed',
      ],
    },
  ],
}

/** Default (sales) map — used when role is unknown / admin creating checklists. */
export const SOP_CHECKLISTS_BY_STAGE: Record<string, SopChecklistTemplate[]> = SALES_SOP_CHECKLISTS

export function sopTrackForRole(role: string): 'marketing' | 'purchase' | 'sales' {
  if (role.startsWith('marketing')) return 'marketing'
  if (role === 'purchase') return 'purchase'
  return 'sales'
}

/**
 * Templates for the stage being entered, based on who is performing the transition.
 * - Marketing: telecaller set
 * - Order Confirmed: always merge sales post-order + purchase procurement
 *   (both teams own that stage)
 * - Purchase on Qualified: purchase quotation checklist
 * - Otherwise: sales SOP
 */
export function getSopChecklistsForStage(
  stage: string,
  role?: string
): SopChecklistTemplate[] {
  const track = role ? sopTrackForRole(role) : 'sales'

  if (track === 'marketing') {
    return MARKETING_SOP_CHECKLISTS[stage] ?? []
  }

  if (stage === 'Order Confirmed') {
    return [
      ...(SALES_SOP_CHECKLISTS['Order Confirmed'] ?? []),
      ...(PURCHASE_SOP_CHECKLISTS['Order Confirmed'] ?? []),
    ]
  }

  if (track === 'purchase') {
    return PURCHASE_SOP_CHECKLISTS[stage] ?? SALES_SOP_CHECKLISTS[stage] ?? []
  }

  return SALES_SOP_CHECKLISTS[stage] ?? []
}

/**
 * Creates the SOP checklists for a stage the lead just entered. Skips any
 * checklist (by title) that already exists on the lead, so re-entering a
 * stage or racing requests never duplicate checklists.
 */
export async function createSopChecklistsForStage(
  tx: Prisma.TransactionClient,
  leadId: string,
  stage: string,
  role?: string
): Promise<void> {
  const templates = getSopChecklistsForStage(stage, role)
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

/**
 * Blocks leaving `fromStage` when any required checklist for that stage is incomplete.
 * Loss paths (Deal Lost / Disqualified) are never blocked.
 * Checks titles from all SOP tracks (sales/marketing/purchase) so whichever
 * set was created for the lead is enforced.
 */
export async function assertRequiredChecklistsComplete(
  tx: Prisma.TransactionClient | typeof import('./db').prisma,
  leadId: string,
  fromStage: string,
  toStage: string
): Promise<void> {
  if (toStage === 'Deal Lost' || toStage === 'Disqualified') return

  const titlesForStage = new Set(
    [
      ...(SALES_SOP_CHECKLISTS[fromStage] ?? []),
      ...(MARKETING_SOP_CHECKLISTS[fromStage] ?? []),
      ...(PURCHASE_SOP_CHECKLISTS[fromStage] ?? []),
    ]
      .filter((t) => t.isRequired)
      .map((t) => t.title)
  )
  if (titlesForStage.size === 0) return

  const incomplete = await tx.checklist.findMany({
    where: {
      leadId,
      isRequired: true,
      title: { in: [...titlesForStage] },
      completedAt: null,
    },
    select: {
      title: true,
      items: { where: { completed: false }, select: { title: true } },
    },
  })

  const blocking = incomplete.filter((c) => c.items.length > 0)
  if (blocking.length === 0) return

  const titles = blocking.map((c) => c.title).join('; ')
  throw new ValidationError(
    `Complete required checklist(s) before leaving "${fromStage}": ${titles}`
  )
}
