'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface QuotePdfDialogProps {
  quoteNumber: string
  url: string
  onClose: () => void
}

/** In-app PDF preview — portals above the lead drawer (z-60). */
export function QuotePdfDialog({ quoteNumber, url, onClose }: QuotePdfDialogProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Quote ${quoteNumber} preview`}
        className="flex h-[min(92vh,860px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-modal"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{quoteNumber}</h2>
            <p className="text-xs text-muted-foreground">Quotation preview</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download={`${quoteNumber}.pdf`}
              className={cn(
                'inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm font-medium transition-[transform,background-color,opacity,box-shadow] duration-150 hover:bg-muted active:scale-[0.98]'
              )}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <iframe
          src={url}
          title={`Quote ${quoteNumber}`}
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />
      </div>
    </div>,
    document.body
  )
}
