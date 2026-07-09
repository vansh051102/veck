import { z } from 'zod'
import { PERMISSIONS } from './permissions'

// ============================================================================
// AUTH VALIDATION
// ============================================================================

export const SignUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  orgName: z.string().min(2, 'Organization name is required'),
})

export const SignInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type SignUpInput = z.infer<typeof SignUpSchema>
export type SignInInput = z.infer<typeof SignInSchema>

// ============================================================================
// CONTACT VALIDATION (Phase 1)
// ============================================================================

export const CreateContactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?[0-9\-\s()]+$/, 'Invalid phone number'),
  alternatePhone: z.string().regex(/^\+?[0-9\-\s()]+$/, 'Invalid phone number').optional(),
  designation: z.string().optional(),
  source: z.enum([
    'Website',
    'LinkedIn',
    'Referral',
    'Email',
    'Phone',
    'Other',
  ]).default('Other'),
  sourceDetails: z.record(z.any()).optional(),
  tags: z.array(z.string()).default([]),
})

export const UpdateContactSchema = CreateContactSchema.partial()

export type CreateContactInput = z.infer<typeof CreateContactSchema>
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>

// ============================================================================
// LEAD VALIDATION (Phase 1)
// ============================================================================

export const LEAD_STAGES = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Quote Sent',
  'Closed Won',
  'Deal Lost',
  'Disqualified',
] as const

export const LEAD_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const

export const CreateLeadSchema = z.object({
  contactId: z.string().uuid('Invalid contact ID'),
  companyName: z.string().min(1, 'Company name is required'),
  priority: z.enum(LEAD_PRIORITIES).default('Medium'),
  notes: z.string().optional(),
  // Free-text customer requirement shown/edited in the "Requirements" tab.
  requirement: z.string().optional(),
  source: z.string().optional(),
  sourceDetails: z.record(z.any()).optional(),
  tags: z.array(z.string()).default([]),
})

export const UpdateLeadSchema = CreateLeadSchema.partial()

export const UpdateLeadStageSchema = z
  .object({
    stage: z.enum(LEAD_STAGES),
    reason: z.string().optional(),
    reasonDetails: z.string().optional(),
    assignedToId: z.string().uuid('Invalid user ID').optional(),
    // Quote Sent details (required when stage = "Quote Sent")
    supplierMargin: z.number().min(0).max(100).optional(),
    quotationNumber: z.string().optional(),
    productCategory: z.string().optional(),
    quotationValue: z.number().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.stage === 'Quote Sent') {
        return (
          data.supplierMargin !== undefined &&
          data.quotationNumber !== undefined &&
          data.quotationNumber.trim().length > 0 &&
          data.productCategory !== undefined &&
          data.productCategory.trim().length > 0 &&
          data.quotationValue !== undefined
        )
      }
      return true
    },
    {
      message:
        'Supplier margin, quotation number, product category, and quotation value are required when moving to Quote Sent',
    }
  )

export const AssignLeadSchema = z.object({
  assignedToId: z.string().uuid('Invalid user ID'),
})

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>
export type UpdateLeadStageInput = z.infer<typeof UpdateLeadStageSchema>
export type AssignLeadInput = z.infer<typeof AssignLeadSchema>

// ============================================================================
// ACTIVITY VALIDATION (Phase 1)
// ============================================================================

export const ACTIVITY_TYPES = [
  'call',
  'email',
  'note',
  'meeting',
  'task',
  'message', // WhatsApp/SMS/email logged via "Log a Message"
  'reminder', // scheduled follow-up logged via "Log a Reminder"
] as const
export const ACTIVITY_STATUSES = ['pending', 'completed', 'cancelled'] as const

export const CreateActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  // z.coerce.date() accepts ISO strings over JSON (z.date() would reject them)
  scheduledFor: z.coerce.date().optional(),
  duration: z.number().positive().optional(),
  status: z.enum(ACTIVITY_STATUSES).default('pending'),
  metadata: z.record(z.any()).optional(),
})

export const UpdateActivitySchema = CreateActivitySchema.partial()

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>
export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>

// ============================================================================
// CHECKLIST VALIDATION (Phase 1)
// ============================================================================

export const CreateChecklistSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  items: z
    .array(
      z.object({
        title: z.string().min(1, 'Item title is required'),
      })
    )
    .default([]),
})

export const UpdateChecklistSchema = CreateChecklistSchema.partial()

export const ChecklistItemSchema = z.object({
  completed: z.boolean(),
})

export type CreateChecklistInput = z.infer<typeof CreateChecklistSchema>
export type UpdateChecklistInput = z.infer<typeof UpdateChecklistSchema>

// ============================================================================
// QUOTE VALIDATION (Phase 1)
// ============================================================================

export const CreateQuoteSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().positive('Quantity must be positive'),
        price: z.number().positive('Price must be positive'),
        discount: z.number().nonnegative('Discount cannot be negative').default(0),
      })
    )
    .min(1, 'At least one item is required'),
  // z.coerce.date() accepts ISO strings over JSON (z.date() would reject them)
  validUntil: z.coerce.date().refine((d) => d > new Date(), 'Validity date must be in the future'),
  terms: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateQuoteSchema = CreateQuoteSchema.partial()

export const SendQuoteSchema = z.object({
  recipientEmail: z.string().email('Invalid email'),
  message: z.string().optional(),
})

export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>
export type UpdateQuoteInput = z.infer<typeof UpdateQuoteSchema>
export type SendQuoteInput = z.infer<typeof SendQuoteSchema>

// ============================================================================
// PURCHASE REQUEST VALIDATION (Phase 1)
// ============================================================================

export const CreatePurchaseRequestSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1, 'At least one product is required'),
  estimatedQuantity: z.number().positive('Quantity must be positive'),
  estimatedAmount: z.number().positive('Amount must be positive'),
  notes: z.string().optional(),
})

export const UpdatePurchaseRequestSchema = CreatePurchaseRequestSchema.partial()

export type CreatePurchaseRequestInput = z.infer<typeof CreatePurchaseRequestSchema>
export type UpdatePurchaseRequestInput = z.infer<typeof UpdatePurchaseRequestSchema>

// ============================================================================
// INDIAMART WEBHOOK VALIDATION (Push API)
// ============================================================================
// Mirrors the RESPONSE object shape from IndiaMART's Lead Manager Push API.
// See: https://help.indiamart.com/knowledge-base/integration-of-indiamarts-lead-manager-crm-push-api-with-third-party-crms-real-time-push-of-leads/
// Only UNIQUE_QUERY_ID, QUERY_TYPE, QUERY_TIME, SENDER_NAME, SENDER_COUNTRY_ISO,
// and (SENDER_MOBILE or SENDER_EMAIL) are guaranteed present per their docs;
// everything else is optional and treated as best-effort enrichment.

export const IndiaMartLeadResponseSchema = z
  .object({
    UNIQUE_QUERY_ID: z.string().min(1),
    QUERY_TYPE: z.string().min(1),
    QUERY_TIME: z.string().min(1),
    SENDER_NAME: z.string().default('IndiaMART Buyer'),
    SENDER_MOBILE: z.string().optional(),
    SENDER_EMAIL: z.string().optional(),
    SUBJECT: z.string().optional(),
    SENDER_COMPANY: z.string().optional(),
    SENDER_ADDRESS: z.string().optional(),
    SENDER_CITY: z.string().optional(),
    SENDER_STATE: z.string().optional(),
    SENDER_PINCODE: z.string().optional(),
    SENDER_COUNTRY_ISO: z.string().optional(),
    SENDER_MOBILE_ALT: z.string().optional(),
    SENDER_PHONE: z.string().optional(),
    SENDER_PHONE_ALT: z.string().optional(),
    SENDER_EMAIL_ALT: z.string().optional(),
    QUERY_PRODUCT_NAME: z.string().optional(),
    QUERY_MESSAGE: z.string().optional(),
    QUERY_MCAT_NAME: z.string().optional(),
    CALL_DURATION: z.string().optional(),
    RECEIVER_MOBILE: z.string().optional(),
  })
  .refine((data) => Boolean(data.SENDER_MOBILE || data.SENDER_EMAIL), {
    message: 'Either SENDER_MOBILE or SENDER_EMAIL must be present',
  })

export const IndiaMartWebhookSchema = z.object({
  CODE: z.number().optional(),
  STATUS: z.string().optional(),
  RESPONSE: IndiaMartLeadResponseSchema,
})

export type IndiaMartLeadResponse = z.infer<typeof IndiaMartLeadResponseSchema>

// ============================================================================
// ASSIGNMENT RULE VALIDATION
// ============================================================================
// Workspace-level auto-assignment rules (admin-only). A rule matches a newly
// created lead by source + optional weekday + optional product category and
// routes it to a specific user.

export const CreateAssignmentRuleSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  // 0=Sunday .. 6=Saturday; null = applies on any day.
  weekday: z.number().int().min(0).max(6).nullable().default(null),
  // null = applies to any product category.
  productCategory: z.string().min(1).nullable().default(null),
  assignedToId: z.string().uuid('Invalid user ID'),
  isActive: z.boolean().default(true),
  priority: z.number().int().nonnegative().default(0),
})

export const UpdateAssignmentRuleSchema = CreateAssignmentRuleSchema.partial()

export type CreateAssignmentRuleInput = z.infer<typeof CreateAssignmentRuleSchema>
export type UpdateAssignmentRuleInput = z.infer<typeof UpdateAssignmentRuleSchema>

// ============================================================================
// USER & ROLE MANAGEMENT VALIDATION
// ============================================================================
// Shared by the org-scoped routes (/users, /roles) and the admin workspace
// routes (/admin/companies/[orgId]/...). Route files may only export handlers,
// so these live here.

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  territory: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
})

export const UpdateUserSchema = z.object({
  role: z.string().min(1, 'Role is required'),
  department: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  territory: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
})

// Only real permission strings are accepted. Wildcards ('*') are implicitly
// rejected because they are not members of PERMISSIONS — admin '*' is granted
// by role name, never stored on a custom role.
const ALL_PERMISSIONS = Object.values(PERMISSIONS) as string[]

export const UpdateRoleSchema = z.object({
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission is required')
    .refine((perms) => perms.every((p) => ALL_PERMISSIONS.includes(p)), {
      message: 'Contains an unknown or disallowed permission',
    }),
  description: z.string().nullable().optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>

// ============================================================================
// PAGINATION VALIDATION
// ============================================================================

export const PaginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().max(100)).default('20'),
})

export type PaginationInput = z.infer<typeof PaginationSchema>
