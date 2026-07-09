import { z } from 'zod'

// Co-located ERP input schemas (mandate: Zod at the trust boundary of every
// action). Style mirrors lib/validation.ts — z.coerce.date for JSON dates.

const OrderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  discount: z.number().nonnegative('Discount cannot be negative').default(0),
  // GST/tax rate as a percentage, e.g. 18 → 18%
  taxRate: z.number().min(0).max(100).default(0),
})

export type OrderItemInput = z.infer<typeof OrderItemSchema>

// Lead → Customer + SalesOrder. Carries the Customer address fields that neither
// Lead nor Contact hold (address/city/state/pincode) plus the order line items.
export const ConvertLeadSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().min(1, 'Pincode is required'),
  customerType: z
    .enum(['dealer', 'fabricator', 'contractor', 'manufacturer'])
    .default('dealer'),
  creditLimit: z.number().nonnegative().default(0),
  deliveryAddress: z.string().optional(),
  deliveryDate: z.coerce.date(),
  items: z.array(OrderItemSchema).min(1, 'At least one order item is required'),
})

export const RecordStockMovementSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  direction: z.enum(['IN', 'OUT']),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  reason: z.enum(['purchase_receipt', 'sale', 'adjustment', 'return', 'transfer']),
  reference: z.string().min(1, 'Reference is required'),
  referenceType: z.enum(['sales_order', 'purchase_order', 'goods_receipt', 'manual']),
  unitCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
})

export const EnqueueTallySchema = z.object({
  entityType: z.enum(['invoice', 'sales_order', 'ledger', 'payment']),
  entityId: z.string().uuid('Invalid entity ID'),
  format: z.enum(['xml', 'json']).default('xml'),
})

export type ConvertLeadInput = z.infer<typeof ConvertLeadSchema>
export type RecordStockMovementInput = z.infer<typeof RecordStockMovementSchema>
export type EnqueueTallyInput = z.infer<typeof EnqueueTallySchema>
