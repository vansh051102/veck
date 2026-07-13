'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  open?: boolean
  size?: 'default' | 'lg'
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  default: 'max-w-lg',
  lg: 'max-w-3xl',
}

export function Modal({ title, onClose, children, open = true, size = 'default' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16 sm:pt-24 animate-fade-in"
      onMouseDown={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${SIZE_CLASSES[size]} rounded-lg border border-border bg-card shadow-modal`}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
