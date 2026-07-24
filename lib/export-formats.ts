import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import ExcelJS from 'exceljs'

export type ExportRow = Array<string | number | null | undefined>

export function toJson(headers: string[], rows: ExportRow[]): string {
  return JSON.stringify(
    rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? null]))),
    null,
    2
  )
}

/** Hard cap enforced by the caller before invoking this — pdf-lib renders the
 *  whole document in memory, so an uncapped row count risks a Node OOM. */
export async function toXlsx(headers: string[], rows: ExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Export')
  sheet.addRow(headers)
  sheet.getRow(1).font = { bold: true }
  for (const row of rows) sheet.addRow(row)
  sheet.columns.forEach((col) => {
    col.width = 18
  })
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/** Reads the first sheet's rows for import. Returns header row + data rows,
 *  matching parseCsvWithHeader's shape (array of column values per row). */
export async function fromXlsx(buffer: Buffer): Promise<{ headers: string[]; rows: string[][] }> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)
  const sheet = workbook.worksheets[0]
  if (!sheet) return { headers: [], rows: [] }

  const values: string[][] = []
  sheet.eachRow((row) => {
    const cells: string[] = []
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cell.value == null ? '' : String(cell.value))
    })
    values.push(cells)
  })

  const [headers = [], ...rows] = values
  return { headers, rows }
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 40
const ROW_H = 16
const FONT_SIZE = 8

/** Simple multi-page tabular PDF — headers repeated on every page. Caller
 *  must enforce the row cap before calling; this does no capping itself. */
export async function toPdf(headers: string[], rows: ExportRow[]): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const colWidth = (PAGE_W - MARGIN * 2) / headers.length
  const ink = rgb(0.1, 0.1, 0.1)
  const rule = rgb(0.85, 0.85, 0.85)

  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  function drawHeaderRow() {
    headers.forEach((h, i) => {
      page.drawText(truncate(String(h), colWidth, bold, FONT_SIZE), {
        x: MARGIN + i * colWidth,
        y,
        size: FONT_SIZE,
        font: bold,
        color: ink,
      })
    })
    y -= ROW_H
    page.drawLine({
      start: { x: MARGIN, y: y + ROW_H / 2 },
      end: { x: PAGE_W - MARGIN, y: y + ROW_H / 2 },
      thickness: 0.5,
      color: rule,
    })
  }

  drawHeaderRow()

  for (const row of rows) {
    if (y < MARGIN + ROW_H) {
      page = doc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
      drawHeaderRow()
    }
    row.forEach((cell, i) => {
      const text = cell === null || cell === undefined ? '' : String(cell)
      page.drawText(truncate(text, colWidth, font, FONT_SIZE), {
        x: MARGIN + i * colWidth,
        y,
        size: FONT_SIZE,
        font,
        color: ink,
      })
    })
    y -= ROW_H
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

function truncate(text: string, maxWidth: number, font: any, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth - 4) return text
  let out = text
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth - 4) {
    out = out.slice(0, -1)
  }
  return `${out}…`
}
