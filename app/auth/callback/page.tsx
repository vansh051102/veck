'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

// Magic-link landing page. Supabase redirects here after verifying the
// link, as either a PKCE `?code=` (exchanged for a session) or, on
// implicit-flow projects, an `#access_token=...` hash fragment (only
// readable client-side, never sent to the server). Handling both means
// quick-login works regardless of the project's configured auth flow.
// supabaseBrowser (auth-helpers-nextjs) writes the resulting session into
// cookies, which is what middleware's getSession() reads on the next request.
function CallbackInner() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      const next = searchParams.get('next') ?? '/dashboard'
      const code = searchParams.get('code')

      try {
        if (code) {
          const { error: exchangeError } = await supabaseBrowser.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            setError(exchangeError.message)
            return
          }
        } else if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.slice(1))
          const access_token = hashParams.get('access_token')
          const refresh_token = hashParams.get('refresh_token')
          if (access_token && refresh_token) {
            const { error: sessionError } = await supabaseBrowser.auth.setSession({
              access_token,
              refresh_token,
            })
            if (sessionError) {
              setError(sessionError.message)
              return
            }
          }
        }

        // Hard navigation, not router.replace: a quick-logged-in tab reused
        // for a different account can still hold the previous user's Next.js
        // router cache, flashing stale data before the fresh RSC payload
        // resolves. A full reload wipes router cache, React state, and any
        // stale in-memory Supabase client instance.
        const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
        window.location.href = safeNext
      } catch (err) {
        // exchangeCodeForSession/setSession can also reject outright (network
        // failure) rather than resolve with {error} — without this, that path
        // left the page stuck on "Signing in…" forever with no way out.
        setError(err instanceof Error ? err.message : 'Network error — please try again')
      }
    }
    run()
  }, [searchParams])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/auth/login" className="text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    )
  }

  return <div className="text-sm text-muted-foreground">Signing in…</div>
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Signing in…</div>}>
      <CallbackInner />
    </Suspense>
  )
}
