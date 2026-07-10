import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'

export interface QuotePdfItem {
  description: string
  quantity: number
  price: number
  discount: number
}

export interface QuotePdfData {
  quoteNumber: string
  status: string
  validUntil: Date
  notes?: string | null
  terms?: string | null
  items: QuotePdfItem[]
  totalAmount: number
  discount: number
  finalAmount: number
  supplier: {
    name: string
    address?: string | null
    gstin?: string | null
    pan?: string | null
    phone?: string | null
    email?: string | null
  }
  buyer: {
    companyName: string
    contactName?: string | null
    phone?: string | null
    email?: string | null
  }
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 56
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_Y = 40

const INK = rgb(0.09, 0.09, 0.09)
const LABEL = rgb(0.48, 0.48, 0.48)
const NAVY = rgb(0.08, 0.24, 0.42)
const RULE = rgb(0.88, 0.88, 0.88)
const DRAFT_BG = rgb(0.98, 0.94, 0.88)
const DRAFT_TEXT = rgb(0.62, 0.32, 0.06)

const TABLE_RIGHT = PAGE_W - MARGIN
const COL_GAP = 12

/** Column layout — numeric cols sized for "Rs. 99,99,999.99" at 10pt. */
const COL = (() => {
  const amt = { right: TABLE_RIGHT, w: 82 }
  const disc = { right: amt.right - amt.w - COL_GAP, w: 66 }
  const unit = { right: disc.right - disc.w - COL_GAP, w: 82 }
  const qty = { right: unit.right - unit.w - COL_GAP, w: 36 }
  const desc = { x: MARGIN, w: qty.right - qty.w - COL_GAP - MARGIN }
  return { amt, disc, unit, qty, desc }
})()

function inr(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatShortDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0')
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function topY(offsetFromTop: number): number {
  return PAGE_H - MARGIN - offsetFromTop
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawRight(
  page: PDFPage,
  text: string,
  rightX: number,
  yTop: number,
  font: PDFFont,
  size: number,
  color = INK
) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: rightX - width, y: topY(yTop), size, font, color })
}

function drawColRight(
  page: PDFPage,
  text: string,
  col: { right: number; w: number },
  yTop: number,
  font: PDFFont,
  size: number,
  color = INK
) {
  let drawSize = size
  let textWidth = font.widthOfTextAtSize(text, drawSize)
  while (textWidth > col.w && drawSize > 7) {
    drawSize -= 0.5
    textWidth = font.widthOfTextAtSize(text, drawSize)
  }
  drawRight(page, text, col.right, yTop, font, drawSize, color)
}

function drawRule(page: PDFPage, yTop: number, inset = 0) {
  page.drawLine({
    start: { x: MARGIN + inset, y: topY(yTop) },
    end: { x: PAGE_W - MARGIN - inset, y: topY(yTop) },
    thickness: 0.75,
    color: RULE,
  })
}

function drawLabelValueBlock(
  page: PDFPage,
  label: string,
  lines: string[],
  x: number,
  yStart: number,
  regular: PDFFont,
  bold: PDFFont
): number {
  let y = yStart
  page.drawText(label.toUpperCase(), { x, y: topY(y), size: 8, font: bold, color: LABEL })
  y += 14

  for (const [i, line] of lines.entries()) {
    page.drawText(line, {
      x,
      y: topY(y),
      size: i === 0 ? 10 : 9,
      font: i === 0 ? bold : regular,
      color: INK,
    })
    y += i === 0 ? 14 : 12
  }

  return y
}

export async function buildQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = 0

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_H - MARGIN - FOOTER_Y) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H])
      y = 0
    }
  }

  function advance(gap: number) {
    y += gap
  }

  const issuedAt = new Date()

  // ── Title block ──────────────────────────────────────────────────────────
  page.drawText('Quotation', { x: MARGIN, y: topY(y), size: 26, font: bold, color: INK })
  advance(30)

  page.drawText(`Quote number ${data.quoteNumber}`, {
    x: MARGIN,
    y: topY(y),
    size: 10,
    font: regular,
    color: LABEL,
  })
  advance(14)

  page.drawText(`Date issued ${formatShortDate(issuedAt)}`, {
    x: MARGIN,
    y: topY(y),
    size: 10,
    font: regular,
    color: LABEL,
  })
  advance(14)

  page.drawText(`Valid until ${formatShortDate(data.validUntil)}`, {
    x: MARGIN,
    y: topY(y),
    size: 10,
    font: regular,
    color: LABEL,
  })
  advance(10)

  if (data.status === 'draft') {
    const badge = 'DRAFT'
    const badgeSize = 8
    const badgeW = bold.widthOfTextAtSize(badge, badgeSize) + 14
    const badgeH = 18
    page.drawRectangle({
      x: MARGIN,
      y: topY(y + badgeH),
      width: badgeW,
      height: badgeH,
      color: DRAFT_BG,
      borderColor: DRAFT_TEXT,
      borderWidth: 0.5,
    })
    page.drawText(badge, {
      x: MARGIN + 7,
      y: topY(y + 13),
      size: badgeSize,
      font: bold,
      color: DRAFT_TEXT,
    })
    advance(badgeH + 6)
  }

  advance(18)

  // ── From / Bill to ───────────────────────────────────────────────────────
  const fromLines: string[] = [data.supplier.name]
  if (data.supplier.address) fromLines.push(data.supplier.address)
  if (data.supplier.gstin) fromLines.push(`GSTIN ${data.supplier.gstin}`)
  if (data.supplier.pan) fromLines.push(`PAN ${data.supplier.pan}`)
  if (data.supplier.phone) fromLines.push(data.supplier.phone)
  if (data.supplier.email) fromLines.push(data.supplier.email)

  const billLines: string[] = [data.buyer.companyName]
  if (data.buyer.contactName) billLines.push(data.buyer.contactName)
  if (data.buyer.phone) billLines.push(data.buyer.phone)
  if (data.buyer.email) billLines.push(data.buyer.email)

  const colMid = MARGIN + CONTENT_W / 2 + 8
  const fromEnd = drawLabelValueBlock(page, 'From', fromLines, MARGIN, y, regular, bold)
  const billEnd = drawLabelValueBlock(page, 'Bill to', billLines, colMid, y, regular, bold)
  y = Math.max(fromEnd, billEnd) + 20

  // ── Hero amount ──────────────────────────────────────────────────────────
  ensureSpace(44)
  page.drawText(`${inr(data.finalAmount)} quoted`, {
    x: MARGIN,
    y: topY(y),
    size: 18,
    font: bold,
    color: INK,
  })
  advance(22)

  page.drawText(`Valid until ${formatLongDate(data.validUntil)}`, {
    x: MARGIN,
    y: topY(y),
    size: 10,
    font: regular,
    color: LABEL,
  })
  advance(28)

  // ── Line items table ─────────────────────────────────────────────────────
  ensureSpace(36)
  const headerY = y + 10
  page.drawText('DESCRIPTION', { x: COL.desc.x, y: topY(headerY), size: 8, font: bold, color: LABEL })
  page.drawText('QTY', {
    x: COL.qty.right - COL.qty.w,
    y: topY(headerY),
    size: 8,
    font: bold,
    color: LABEL,
  })
  drawColRight(page, 'UNIT PRICE', COL.unit, headerY, bold, 8, LABEL)
  drawColRight(page, 'DISC', COL.disc, headerY, bold, 8, LABEL)
  drawColRight(page, 'AMOUNT', COL.amt, headerY, bold, 8, LABEL)
  advance(16)
  drawRule(page, y)
  advance(14)

  for (const item of data.items) {
    const lineTotal = Math.max(0, item.quantity * item.price - item.discount)
    const descLines = wrapText(item.description, bold, 10, COL.desc.w)
    const rowH = Math.max(28, descLines.length * 13 + 10)

    ensureSpace(rowH + 4)

    for (const [i, line] of descLines.entries()) {
      page.drawText(line, {
        x: COL.desc.x,
        y: topY(y + 12 + i * 13),
        size: 10,
        font: bold,
        color: INK,
      })
    }

    const rowMid = y + rowH / 2 + 4
    drawColRight(page, String(item.quantity), COL.qty, rowMid, regular, 10)
    drawColRight(page, inr(item.price), COL.unit, rowMid, regular, 10)
    drawColRight(
      page,
      item.discount ? inr(item.discount) : '-',
      COL.disc,
      rowMid,
      regular,
      10,
      LABEL
    )
    drawColRight(page, inr(lineTotal), COL.amt, rowMid, bold, 10)

    y += rowH
    drawRule(page, y, 0)
    advance(4)
  }

  advance(16)

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalsRight = PAGE_W - MARGIN
  const totalsLabelX = totalsRight - 180
  const totalsValueX = totalsRight

  function totalRow(label: string, value: string, emphasis = false) {
    ensureSpace(18)
    const size = emphasis ? 11 : 10
    const labelFont = emphasis ? bold : regular
    const valueFont = emphasis ? bold : regular
    const color = emphasis ? NAVY : INK
    const labelColor = emphasis ? NAVY : LABEL

    page.drawText(label, {
      x: totalsLabelX,
      y: topY(y + 12),
      size,
      font: labelFont,
      color: labelColor,
    })
    drawRight(page, value, totalsValueX, y + 12, valueFont, size, color)
    advance(18)
  }

  totalRow('Subtotal', inr(data.totalAmount))
  if (data.discount > 0) {
    totalRow('Discount', `- ${inr(data.discount)}`)
  }
  advance(4)
  drawRule(page, y, totalsRight - PAGE_W + MARGIN)
  advance(10)
  totalRow('Total', inr(data.finalAmount), true)

  // ── Notes & terms ────────────────────────────────────────────────────────
  if (data.notes) {
    advance(20)
    ensureSpace(40)
    page.drawText('Notes', { x: MARGIN, y: topY(y), size: 9, font: bold, color: LABEL })
    advance(14)

    const noteLines = wrapText(data.notes, regular, 9, CONTENT_W)
    for (const line of noteLines) {
      ensureSpace(13)
      page.drawText(line, { x: MARGIN, y: topY(y), size: 9, font: regular, color: INK })
      advance(13)
    }
  }

  if (data.terms) {
    advance(12)
    ensureSpace(40)
    page.drawText('Terms', { x: MARGIN, y: topY(y), size: 9, font: bold, color: LABEL })
    advance(14)

    const termLines = wrapText(data.terms, regular, 9, CONTENT_W)
    for (const line of termLines) {
      ensureSpace(13)
      page.drawText(line, { x: MARGIN, y: topY(y), size: 9, font: regular, color: INK })
      advance(13)
    }
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const pages = pdfDoc.getPages()
  const footer =
    `${data.quoteNumber} · ${inr(data.finalAmount)} · valid until ${formatShortDate(data.validUntil)}`
  const footerNote =
    'Computer-generated quotation. Subject to stock confirmation and prevailing market rates.'

  for (const p of pages) {
    const footerWidth = regular.widthOfTextAtSize(footer, 8)
    p.drawText(footer, {
      x: (PAGE_W - footerWidth) / 2,
      y: FOOTER_Y + 10,
      size: 8,
      font: regular,
      color: LABEL,
    })

    const noteWidth = regular.widthOfTextAtSize(footerNote, 7)
    p.drawText(footerNote, {
      x: (PAGE_W - noteWidth) / 2,
      y: FOOTER_Y,
      size: 7,
      font: regular,
      color: LABEL,
    })
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
