export const BEHAVIOR_OPTIONS: { value: string; hint: string }[] = [
  { value: 'Default', hint: 'No extra action when a lead enters this stage.' },
  { value: 'Quotation', hint: 'Generates/attaches a quote document for the lead.' },
  { value: 'Order Execution', hint: 'Starts order fulfillment tracking for the lead.' },
]

export const FORM_OPTIONS: { value: string; hint: string }[] = [
  { value: 'Default', hint: 'No extra fields required to enter this stage.' },
  { value: 'Quote fields', hint: 'Asks for quote amount/items before saving.' },
  { value: 'Loss reason', hint: 'Requires a reason before marking the lead lost.' },
]
