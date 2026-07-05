import { ApiError } from './api-client'

// The API returns Zod's `.flatten()` shape in error.details:
//   { formErrors: string[], fieldErrors: { [field]: string[] } }
// This helper extracts it so forms can render field-level messages instead
// of a single generic error string.

export interface FormErrors {
  message: string
  fields: Record<string, string>
}

export function toFormErrors(err: unknown, fallback: string): FormErrors {
  if (!(err instanceof ApiError)) {
    return { message: fallback, fields: {} }
  }

  const fields: Record<string, string> = {}
  const details = err.details as
    | { formErrors?: string[]; fieldErrors?: Record<string, string[]> }
    | undefined

  if (details?.fieldErrors) {
    for (const [field, messages] of Object.entries(details.fieldErrors)) {
      if (messages?.length) fields[field] = messages[0]
    }
  }

  const formError = details?.formErrors?.[0]
  return { message: formError || err.message || fallback, fields }
}
