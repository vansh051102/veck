'use client'

import { useEffect } from 'react'

// Shared LIFO Escape stack. Nested overlays (e.g. the lead drawer with a reason
// modal opened on top of it) previously each attached their own document
// keydown listener, so one Escape closed BOTH. With a single shared listener
// and a stack, only the most-recently-opened overlay closes per Escape press.
const handlers: Array<() => void> = []

function onDocumentKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const top = handlers[handlers.length - 1]
  if (top) {
    e.stopPropagation()
    top()
  }
}

/** Close the topmost overlay on Escape. Register once per open overlay. */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    if (handlers.length === 0) {
      document.addEventListener('keydown', onDocumentKeyDown)
    }
    handlers.push(onEscape)
    return () => {
      const i = handlers.lastIndexOf(onEscape)
      if (i !== -1) handlers.splice(i, 1)
      if (handlers.length === 0) {
        document.removeEventListener('keydown', onDocumentKeyDown)
      }
    }
  }, [onEscape])
}
