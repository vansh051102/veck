'use client'

import { useEffect, useRef } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

/**
 * Keep leads UI fresh via Supabase Realtime only.
 * Polling was removed — it re-triggered list fetches and starved the lead drawer.
 */
export function useLeadsLive(onChange: () => void) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null
    let lastBump = 0

    function bump() {
      const now = Date.now()
      if (now - lastBump < 5_000) return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        lastBump = Date.now()
        onChangeRef.current()
      }, 1_000)
    }

    const channel = supabaseBrowser
      .channel('leads-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Lead' },
        () => bump()
      )
      .subscribe()

    return () => {
      if (debounce) clearTimeout(debounce)
      supabaseBrowser.removeChannel(channel)
    }
  }, [])
}
