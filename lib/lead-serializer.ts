import { prisma } from './db'

const MASK_PLACEHOLDER = '••••••••'

// Fields living on the nested Contact rather than directly on Lead.
const CONTACT_FIELDS = new Set(['gstNumber', 'phone', 'email'])

/**
 * Resolves the field-level export/view mask for a user: their own
 * `User.maskedFieldsOverride` when set, else their role's
 * `Role.maskedFields`. Admins are never masked.
 */
export async function resolveMaskedFields(orgId: string, userId: string, role: string): Promise<string[]> {
  if (role === 'admin') return []

  const [roleRow, userRow] = await Promise.all([
    prisma.role.findFirst({ where: { orgId, name: role }, select: { maskedFields: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { maskedFieldsOverride: true } }),
  ])

  if (userRow?.maskedFieldsOverride?.length) return userRow.maskedFieldsOverride
  return roleRow?.maskedFields ?? []
}

type MaskableLead = {
  contact?: { gstNumber?: unknown; phone?: unknown; email?: unknown } | null
  [key: string]: unknown
}

/**
 * Redacts `maskedFields` on a lead (and its nested `contact`, for
 * phone/email/gstNumber) before it reaches the response — the same policy
 * export masking uses, now also applied to normal list/detail reads so a
 * restricted field isn't visible in-app just because export blocks it.
 * Returns a shallow copy; never mutates the input.
 */
export function applyLeadFieldMask<T extends MaskableLead>(lead: T, maskedFields: string[]): T {
  if (maskedFields.length === 0) return lead

  const masked: any = { ...lead }
  for (const field of maskedFields) {
    if (CONTACT_FIELDS.has(field)) {
      if (masked.contact) {
        masked.contact = { ...masked.contact, [field]: MASK_PLACEHOLDER }
      }
      continue
    }
    if (field in masked) masked[field] = null
  }
  return masked
}
