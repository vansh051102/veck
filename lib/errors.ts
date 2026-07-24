// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', 400, message, details)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', 403, message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource} not found`)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', 409, message)
    this.name = 'ConflictError'
  }
}

/** Thrown when a new Contact's phone/GST/email matches an existing one. `details`
 *  carries the existing contact/lead so the frontend can render actions
 *  (view / log as repeat / reassign) instead of a generic message. */
export class DuplicateContactError extends AppError {
  constructor(
    message: string,
    details: {
      reason: 'phone' | 'email' | 'gst' | 'open_lead'
      existingContact: { id: string; firstName: string; lastName: string }
      existingLead: { id: string; companyName: string; stage: string; assignedTo: { fullName: string } | null } | null
      actions: Array<'view' | 'logAsRepeat' | 'reassign'>
    }
  ) {
    super('DUPLICATE_CONTACT', 409, message, details)
    this.name = 'DuplicateContactError'
  }
}

/** Thrown when a lead mutation's client-supplied `version` no longer matches
 *  the server's — someone else updated it first. `details.currentState` lets
 *  the frontend show what changed instead of silently overwriting it. */
export class StaleVersionError extends AppError {
  constructor(currentState: Record<string, unknown>) {
    super('STALE_VERSION', 409, 'This lead was updated by someone else — review the latest changes before saving', {
      currentState,
    })
    this.name = 'StaleVersionError'
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super('RATE_LIMIT_EXCEEDED', 429, message)
    this.name = 'RateLimitError'
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super('INTERNAL_SERVER_ERROR', 500, message)
    this.name = 'InternalServerError'
  }
}
