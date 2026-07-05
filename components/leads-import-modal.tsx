'use client'

import { useState } from 'react'
import { api } from '@/lib/api-client'
import { toFormErrors } from '@/lib/form-errors'
import { parseCsvWithHeader } from '@/lib/csv'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'

// Accepted header aliases (lowercased) -> canonical field
const HEADER_MAP: Record<string, string> = {
  company: 'companyName',
  'company name': 'companyName',
  companyname: 'companyName',
  'first name': 'firstName',
  firstname: 'firstName',
  'contact first name': 'firstName',
  'last name': 'lastName',
  lastname: 'lastName',
  'contact last name': 'lastName',
  email: 'email',
  phone: 'phone',
  'contact number': 'phone',
  priority: 'priority',
  source: 'source',
  notes: 'notes',
}

interface ImportResult {
  created: number
  failed: number
  errors: { row: number; message: string }[]
}

export function LeadsImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: () => void
}) {
  const { toast } = useToast()
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseCsvWithHeader(text)
    if (parsed.length === 0) {
      setError('No data rows found. The first line must be a header row.')
      setRows([])
      return
    }
    const mapped = parsed.map((raw) => {
      const row: Record<string, string> = {}
      for (const [key, value] of Object.entries(raw)) {
        const field = HEADER_MAP[key]
        if (field && value) row[field] = value
      }
      return row
    })
    setRows(mapped)
  }

  async function handleImport() {
    setImporting(true)
    setError(null)
    try {
      const res = await api.post<ImportResult>('/leads/import', { rows })
      setResult(res.data ?? null)
      if (res.data && res.data.failed === 0) {
        toast(`${res.data.created} lead(s) imported`)
        onImported()
        onClose()
      } else {
        onImported()
      }
    } catch (err) {
      setError(toFormErrors(err, 'Import failed').message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal title="Import leads from CSV" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Required columns: <code>Company</code>, <code>First Name</code>, <code>Last Name</code>,{' '}
          <code>Email</code>, <code>Phone</code>. Optional: <code>Priority</code>,{' '}
          <code>Source</code>, <code>Notes</code>. Max 500 rows per import.
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="csv-file" className="text-sm font-medium">
            CSV file
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="text-sm"
          />
        </div>

        {rows.length > 0 && !result && (
          <p className="text-sm">
            <span className="font-medium">{rows.length}</span> row(s) parsed from{' '}
            <span className="font-medium">{fileName}</span>.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && (
          <div className="rounded-md border border-border p-3 text-sm">
            <p>
              Imported <span className="font-medium">{result.created}</span>, failed{' '}
              <span className="font-medium">{result.failed}</span>.
            </p>
            {result.errors.slice(0, 10).map((e) => (
              <p key={e.row} className="text-destructive">
                Row {e.row}: {e.message}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" disabled={rows.length === 0 || importing} onClick={handleImport}>
            {importing ? 'Importing…' : `Import ${rows.length || ''} lead(s)`}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
