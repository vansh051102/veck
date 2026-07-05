import {
  CreateContactSchema,
  CreateLeadSchema,
  UpdateLeadStageSchema,
  AssignLeadSchema,
  CreateActivitySchema,
  CreateChecklistSchema,
  ChecklistItemSchema,
  CreateQuoteSchema,
  SendQuoteSchema,
  CreatePurchaseRequestSchema,
  PaginationSchema,
  IndiaMartWebhookSchema,
} from '../validation'

describe('CreateContactSchema', () => {
  const valid = {
    firstName: 'Ravi',
    lastName: 'Kumar',
    email: 'ravi@example.com',
    phone: '+91-9876543210',
  }

  it('accepts a valid contact', () => {
    expect(CreateContactSchema.safeParse(valid).success).toBe(true)
  })

  it('defaults source to Other and tags to []', () => {
    const result = CreateContactSchema.parse(valid)
    expect(result.source).toBe('Other')
    expect(result.tags).toEqual([])
  })

  it('rejects an invalid email', () => {
    const result = CreateContactSchema.safeParse({ ...valid, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid phone number', () => {
    const result = CreateContactSchema.safeParse({ ...valid, phone: 'call me maybe' })
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const { firstName, ...rest } = valid
    expect(CreateContactSchema.safeParse(rest).success).toBe(false)
  })
})

describe('CreateLeadSchema', () => {
  const valid = {
    contactId: '123e4567-e89b-12d3-a456-426614174000',
    companyName: 'Acme Steel',
  }

  it('accepts a valid lead with defaults applied', () => {
    const result = CreateLeadSchema.parse(valid)
    expect(result.priority).toBe('Medium')
    expect(result.tags).toEqual([])
  })

  it('rejects a non-UUID contactId', () => {
    expect(CreateLeadSchema.safeParse({ ...valid, contactId: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects an invalid priority', () => {
    expect(
      CreateLeadSchema.safeParse({ ...valid, priority: 'Extreme' }).success
    ).toBe(false)
  })

  it('rejects an empty company name', () => {
    expect(CreateLeadSchema.safeParse({ ...valid, companyName: '' }).success).toBe(false)
  })
})

describe('UpdateLeadStageSchema', () => {
  it('accepts a known stage', () => {
    expect(UpdateLeadStageSchema.safeParse({ stage: 'Contacted' }).success).toBe(true)
  })

  it('rejects an unknown stage', () => {
    expect(UpdateLeadStageSchema.safeParse({ stage: 'Nowhere' }).success).toBe(false)
  })

  it('allows an optional reason', () => {
    const result = UpdateLeadStageSchema.parse({ stage: 'Disqualified', reason: 'No budget' })
    expect(result.reason).toBe('No budget')
  })
})

describe('AssignLeadSchema', () => {
  it('requires a valid UUID', () => {
    expect(AssignLeadSchema.safeParse({ assignedToId: 'nope' }).success).toBe(false)
    expect(
      AssignLeadSchema.safeParse({ assignedToId: '123e4567-e89b-12d3-a456-426614174000' }).success
    ).toBe(true)
  })
})

describe('CreateActivitySchema', () => {
  it('accepts a valid call activity', () => {
    const result = CreateActivitySchema.safeParse({ type: 'call', title: 'Intro call' })
    expect(result.success).toBe(true)
  })

  it('defaults status to pending', () => {
    const result = CreateActivitySchema.parse({ type: 'note', title: 'Left a note' })
    expect(result.status).toBe('pending')
  })

  it('rejects an unknown activity type', () => {
    expect(CreateActivitySchema.safeParse({ type: 'carrier-pigeon', title: 'x' }).success).toBe(false)
  })

  it('rejects a non-positive duration', () => {
    expect(
      CreateActivitySchema.safeParse({ type: 'call', title: 'x', duration: -5 }).success
    ).toBe(false)
  })
})

describe('CreateChecklistSchema', () => {
  it('accepts a checklist with items', () => {
    const result = CreateChecklistSchema.parse({
      title: 'Qualification',
      items: [{ title: 'Verify budget' }, { title: 'Confirm timeline' }],
    })
    expect(result.items).toHaveLength(2)
    expect(result.isRequired).toBe(false)
  })

  it('defaults items to an empty array', () => {
    const result = CreateChecklistSchema.parse({ title: 'Empty checklist' })
    expect(result.items).toEqual([])
  })

  it('rejects an item with an empty title', () => {
    expect(
      CreateChecklistSchema.safeParse({ title: 'x', items: [{ title: '' }] }).success
    ).toBe(false)
  })
})

describe('ChecklistItemSchema', () => {
  it('requires a boolean completed field', () => {
    expect(ChecklistItemSchema.safeParse({ completed: true }).success).toBe(true)
    expect(ChecklistItemSchema.safeParse({ completed: 'yes' }).success).toBe(false)
  })
})

describe('CreateQuoteSchema', () => {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  it('accepts a valid quote', () => {
    const result = CreateQuoteSchema.safeParse({
      items: [{ productId: 'p1', quantity: 10, price: 500 }],
      validUntil: futureDate,
    })
    expect(result.success).toBe(true)
  })

  it('defaults item discount to 0', () => {
    const result = CreateQuoteSchema.parse({
      items: [{ productId: 'p1', quantity: 10, price: 500 }],
      validUntil: futureDate,
    })
    expect(result.items[0].discount).toBe(0)
  })

  it('rejects an empty items array', () => {
    expect(CreateQuoteSchema.safeParse({ items: [], validUntil: futureDate }).success).toBe(false)
  })

  it('rejects a validUntil date in the past', () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
    expect(
      CreateQuoteSchema.safeParse({
        items: [{ productId: 'p1', quantity: 1, price: 1 }],
        validUntil: pastDate,
      }).success
    ).toBe(false)
  })

  it('rejects a negative quantity or price', () => {
    expect(
      CreateQuoteSchema.safeParse({
        items: [{ productId: 'p1', quantity: -1, price: 500 }],
        validUntil: futureDate,
      }).success
    ).toBe(false)
  })
})

describe('SendQuoteSchema', () => {
  it('requires a valid recipient email', () => {
    expect(SendQuoteSchema.safeParse({ recipientEmail: 'not-an-email' }).success).toBe(false)
    expect(SendQuoteSchema.safeParse({ recipientEmail: 'buyer@example.com' }).success).toBe(true)
  })
})

describe('CreatePurchaseRequestSchema', () => {
  it('accepts a valid purchase request', () => {
    const result = CreatePurchaseRequestSchema.safeParse({
      productIds: ['p1', 'p2'],
      estimatedQuantity: 100,
      estimatedAmount: 50000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty productIds array', () => {
    expect(
      CreatePurchaseRequestSchema.safeParse({
        productIds: [],
        estimatedQuantity: 10,
        estimatedAmount: 100,
      }).success
    ).toBe(false)
  })

  it('rejects a non-positive estimatedAmount', () => {
    expect(
      CreatePurchaseRequestSchema.safeParse({
        productIds: ['p1'],
        estimatedQuantity: 10,
        estimatedAmount: 0,
      }).success
    ).toBe(false)
  })
})

describe('IndiaMartWebhookSchema', () => {
  const validPayload = {
    CODE: 200,
    STATUS: 'SUCCESS',
    RESPONSE: {
      UNIQUE_QUERY_ID: '621654886',
      QUERY_TYPE: 'B',
      QUERY_TIME: '2024-04-10 11:17:14',
      SENDER_NAME: 'Prabhat',
      SENDER_MOBILE: '+91-9999999999',
      SENDER_EMAIL: 'prabhat@example.com',
      SENDER_COMPANY: 'ABC Pvt Ltd.',
      QUERY_PRODUCT_NAME: 'Mineral Water Bottle',
      QUERY_MESSAGE: 'I want to purchase Mineral Water Bottles.',
    },
  }

  it('accepts IndiaMART\'s documented example payload', () => {
    expect(IndiaMartWebhookSchema.safeParse(validPayload).success).toBe(true)
  })

  it('rejects a RESPONSE missing UNIQUE_QUERY_ID', () => {
    const { UNIQUE_QUERY_ID, ...rest } = validPayload.RESPONSE
    const result = IndiaMartWebhookSchema.safeParse({ ...validPayload, RESPONSE: rest })
    expect(result.success).toBe(false)
  })

  it('rejects a lead with neither SENDER_MOBILE nor SENDER_EMAIL', () => {
    const { SENDER_MOBILE, SENDER_EMAIL, ...rest } = validPayload.RESPONSE
    const result = IndiaMartWebhookSchema.safeParse({ ...validPayload, RESPONSE: rest })
    expect(result.success).toBe(false)
  })

  it('accepts a lead with only SENDER_MOBILE (no email)', () => {
    const { SENDER_EMAIL, ...rest } = validPayload.RESPONSE
    const result = IndiaMartWebhookSchema.safeParse({ ...validPayload, RESPONSE: rest })
    expect(result.success).toBe(true)
  })

  it('defaults SENDER_NAME when absent', () => {
    const { SENDER_NAME, ...rest } = validPayload.RESPONSE
    const result = IndiaMartWebhookSchema.parse({ ...validPayload, RESPONSE: rest })
    expect(result.RESPONSE.SENDER_NAME).toBe('IndiaMART Buyer')
  })
})

describe('PaginationSchema', () => {
  it('applies defaults when page/limit are omitted', () => {
    const result = PaginationSchema.parse({})
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('caps limit at 100', () => {
    const result = PaginationSchema.safeParse({ page: '1', limit: '500' })
    expect(result.success).toBe(false)
  })

  it('parses numeric strings correctly', () => {
    const result = PaginationSchema.parse({ page: '3', limit: '50' })
    expect(result).toEqual({ page: 3, limit: 50 })
  })
})
