'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, FileText, Download, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'

interface LeadDoc {
  id: string
  name: string
  mimeType: string | null
  sizeBytes: number
  createdAt: string
  url: string | null
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Documents tab: upload, list (with signed download URLs), and delete files
// attached to a lead. Loads its own data so the parent panel stays lean.
export function LeadDocuments({
  leadId,
  canEdit = true,
}: {
  leadId: string
  canEdit?: boolean
}) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<LeadDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get<LeadDoc[]>(`/leads/${leadId}/documents`)
      setDocs(res.data ?? [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    load()
  }, [load])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      await api.upload(`/leads/${leadId}/documents`, form)
      toast('Document uploaded')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/leads/${leadId}/documents/${id}`)
      setDocs((prev) => prev.filter((d) => d.id !== id))
      toast('Document deleted')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div>
          <input
            ref={fileRef}
            type="file"
            onChange={handleFile}
            className="hidden"
            aria-label="Upload document"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload document'}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents attached yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {humanSize(doc.sizeBytes)} · {formatDate(new Date(doc.createdAt))}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                    aria-label={`Download ${doc.name}`}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-muted"
                    aria-label={`Delete ${doc.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
