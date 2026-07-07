# PHASE 1: CRM & SALES - SOP Integrated Implementation Plan

**Timeline:** Week 3-8 (6 weeks)  
**Status:** Ready to Start  
**Repository:** https://github.com/vansh051102/veck  
**Alignment:** VECK Sales SOP (4-Step Process)

---

## 📋 Executive Summary

Phase 1 builds a CRM system that **enforces the VECK Sales SOP** through automated workflows, mandatory checklists, and structured processes. The system ensures no lead falls through the cracks and every sales rep follows the exact process defined in the SOP.

**VECK Sales Process:**
1. **NEW LEAD** → Initial contact + registration
2. **CONTACTED** → Qualification + requirement collection  
3. **QUALIFIED** → Complete info + handover to purchase
4. **QUOTE SENT** → Daily follow-up until order or deal lost

---

## 🏗️ SOP-Aligned Architecture

```
┌─────────────────────────────────────────────────────────┐
│         VECK CRM - SOP ENFORCEMENT SYSTEM              │
├─────────────────────────────────────────────────────────┤
│
│  SOP Workflow Engine
│  ├─ Step 1: NEW LEAD (Register & Initial Contact)
│  ├─ Step 2: CONTACTED (Qualification & Requirements)
│  ├─ Step 3: QUALIFIED (Complete Info & Handover)
│  ├─ Step 4: QUOTE SENT (Follow-up & Closure)
│  └─ Post-Order: ORDER EXECUTION (Phase 2+)
│
│  Mandatory Checklists (SOP Checklists)
│  ├─ Step 1 Checklist (4 items)
│  ├─ Step 2 Checklist (20 items)
│  ├─ Step 3 Checklist (14 items)
│  ├─ Step 4 Checklist (10 items)
│  └─ Automated enforcement (block stage progression)
│
│  Activity Tracking (SOP Requirements)
│  ├─ Call Attempts (tracked per step)
│  ├─ WhatsApp Messages (tracked per step)
│  ├─ Email Follow-ups (tracked per step)
│  └─ Activity timeline (complete history)
│
│  SLA & Follow-up Engine
│  ├─ Step 1: Response within 1 hour
│  ├─ Step 2: Response within 24 hours
│  ├─ Step 3: Quote within 3 hours
│  ├─ Step 4: Daily follow-up for 6 days
│  └─ Breach alerts & escalations
│
│  Mandatory Fields Per Step
│  ├─ Step 1: Name, Company, Phone, Email, Source
│  ├─ Step 2: Customer Type, Decision Maker, Specs
│  ├─ Step 3: Complete Specs, Delivery, Timeline
│  └─ Step 4: Quotation, Follow-up Status
│
│  Exit Criteria Enforcement
│  ├─ NEW LEAD → CONTACTED: Customer responds
│  ├─ CONTACTED → QUALIFIED: All specs collected
│  ├─ QUALIFIED → QUOTE SENT: Quote generated
│  ├─ QUOTE SENT → ORDER CONFIRMED: Payment received
│  └─ Any Stage → DISQUALIFIED: SOP criteria met
│
└─────────────────────────────────────────────────────────┘
```

---

## 📅 Week-by-Week Breakdown

### Week 3: SOP Model Design & Step 1 (NEW LEAD) API

#### Task 1: Design SOP Data Models

**File:** `lib/sop-models.ts`

```typescript
// lib/sop-models.ts

// Define SOP Steps
export const SOP_STEPS = {
  NEW_LEAD: {
    name: 'NEW LEAD',
    stepNumber: 1,
    description: 'Initial contact with prospect',
    requiredChecklist: 'New Lead Registration Checklist',
    minActivitiesRequired: 1, // At least 1 call attempt
    slaHours: 1, // Response within 1 hour
    nextSteps: ['CONTACTED', 'DISQUALIFIED'],
    allowedExitReasons: {
      DISQUALIFIED: [
        '3 Call Attempts Failed',
        'Wrong Number',
        'Invalid Contact',
        'No Response'
      ]
    }
  },
  CONTACTED: {
    name: 'CONTACTED',
    stepNumber: 2,
    description: 'Qualify customer and collect requirements',
    requiredChecklist: 'Contacted Qualification Checklist',
    minActivitiesRequired: 3, // Min 3 interactions
    slaHours: 24,
    nextSteps: ['QUALIFIED', 'DISQUALIFIED'],
    allowedExitReasons: {
      DISQUALIFIED: [
        '3 Call Attempts Completed',
        '3 WhatsApp Messages Sent',
        'No Response',
        'Location Not Serviceable',
        'Quantity Too Small',
        'Product Not Supplied',
        'Credit Requirement Unacceptable',
        'Timeline Not Acceptable',
        'Traded / Rate Shopping',
        'Competitor Enquiry',
        'Not Commercially Viable',
        'Project Cancelled',
        'Purchased Elsewhere'
      ]
    }
  },
  QUALIFIED: {
    name: 'QUALIFIED',
    stepNumber: 3,
    description: 'Complete info and handover to purchase',
    requiredChecklist: 'Qualified Checklist',
    minActivitiesRequired: 1, // Communication with purchase
    slaHours: 3, // Quote within 3 hours
    nextSteps: ['QUOTE_SENT', 'DISQUALIFIED'],
    allowedExitReasons: {
      DISQUALIFIED: [
        'Product Cannot Be Sourced',
        'Outside Company Scope',
        'No Vendor Solution',
        'Technically Unserviceable'
      ]
    }
  },
  QUOTE_SENT: {
    name: 'QUOTE SENT',
    stepNumber: 4,
    description: 'Daily follow-up until order or deal lost',
    requiredChecklist: 'Quote Sent Checklist',
    minActivitiesRequired: 6, // Min 6 interactions (calls + WhatsApp)
    slaHours: 24, // Daily follow-ups
    nextSteps: ['ORDER_CONFIRMED', 'DEAL_LOST'],
    allowedExitReasons: {
      DEAL_LOST: [
        'Purchased Elsewhere',
        'No Requirement',
        'Project Cancelled',
        'Price Not Accepted',
        'Delivery Timeline Not Accepted',
        'Payment Terms Not Accepted',
        'Product Not Suitable',
        'No Response (6+ calls/WhatsApp)',
        'Requirement Postponed',
        'Budget Issue',
        'Credit Requirement Issue',
        'Dormant'
      ]
    }
  }
}

// Define SOP Checklists
export const SOP_CHECKLISTS = {
  'New Lead Registration Checklist': {
    step: 'NEW_LEAD',
    items: [
      'Customer Name Entered',
      'Company Name Entered',
      'Contact Number Entered',
      'Email ID Entered'
    ],
    isRequired: true,
    blockProgression: true
  },
  'Initial Contact Checklist': {
    step: 'NEW_LEAD',
    items: [
      'Product Catalogue Sent',
      'Company Brochure Sent',
      'Introduction Message Sent',
      'Call Attempt #1 Made'
    ],
    isRequired: true,
    blockProgression: false
  },
  'Contacted Qualification Checklist': {
    step: 'CONTACTED',
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
      'Approximate Budget Discussed'
    ],
    isRequired: true,
    blockProgression: true
  },
  'Lead Validation Checklist': {
    step: 'CONTACTED',
    items: [
      'Serviceable Location',
      'Viable Quantity',
      'Product Supplied by VECK',
      'Genuine Requirement',
      'Commercially Viable Opportunity'
    ],
    isRequired: true,
    blockProgression: true
  },
  'Qualified Checklist': {
    step: 'QUALIFIED',
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
      'CRM Updated'
    ],
    isRequired: true,
    blockProgression: true
  },
  'Quote Sent Checklist': {
    step: 'QUOTE_SENT',
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
      'Deal Lost Reason Selected (if applicable)'
    ],
    isRequired: true,
    blockProgression: false
  }
}
```

#### Task 2: Implement Step 1 API Endpoints

**Files:** 
- `app/api/v1/leads/route.ts` - Create lead (Step 1)
- `app/api/v1/leads/[id]/activities/route.ts` - Log activities
- `app/api/v1/leads/[id]/step-1/checklist/route.ts` - Get Step 1 checklist

**Step 1: NEW LEAD - API Implementation**

```typescript
// app/api/v1/leads/route.ts

import { SOP_STEPS, SOP_CHECKLISTS } from '@/lib/sop-models'
import { CreateLeadSchema } from '@/lib/validation'
import { withErrorHandler, successResponse, ValidationError, UnauthorizedError } from '@/lib/api-response'
import { logAudit } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// SOP Step 1: NEW LEAD
// SLA: Response within 1 hour
// Activities: Initial contact (call, WhatsApp, email)

export const POST = withErrorHandler(async (req) => {
  const { orgId, userId } = extractOrgAndUserIds(req.headers) || {}
  if (!orgId || !userId) throw new UnauthorizedError()

  const body = await req.json()

  // Validate: Step 1 requires basic info
  const Step1Schema = z.object({
    firstName: z.string().min(1, 'First name required'),
    lastName: z.string().min(1, 'Last name required'),
    email: z.string().email('Invalid email'),
    phone: z.string().regex(/^\+?[0-9\-\s()]+$/, 'Invalid phone'),
    companyName: z.string().min(1, 'Company name required'),
    source: z.enum([
      'WhatsApp', 'Phone Call', 'Email', 'Website', 'IndiaMART', 
      'Reference', 'Social Media', 'Other'
    ]),
    city: z.string(),
    notes: z.string().optional()
  })

  const validation = Step1Schema.safeParse(body)
  if (!validation.success) {
    throw new ValidationError('Invalid input', validation.error.errors)
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    companyName,
    source,
    city,
    notes
  } = validation.data

  // Step 1: Create Contact
  const contact = await prisma.contact.upsert({
    where: { email },
    update: {},
    create: {
      orgId,
      firstName,
      lastName,
      email,
      phone,
      source,
      createdById: userId
    }
  })

  // Step 1: Create Lead in NEW_LEAD stage
  const sopStep = SOP_STEPS.NEW_LEAD
  const slaDeadline = new Date()
  slaDeadline.setHours(slaDeadline.getHours() + sopStep.slaHours) // 1 hour

  const lead = await prisma.lead.create({
    data: {
      orgId,
      contactId: contact.id,
      companyName,
      stage: 'New Lead', // Maps to NEW_LEAD
      stageChangedAt: new Date(),
      priority: 'Medium',
      source,
      notes,
      slaDeadline,
      createdById: userId,
      // SOP-specific fields
      customFields: {
        sopStep: 'NEW_LEAD',
        sopStatus: 'Step 1: Initial Contact',
        dateReceived: new Date(),
        location: city,
        callAttempts: 0,
        whatsappAttempts: 0,
        emailAttempts: 0
      }
    },
    include: { contact: true }
  })

  // Step 1: Create Timeline entry
  const timeline = await prisma.timeline.create({
    data: {
      leadId: lead.id,
      contactId: contact.id
    }
  })

  await prisma.timelineEvent.create({
    data: {
      timelineId: timeline.id,
      type: 'lead_created',
      title: 'Lead Created - Step 1: NEW LEAD',
      description: `Lead registered for ${companyName} from source: ${source}`,
      metadata: {
        sopStep: 'NEW_LEAD',
        source,
        city
      },
      createdBy: userId
    }
  })

  // Step 1: Create mandatory checklists
  const newLeadChecklistDef = SOP_CHECKLISTS['New Lead Registration Checklist']
  const newLeadChecklist = await prisma.checklist.create({
    data: {
      leadId: lead.id,
      title: 'New Lead Registration Checklist',
      description: 'SOP Step 1: Initial Registration',
      isRequired: true,
      items: {
        create: newLeadChecklistDef.items.map(item => ({
          title: item
        }))
      }
    }
  })

  const initialContactChecklistDef = SOP_CHECKLISTS['Initial Contact Checklist']
  const initialContactChecklist = await prisma.checklist.create({
    data: {
      leadId: lead.id,
      title: 'Initial Contact Checklist',
      description: 'SOP Step 1: First Contact Actions',
      isRequired: true,
      items: {
        create: initialContactChecklistDef.items.map(item => ({
          title: item
        }))
      }
    }
  })

  // Step 1: Log audit
  await logAudit(
    orgId,
    userId,
    'created',
    'lead',
    lead.id,
    companyName,
    { 
      new: lead,
      sop: 'NEW_LEAD Step 1'
    }
  )

  return successResponse(
    {
      lead: {
        id: lead.id,
        companyName: lead.companyName,
        stage: lead.stage,
        contact: contact,
        slaDeadline: lead.slaDeadline,
        customFields: lead.customFields
      },
      checklists: [
        {
          id: newLeadChecklist.id,
          title: 'New Lead Registration Checklist',
          itemCount: newLeadChecklistDef.items.length,
          isRequired: true,
          blockProgression: true
        },
        {
          id: initialContactChecklist.id,
          title: 'Initial Contact Checklist',
          itemCount: initialContactChecklistDef.items.length,
          isRequired: true,
          blockProgression: false
        }
      ],
      message: 'Lead registered. Step 1: NEW LEAD. SLA: Response within 1 hour'
    },
    { statusCode: 201 }
  )
})

// List leads with SOP step filtering
export const GET = withErrorHandler(async (req) => {
  const { orgId } = extractOrgAndUserIds(req.headers) || {}
  if (!orgId) throw new UnauthorizedError()

  const url = new URL(req.url)
  const sopStep = url.searchParams.get('sopStep') // Filter by step
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  const where: any = { orgId }
  if (sopStep) {
    where.customFields = {
      path: ['sopStep'],
      equals: sopStep
    }
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { contact: true },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' }
  })

  const total = await prisma.lead.count({ where })

  return paginatedResponse(
    leads.map(lead => ({
      ...lead,
      sopStep: lead.customFields?.sopStep || 'UNKNOWN'
    })),
    { page, limit, total, totalPages: Math.ceil(total / limit) }
  )
})
```

#### Task 3: Activity Tracking for Step 1

**File:** `app/api/v1/leads/[id]/activities/route.ts`

```typescript
// Step 1: Track initial contact activities
// Required: Call attempt, WhatsApp, Email

export const POST = withErrorHandler(async (req) => {
  const { orgId, userId } = extractOrgAndUserIds(req.headers) || {}
  if (!orgId || !userId) throw new UnauthorizedError()

  const { id: leadId } = req.params
  const body = await req.json()

  // Get lead to check SOP step
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { contact: true }
  })

  if (!lead) throw new NotFoundError('Lead')
  if (lead.orgId !== orgId) throw new ForbiddenError()

  // Step 1 Activity Types
  const Step1ActivitySchema = z.object({
    type: z.enum(['call', 'whatsapp', 'email']),
    title: z.string(),
    status: z.enum(['connected', 'busy', 'not_reachable', 'switched_off', 'no_answer', 'wrong_number', 'sent', 'received']),
    metadata: z.record(z.any()).optional(),
    notes: z.string().optional()
  })

  const validation = Step1ActivitySchema.safeParse(body)
  if (!validation.success) {
    throw new ValidationError('Invalid activity for Step 1', validation.error.errors)
  }

  const { type, title, status, metadata, notes } = validation.data

  // Create activity
  const activity = await prisma.activity.create({
    data: {
      leadId,
      orgId,
      type,
      title,
      description: notes,
      status: status === 'connected' || status === 'received' ? 'completed' : 'pending',
      metadata: { 
        ...metadata, 
        stepAtCreation: 'NEW_LEAD',
        contactStatus: status
      },
      createdBy: userId
    }
  })

  // Update lead's activity counters
  const customFields = lead.customFields as any || {}
  const countKey = `${type}Attempts`
  customFields[countKey] = (customFields[countKey] || 0) + 1
  customFields.lastActivityType = type
  customFields.lastActivityStatus = status

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      lastActivityAt: new Date(),
      customFields
    }
  })

  // Create timeline event for Step 1
  if (lead.timeline) {
    const activityLabel = `${type.charAt(0).toUpperCase() + type.slice(1)} - ${status}`
    await prisma.timelineEvent.create({
      data: {
        timelineId: lead.timeline.id,
        type: 'activity_added',
        title: `Step 1: ${activityLabel}`,
        description: title,
        metadata: { 
          activityId: activity.id, 
          activityType: type,
          contactStatus: status,
          sopStep: 'NEW_LEAD'
        },
        createdBy: userId
      }
    })
  }

  // Step 1 Logic: If customer responds, suggest moving to CONTACTED
  const customerResponded = ['connected', 'received'].includes(status)
  
  if (customerResponded) {
    return successResponse(
      {
        activity,
        message: `Step 1 Activity logged: ${type} - ${status}. Customer is responsive. Next: Move to CONTACTED (Step 2).`,
        nextAction: 'PROCEED_TO_CONTACTED'
      },
      { statusCode: 201 }
    )
  }

  // Step 1 Logic: Track failed attempts
  const totalAttempts = (customFields.callAttempts || 0) + 
                       (customFields.whatsappAttempts || 0) + 
                       (customFields.emailAttempts || 0)

  if (totalAttempts >= 3 && !customerResponded) {
    return successResponse(
      {
        activity,
        message: `Step 1 Activity logged: ${type} - ${status}. 3 attempts completed without response. Next: Move to DISQUALIFIED.`,
        nextAction: 'DISQUALIFY_UNRESPONSIVE'
      },
      { statusCode: 201 }
    )
  }

  return successResponse(
    {
      activity,
      message: `Step 1 Activity logged: ${type} - ${status}. Continue follow-ups.`,
      attemptsRemaining: 3 - totalAttempts
    },
    { statusCode: 201 }
  )
})
```

#### Task 4: Step 1 Transition Logic

**File:** `lib/sop-transitions.ts`

```typescript
// lib/sop-transitions.ts

import { SOP_STEPS } from './sop-models'

export async function validateStep1Transition(
  leadId: string,
  currentStage: string,
  newStage: string,
  orgId: string
) {
  if (currentStage !== 'New Lead') {
    return { allowed: false, reason: 'Not in NEW_LEAD step' }
  }

  // Step 1: Can only move to CONTACTED or DISQUALIFIED
  if (!['Contacted', 'Disqualified'].includes(newStage)) {
    return {
      allowed: false,
      reason: 'From NEW_LEAD can only move to CONTACTED or DISQUALIFIED'
    }
  }

  if (newStage === 'Contacted') {
    // Requirement: Customer must have responded
    const lead = await prisma.lead.findUnique({
      where: { id: leadId }
    })

    const customFields = lead?.customFields as any || {}
    const hasResponse = customFields.customerResponded === true

    if (!hasResponse) {
      return {
        allowed: false,
        reason: 'Customer must respond via Call/WhatsApp/Email before moving to CONTACTED'
      }
    }
  }

  if (newStage === 'Disqualified') {
    // Requirement: All Step 1 criteria met
    const lead = await prisma.lead.findUnique({
      where: { id: leadId }
    })

    const customFields = lead?.customFields as any || {}
    const totalAttempts = (customFields.callAttempts || 0) + 
                         (customFields.whatsappAttempts || 0) + 
                         (customFields.emailAttempts || 0)

    if (totalAttempts < 3) {
      return {
        allowed: false,
        reason: 'Must complete 3 contact attempts before disqualifying'
      }
    }
  }

  return { allowed: true }
}

export async function transitionLeadStep(
  leadId: string,
  currentStage: string,
  newStage: string,
  reason: string,
  orgId: string,
  userId: string
) {
  // Validate transition
  const validation = await validateStep1Transition(leadId, currentStage, newStage, orgId)
  
  if (!validation.allowed) {
    throw new AppError('TRANSITION_BLOCKED', 400, validation.reason)
  }

  // Get current lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { timeline: true }
  })

  if (!lead) throw new NotFoundError('Lead')

  // Update lead
  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage: newStage,
      stageChangedAt: new Date(),
      stageChangedBy: userId,
      customFields: {
        ...lead.customFields,
        sopStep: newStage === 'Contacted' ? 'CONTACTED' : 'DISQUALIFIED',
        previousStep: 'NEW_LEAD',
        transitionReason: reason,
        transitionDate: new Date()
      }
    }
  })

  // Create timeline event
  if (lead.timeline) {
    await prisma.timelineEvent.create({
      data: {
        timelineId: lead.timeline.id,
        type: 'stage_changed',
        title: `Step Progression: NEW_LEAD → ${newStage}`,
        description: `Moved from Step 1 to ${newStage}. Reason: ${reason}`,
        metadata: {
          fromStage: currentStage,
          toStage: newStage,
          reason,
          sopProgression: `Step 1 → Step ${newStage === 'Contacted' ? 2 : 'Disqualified'}`
        },
        createdBy: userId
      }
    })
  }

  // Log audit
  await logAudit(
    orgId,
    userId,
    'updated',
    'lead',
    leadId,
    `Transitioned from ${currentStage} to ${newStage}`,
    { 
      from: currentStage,
      to: newStage,
      reason,
      sopStep: 'NEW_LEAD → Next'
    }
  )

  return updatedLead
}
```

---

### Week 4: Step 2 (CONTACTED) Implementation

#### Task 1: Step 2 Checklist & Validation

**Step 2: CONTACTED - Qualification Requirements**

The system must enforce the **20-item Contacted Qualification Checklist** before allowing progression to QUALIFIED.

```typescript
// app/api/v1/leads/[id]/step-2/validate/route.ts

export const POST = withErrorHandler(async (req) => {
  const { orgId, userId } = extractOrgAndUserIds(req.headers) || {}
  const { id: leadId } = req.params

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { 
      checklists: true,
      activities: true
    }
  })

  if (!lead || lead.stage !== 'Contacted') {
    throw new ValidationError('Lead not in CONTACTED stage')
  }

  // Get CONTACTED Qualification Checklist
  const contactedChecklist = await prisma.checklist.findFirst({
    where: {
      leadId,
      title: 'Contacted Qualification Checklist'
    },
    include: { items: true }
  })

  if (!contactedChecklist) {
    throw new NotFoundError('Contacted Qualification Checklist')
  }

  // Check completion status
  const totalItems = contactedChecklist.items.length
  const completedItems = contactedChecklist.items.filter(i => i.completed).length
  const incompleteItems = contactedChecklist.items.filter(i => !i.completed)

  // Step 2: SOP Requirement - All 20 items must be completed
  const isCompleted = completedItems === totalItems

  if (!isCompleted) {
    return successResponse(
      {
        stage: 'Contacted',
        status: 'INCOMPLETE',
        completionPercentage: (completedItems / totalItems) * 100,
        completedItems,
        totalItems,
        incompleteItems: incompleteItems.map(i => i.title),
        message: `Step 2: CONTACTED - ${completedItems}/${totalItems} items completed. Cannot progress to QUALIFIED until all items are checked.`,
        nextAction: 'COMPLETE_CHECKLIST'
      }
    )
  }

  // Step 2: Validate collected requirements
  const validationResult = validateContactedRequirements(lead, contactedChecklist)

  if (!validationResult.valid) {
    return successResponse(
      {
        stage: 'Contacted',
        status: 'INVALID',
        errors: validationResult.errors,
        message: 'Step 2: Checklist complete but validation failed. Fix issues before progressing.',
        nextAction: 'RESOLVE_VALIDATION_ERRORS'
      }
    )
  }

  // Step 2: Ready to move to QUALIFIED
  return successResponse(
    {
      stage: 'Contacted',
      status: 'READY_FOR_QUALIFIED',
      completionPercentage: 100,
      completedItems: totalItems,
      totalItems,
      message: 'Step 2: CONTACTED - All requirements met. Ready to move to Step 3: QUALIFIED.',
      nextAction: 'PROCEED_TO_QUALIFIED',
      handoverInfo: {
        to: 'Purchase Team',
        requirements: extractRequirementsForHandover(lead)
      }
    }
  )
})

function validateContactedRequirements(lead: any, checklist: any) {
  const errors = []

  const customFields = lead.customFields as any || {}

  // Customer Requirements
  if (!customFields.customerType) errors.push('Customer Type not identified')
  if (!customFields.decisionMaker) errors.push('Decision Maker not identified')

  // Requirement Requirements
  if (!customFields.productRequired) errors.push('Product not identified')
  if (!customFields.quantityRequired) errors.push('Quantity not identified')
  if (!customFields.deliveryLocation) errors.push('Delivery Location not identified')
  if (!customFields.deliveryTimeline) errors.push('Delivery Timeline not identified')

  // Specification Requirements
  if (!customFields.size) errors.push('Size not confirmed')
  if (!customFields.thickness) errors.push('Thickness not confirmed')

  // Commercial Requirements
  if (customFields.paymentExpectation === undefined) errors.push('Payment Terms not discussed')
  if (customFields.creditRequirement === undefined) errors.push('Credit Requirement not discussed')

  return {
    valid: errors.length === 0,
    errors
  }
}

function extractRequirementsForHandover(lead: any) {
  const customFields = lead.customFields as any || {}
  
  return {
    customerName: lead.contact?.fullName,
    customerType: customFields.customerType,
    companyName: lead.companyName,
    product: customFields.productRequired,
    quantity: customFields.quantityRequired,
    specifications: {
      size: customFields.size,
      thickness: customFields.thickness,
      length: customFields.length,
      diameter: customFields.diameter,
      grade: customFields.grade,
      colour: customFields.colour,
      cuttingRequirement: customFields.cuttingRequired,
      punchingRequirement: customFields.punchingRequired,
      specialRequirements: customFields.specialRequirements
    },
    delivery: {
      location: customFields.deliveryLocation,
      timeline: customFields.deliveryTimeline
    },
    commercial: {
      paymentTerms: customFields.paymentExpectation,
      transportationRequired: customFields.transportationRequired,
      creditRequirement: customFields.creditRequirement,
      budget: customFields.budget
    },
    margin: customFields.targetMargin
  }
}
```

#### Task 2: Step 2 Activities & Follow-ups

**Step 2: Require 3+ interactions during CONTACTED stage**

```typescript
// app/api/v1/leads/[id]/step-2/follow-ups/route.ts

export const GET = withErrorHandler(async (req) => {
  const { id: leadId } = req.params
  const { orgId } = extractOrgAndUserIds(req.headers) || {}

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      activities: {
        where: { createdAt: { gte: lead?.stageChangedAt } },
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!lead || lead.stage !== 'Contacted') {
    throw new ValidationError('Lead not in CONTACTED stage')
  }

  const customFields = lead.customFields as any || {}
  const activitiesInStep = lead.activities.length

  // Step 2: SOP Requirement - Minimum 3 interactions
  const minActivitiesRequired = 3
  const activitiesNeeded = Math.max(0, minActivitiesRequired - activitiesInStep)

  // Calculate follow-up schedule
  const stageStartedAt = lead.stageChangedAt || lead.createdAt
  const dayInStage = Math.floor(
    (new Date().getTime() - stageStartedAt.getTime()) / (1000 * 60 * 60 * 24)
  )

  const schedule = {
    day1: {
      plannedAction: 'Call Attempt #2 + WhatsApp Follow-up',
      dueBy: new Date(stageStartedAt.getTime() + 24 * 60 * 60 * 1000),
      completed: dayInStage >= 1 && lead.activities.some(a => a.type === 'call')
    },
    day2: {
      plannedAction: 'Call Attempt #3 + WhatsApp Follow-up',
      dueBy: new Date(stageStartedAt.getTime() + 48 * 60 * 60 * 1000),
      completed: dayInStage >= 2 && lead.activities.filter(a => a.type === 'call').length >= 2
    },
    day3: {
      plannedAction: 'Final Follow-up Call + Email',
      dueBy: new Date(stageStartedAt.getTime() + 72 * 60 * 60 * 1000),
      completed: dayInStage >= 3
    }
  }

  return successResponse({
    stage: 'Contacted',
    requirementsStatus: {
      minActivitiesRequired,
      activitiesCompleted: activitiesInStep,
      activitiesNeeded,
      status: activitiesNeeded <= 0 ? 'MET' : `PENDING (${activitiesNeeded} more)`
    },
    recentActivities: lead.activities.slice(0, 5),
    followUpSchedule: schedule,
    message: `Step 2: CONTACTED - ${activitiesInStep}/${minActivitiesRequired} interactions. ${activitiesNeeded > 0 ? `Need ${activitiesNeeded} more interactions.` : 'All interaction requirements met.'}`
  })
})
```

---

### Week 5: Step 3 (QUALIFIED) Implementation

#### Task 1: Qualified Stage Enforcement

**Step 3: QUALIFIED - Handover to Purchase**

```typescript
// app/api/v1/leads/[id]/step-3/handover/route.ts

export const POST = withErrorHandler(async (req) => {
  const { orgId, userId } = extractOrgAndUserIds(req.headers) || {}
  const { id: leadId } = req.params
  const body = await req.json()

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      checklists: { include: { items: true } },
      timeline: true
    }
  })

  if (!lead || lead.stage !== 'Qualified') {
    throw new ValidationError('Lead must be in QUALIFIED stage for handover')
  }

  // Step 3: Get Qualified Checklist
  const qualifiedChecklist = await prisma.checklist.findFirst({
    where: {
      leadId,
      title: 'Qualified Checklist'
    },
    include: { items: true }
  })

  const completedItems = qualifiedChecklist?.items.filter(i => i.completed).length || 0
  const totalItems = qualifiedChecklist?.items.length || 0

  if (completedItems < totalItems) {
    throw new ValidationError(
      `Cannot handover. Step 3 Checklist incomplete: ${completedItems}/${totalItems} items`
    )
  }

  // Step 3: Create handover record
  const handoverData = body

  const customFields = lead.customFields as any || {}
  customFields.purchaseHandoverDate = new Date()
  customFields.purchaseHandoverBy = userId
  customFields.handoverNotes = handoverData.notes

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      customFields,
      lastActivityAt: new Date()
    }
  })

  // Step 3: Create timeline event
  if (lead.timeline) {
    await prisma.timelineEvent.create({
      data: {
        timelineId: lead.timeline.id,
        type: 'lead_handed_over',
        title: 'Step 3: Handed Over to Purchase Team',
        description: `Complete enquiry shared with Purchase. Awaiting quotation within 3 hours.`,
        metadata: {
          sopStep: 'QUALIFIED',
          handoverDate: new Date(),
          handoverBy: userId,
          handoverData: handoverData.requirements
        },
        createdBy: userId
      }
    })
  }

  // Step 3: Audit log
  await logAudit(
    orgId,
    userId,
    'updated',
    'lead',
    leadId,
    'Handed over to Purchase Team',
    {
      action: 'QUALIFIED_HANDOVER',
      sopStep: 'QUALIFIED → Next: QUOTE_SENT'
    }
  )

  return successResponse({
    lead: {
      id: lead.id,
      stage: 'Qualified',
      sopStep: 'QUALIFIED',
      handoverStatus: 'COMPLETE'
    },
    sla: {
      deadline: new Date(new Date().getTime() + 3 * 60 * 60 * 1000), // 3 hours
      message: 'Quotation must be generated and sent within 3 hours'
    },
    message: 'Step 3: QUALIFIED - Lead handed over to Purchase. SLA: 3 hours to generate quote.'
  })
})
```

---

### Week 6: Step 4 (QUOTE SENT) & Follow-up Engine

#### Task 1: Quote Tracking & Daily Follow-ups

**Step 4: QUOTE SENT - Daily follow-ups for 6 days**

```typescript
// app/api/v1/leads/[id]/step-4/follow-up-schedule/route.ts

export const GET = withErrorHandler(async (req) => {
  const { id: leadId } = req.params
  const { orgId } = extractOrgAndUserIds(req.headers) || {}

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      activities: { orderBy: { createdAt: 'desc' } },
      quotes: { where: { status: 'sent' } }
    }
  })

  if (!lead || lead.stage !== 'Quote Sent') {
    throw new ValidationError('Lead not in QUOTE SENT stage')
  }

  const quoteSent = lead.quotes[0]
  if (!quoteSent) {
    throw new NotFoundError('Sent quote for this lead')
  }

  // Step 4: SOP Requirement - Daily follow-up for 6 days
  const quoteSentDate = quoteSent.sentAt || lead.stageChangedAt
  const daysElapsed = Math.floor(
    (new Date().getTime() - quoteSentDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  const dailySchedule = {}
  for (let day = 1; day <= 6; day++) {
    const scheduledDate = new Date(quoteSentDate.getTime() + day * 24 * 60 * 60 * 1000)
    
    const dayActivities = lead.activities.filter(a => {
      const actDate = new Date(a.createdAt)
      return (
        actDate.getDate() === scheduledDate.getDate() &&
        actDate.getMonth() === scheduledDate.getMonth() &&
        actDate.getFullYear() === scheduledDate.getFullYear()
      )
    })

    dailySchedule[`Day ${day}`] = {
      scheduledDate,
      plannedActions: ['1 Call', '1 WhatsApp'],
      activitiesCompleted: dayActivities.length,
      completed: dayActivities.length >= 2,
      status: daysElapsed >= day ? 'DUE' : 'UPCOMING'
    }
  }

  // Step 4: Determine outcome
  let recommendedAction = 'CONTINUE_FOLLOW_UPS'
  
  if (daysElapsed >= 6) {
    const allCallsLogged = lead.activities.filter(a => a.type === 'call').length >= 6
    const noResponse = !lead.customFields?.orderConfirmed
    
    if (noResponse && allCallsLogged) {
      recommendedAction = 'MARK_DEAL_LOST'
    }
  }

  return successResponse({
    stage: 'Quote Sent',
    quoteInfo: {
      quoteNumber: quoteSent.quoteNumber,
      amount: quoteSent.finalAmount,
      sentDate: quoteSent.sentAt,
      validUntil: quoteSent.validUntil
    },
    followUpSchedule: dailySchedule,
    daysElapsed,
    message: `Step 4: QUOTE SENT - Day ${daysElapsed}/6. Continue daily follow-ups.`,
    recommendedAction,
    sla: {
      dailyFollowupRequired: true,
      daysRemaining: Math.max(0, 6 - daysElapsed)
    }
  })
})
```

#### Task 2: Deal Lost Management

**Step 4: Exit criteria for DEAL LOST**

```typescript
// app/api/v1/leads/[id]/mark-deal-lost/route.ts

export const POST = withErrorHandler(async (req) => {
  const { orgId, userId } = extractOrgAndUserIds(req.headers) || {}
  const { id: leadId } = req.params
  const body = await req.json()

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { timeline: true }
  })

  if (!lead) throw new NotFoundError('Lead')

  const { reason, notes } = body

  // Step 4: Valid DEAL LOST reasons
  const validReasons = [
    'Purchased Elsewhere',
    'No Requirement',
    'Project Cancelled',
    'Price Not Accepted',
    'Delivery Timeline Not Accepted',
    'Payment Terms Not Accepted',
    'Product Not Suitable',
    'No Response (6+ calls/WhatsApp)',
    'Requirement Postponed',
    'Budget Issue',
    'Credit Requirement Issue',
    'Dormant'
  ]

  if (!validReasons.includes(reason)) {
    throw new ValidationError('Invalid deal lost reason', { validReasons })
  }

  // Mark as deal lost
  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage: 'Deal Lost',
      status: 'closed_lost',
      dealLostDate: new Date(),
      dealLostReason: reason,
      customFields: {
        ...lead.customFields,
        dealLostReason: reason,
        dealLostNotes: notes,
        dealLostBy: userId,
        dealLostDate: new Date()
      }
    }
  })

  // Timeline event
  if (lead.timeline) {
    await prisma.timelineEvent.create({
      data: {
        timelineId: lead.timeline.id,
        type: 'deal_lost',
        title: `Step 4: Deal Lost - ${reason}`,
        description: notes || reason,
        metadata: {
          sopStep: 'QUOTE SENT → DEAL LOST',
          reason,
          finalStage: 'Deal Lost'
        },
        createdBy: userId
      }
    })
  }

  // Step 4: For "Requirement Postponed" and "Dormant", log for monthly follow-up
  if (['Requirement Postponed', 'Dormant'].includes(reason)) {
    // Tag for monthly follow-up
    const customFields = updatedLead.customFields as any || {}
    customFields.monthlyFollowupRequired = true
    customFields.lastFollowupDate = new Date()

    await prisma.lead.update({
      where: { id: leadId },
      data: { customFields }
    })
  }

  return successResponse({
    lead: updatedLead,
    message: `Step 4: Lead marked as DEAL LOST. Reason: ${reason}${['Requirement Postponed', 'Dormant'].includes(reason) ? ' - Monthly follow-up required.' : ''}`
  })
})
```

---

### Week 7: Frontend - SOP-Aligned UI

#### Step 1-4 Dashboard

**File:** `app/dashboard/page.tsx`

**Features:**
1. **SOP Step Metrics**
   - Leads in each step (NEW_LEAD, CONTACTED, QUALIFIED, QUOTE_SENT)
   - Conversion rates between steps
   - Drop-off analysis (DISQUALIFIED/DEAL_LOST)

2. **Mandatory Checklist Widgets**
   - Show incomplete checklists
   - Block progression indicators
   - Bulk checklist completion

3. **SLA & Follow-up Tracking**
   - Color-coded SLA status (Safe/Warning/Critical/Breached)
   - Next follow-up due date
   - Days remaining in step

4. **Activity Summary**
   - Calls this week
   - WhatsApp messages sent
   - Email follow-ups
   - Upcoming scheduled activities

#### Step-Specific Lead Views

**File:** `components/leads/StepProgress.tsx`

```typescript
// components/leads/StepProgress.tsx

export function StepProgress({ lead }: { lead: Lead }) {
  const steps = ['NEW_LEAD', 'CONTACTED', 'QUALIFIED', 'QUOTE_SENT']
  const currentStepIndex = steps.indexOf(lead.customFields?.sopStep)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">SOP Progress</h3>
      
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={step} className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm mb-2 ${
                idx <= currentStepIndex
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {idx + 1}
            </div>
            <p className="text-xs font-medium text-center text-gray-600">{step}</p>
            
            {idx < steps.length - 1 && (
              <div
                className={`h-1 flex-1 mx-2 ${
                  idx < currentStepIndex ? 'bg-green-200' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Current step details */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm font-medium text-blue-900">
          Current: Step {currentStepIndex + 1} - {lead.stage}
        </p>
        <p className="text-xs text-blue-700 mt-1">
          {getStepDescription(lead.customFields?.sopStep)}
        </p>
      </div>
    </div>
  )
}
```

---

### Week 8: Testing, SOP Compliance, Deployment

#### SOP Compliance Tests

**File:** `tests/integration/sop-compliance.test.ts`

```typescript
// tests/integration/sop-compliance.test.ts

describe('VECK SOP Compliance', () => {
  describe('Step 1: NEW_LEAD', () => {
    it('should create lead with Step 1 checklist', async () => {
      const lead = await createLead({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+91-9999999999',
        companyName: 'ABC Corp',
        source: 'WhatsApp'
      })

      expect(lead.stage).toBe('New Lead')
      expect(lead.customFields.sopStep).toBe('NEW_LEAD')
      expect(lead.slaDeadline).toBeDefined() // 1 hour SLA
    })

    it('should enforce 3 contact attempts before disqualification', async () => {
      const lead = await createLead({...leadData})
      
      // Attempt 1
      await logActivity(lead.id, { type: 'call', status: 'no_answer' })
      
      // Try to disqualify - should fail
      let result = await transitionToDisqualified(lead.id, '3 Call Attempts')
      expect(result.success).toBe(false)
      
      // Attempt 2 & 3
      await logActivity(lead.id, { type: 'whatsapp', status: 'sent' })
      await logActivity(lead.id, { type: 'email', status: 'sent' })
      
      // Now should allow
      result = await transitionToDisqualified(lead.id, '3 Call Attempts')
      expect(result.success).toBe(true)
      expect(lead.status).toBe('disqualified')
    })

    it('should transition to CONTACTED when customer responds', async () => {
      const lead = await createLead({...leadData})
      
      await logActivity(lead.id, { type: 'call', status: 'connected' })
      
      const result = await transitionTo(lead.id, 'Contacted')
      expect(result.success).toBe(true)
      expect(lead.stage).toBe('Contacted')
      expect(lead.customFields.sopStep).toBe('CONTACTED')
    })
  })

  describe('Step 2: CONTACTED', () => {
    it('should enforce 20-item Contacted checklist', async () => {
      const lead = await createLeadInStage('Contacted')
      const checklist = await getChecklist(lead.id, 'Contacted Qualification Checklist')
      
      expect(checklist.items.length).toBe(20)
      
      // Try to progress with incomplete checklist
      let result = await validateStep2Transition(lead.id, 'Qualified')
      expect(result.allowed).toBe(false)
      
      // Complete all items
      for (const item of checklist.items) {
        await completeChecklistItem(item.id)
      }
      
      // Now should allow
      result = await validateStep2Transition(lead.id, 'Qualified')
      expect(result.allowed).toBe(true)
    })

    it('should require minimum 3 activities in CONTACTED stage', async () => {
      const lead = await createLeadInStage('Contacted')
      
      expect(lead.activities.length).toBeLessThan(3)
      
      await logActivity(lead.id, { type: 'call' })
      await logActivity(lead.id, { type: 'whatsapp' })
      await logActivity(lead.id, { type: 'email' })
      
      const freshLead = await getLead(lead.id)
      expect(freshLead.activities.length).toBe(3)
    })
  })

  describe('Step 3: QUALIFIED', () => {
    it('should block progression without complete checklist', async () => {
      const lead = await createLeadInStage('Qualified')
      const checklist = await getChecklist(lead.id, 'Qualified Checklist')
      
      // Incomplete checklist
      let result = await validateHandover(lead.id)
      expect(result.allowed).toBe(false)
      
      // Complete checklist
      for (const item of checklist.items) {
        await completeChecklistItem(item.id)
      }
      
      result = await validateHandover(lead.id)
      expect(result.allowed).toBe(true)
    })
  })

  describe('Step 4: QUOTE_SENT', () => {
    it('should enforce 6-day daily follow-up schedule', async () => {
      const lead = await createLeadInStage('Quote Sent')
      
      const schedule = await getFollowupSchedule(lead.id)
      
      for (let day = 1; day <= 6; day++) {
        expect(schedule[`Day ${day}`]).toBeDefined()
        expect(schedule[`Day ${day}`].plannedActions.length).toBeGreaterThan(0)
      }
    })

    it('should allow DEAL_LOST only with valid reason', async () => {
      const lead = await createLeadInStage('Quote Sent')
      
      // Invalid reason
      let result = await markDealLost(lead.id, 'InvalidReason')
      expect(result.success).toBe(false)
      
      // Valid reason
      result = await markDealLost(lead.id, 'Purchased Elsewhere')
      expect(result.success).toBe(true)
      expect(lead.stage).toBe('Deal Lost')
    })

    it('should require ORDER_CONFIRMED with payment', async () => {
      const lead = await createLeadInStage('Quote Sent')
      
      // Can't mark as order without payment
      let result = await markOrderConfirmed(lead.id)
      expect(result.success).toBe(false)
      
      // Log payment
      await createPayment(lead.id, 100000)
      
      result = await markOrderConfirmed(lead.id)
      expect(result.success).toBe(true)
    })
  })

  describe('SOP Golden Rules', () => {
    it('should not allow Purchase involvement until CONTACTED checklist complete', async () => {
      const lead = await createLeadInStage('Contacted')
      
      // Try to get purchase-ready data
      const result = await getHandoverData(lead.id)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('checklist')
    })

    it('should block progression without checklist completion', async () => {
      const lead = await createLeadInStage('Qualified')
      const checklist = await getChecklist(lead.id, 'Qualified Checklist')
      
      // Mark only some items as complete
      for (let i = 0; i < 5; i++) {
        await completeChecklistItem(checklist.items[i].id)
      }
      
      const result = await validateQuotationDispatch(lead.id)
      expect(result.allowed).toBe(false)
      expect(result.message).toContain('Qualified Checklist')
    })

    it('should maintain sales responsibility until closure', async () => {
      const lead = await createLead({...leadData})
      
      // Throughout the entire process
      expect(lead.createdBy).toBeDefined()
      
      // Even when handed to purchase
      const handoverData = await getHandoverData(lead.id)
      expect(handoverData.salesOwner).toBe(lead.createdBy)
      
      // Until final closure
      await markDealLost(lead.id, 'Purchased Elsewhere')
      expect(lead.salesOwner).toBe(lead.createdBy)
    })
  })
})
```

---

## 📊 Complete API Endpoints - SOP Integrated

### Step 1: NEW_LEAD
```
POST   /api/v1/leads                         - Create lead (Step 1)
POST   /api/v1/leads/:id/activities          - Log activity (Call/WhatsApp/Email)
GET    /api/v1/leads/:id/checklists          - Get Step 1 checklists
PUT    /api/v1/leads/:id/checklists/:itemId  - Complete checklist item
PUT    /api/v1/leads/:id/transition          - Transition to CONTACTED/DISQUALIFIED
```

### Step 2: CONTACTED  
```
GET    /api/v1/leads/:id/step-2/validate         - Validate Step 2 completion
GET    /api/v1/leads/:id/step-2/follow-ups       - Get follow-up schedule
POST   /api/v1/leads/:id/activities              - Log activities
```

### Step 3: QUALIFIED
```
POST   /api/v1/leads/:id/step-3/handover         - Handover to Purchase
GET    /api/v1/leads/:id/step-3/validate         - Validate readiness
```

### Step 4: QUOTE_SENT
```
GET    /api/v1/leads/:id/step-4/follow-up-schedule - Get 6-day schedule
POST   /api/v1/leads/:id/mark-deal-lost          - Mark deal as lost
POST   /api/v1/leads/:id/mark-order-confirmed    - Confirm order
```

---

## 🎯 Success Criteria - SOP Integrated

✅ **SOP Enforcement:**
- Step 1: 3 contact attempts → forced DISQUALIFIED
- Step 2: 20-item checklist → blocks QUALIFIED
- Step 3: Handover only after checklist complete
- Step 4: 6-day follow-up schedule enforced
- Golden Rules: All 3 enforced by system

✅ **Mandatory Checklists:**
- 5 checklists created automatically
- Blocking enabled for required checklists
- Item-level tracking
- Progress visibility

✅ **Activity Tracking:**
- Call attempts counted per step
- WhatsApp messages tracked
- Email follow-ups logged
- Timeline captures all events

✅ **SLA Enforcement:**
- Step 1: 1-hour response SLA
- Step 2: 24-hour engagement SLA  
- Step 3: 3-hour quote SLA
- Step 4: Daily follow-up for 6 days

✅ **Exit Criteria:**
- Step 1→CONTACTED: Customer responds
- Step 1→DISQUALIFIED: 3 failed attempts
- Step 2→QUALIFIED: Checklist complete + specs collected
- Step 4→ORDER_CONFIRMED: Payment received
- Any→DISQUALIFIED: Valid SOP reasons only

---

## 📈 Deliverables Checklist

- [ ] Step 1 API & validation
- [ ] Step 2 API & 20-item checklist
- [ ] Step 3 API & handover logic
- [ ] Step 4 API & 6-day follow-up
- [ ] Activity tracking (calls, WhatsApp, email)
- [ ] SLA engine (4 different SLAs)
- [ ] Mandatory checklist enforcement
- [ ] Exit criteria validation
- [ ] Dashboard (SOP metrics)
- [ ] Lead detail view (step progress)
- [ ] Daily follow-up schedule UI
- [ ] Deal lost reason selection
- [ ] SOP compliance tests (15+)
- [ ] Golden rule enforcement tests
- [ ] Documentation (SOP guide)
- [ ] Deployment to production

---

## 📚 Documentation Files to Create

1. **`docs/SOP_GUIDE.md`** - How the CRM enforces VECK SOP
2. **`docs/STEP_1_WORKFLOW.md`** - Detailed Step 1 process
3. **`docs/STEP_2_WORKFLOW.md`** - Detailed Step 2 process
4. **`docs/STEP_3_WORKFLOW.md`** - Detailed Step 3 process
5. **`docs/STEP_4_WORKFLOW.md`** - Detailed Step 4 process
6. **`docs/API_SOP_ENDPOINTS.md`** - All SOP-related endpoints

---

## 🚀 Ready to Build?

This integrated plan:
- ✅ Aligns 100% with VECK Sales SOP
- ✅ Enforces all golden rules
- ✅ Tracks all mandatory checklists
- ✅ Implements all 4 steps + post-order
- ✅ Includes complete testing
- ✅ Provides deployment path

**Phase 1 Timeline: 6 weeks (Week 3-8)**

Next: Begin Week 3 implementation!
