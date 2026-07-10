'use client'

import { useEffect, useRef } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

/**
 * Keep leads UI fresh: Supabase Realtime on Lead rows + quiet polling fallback.
 * Callers re-fetch softly — never blank the table or wipe tab prefetch cache.
 */
export function useLeadsLive(onChange: () => void) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null

    function bump() {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        onChangeRef.current()
      }, 250)
    }

    const channel = supabaseBrowser
      .channel('leads-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Lead' },
        () => bump()
      )
      .subscribe()

    // Fallback when Realtime isn't enabled on the project yet.
    const poll = setInterval(() => {
      onChangeRef.current()
    }, 20_000)

    const onFocus = () => onChangeRef.current()
    window.addEventListener('focus', onFocus)
    const onVis = () => {
      if (document.visibilityState === 'visible') onChangeRef.current()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      if (debounce) clearTimeout(debounce)
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      supabaseBrowser.removeChannel(channel)
    }
  }, [])
}
