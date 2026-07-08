// Normalizers used for contact dedup so the same person entered slightly
// differently (case, spacing, punctuation) maps to one Contact row within an
// org. These feed the @@unique([orgId, email]) / @@unique([orgId, phone])
// constraints on Contact.

/** Lowercase + trim an email. Empty/whitespace becomes ''. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Normalize a phone number for dedup: strip spaces, dashes, parens and dots,
 * keep a single leading '+'. Not full E.164 — we don't guess a country code.
 * ponytail: dedup-grade normalization; upgrade to libphonenumber if cross-
 * country dedup ever matters.
 */
export function normalizePhone(phone: string | null | undefined): string {
  const raw = (phone ?? '').trim()
  if (!raw) return ''
  const hasPlus = raw.startsWith('+')
  const digits = raw.replace(/[^0-9]/g, '')
  return hasPlus ? `+${digits}` : digits
}
