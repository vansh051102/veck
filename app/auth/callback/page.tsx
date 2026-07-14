'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

// Magic-link landing page. Supabase redirects here after verifying the
// link, as either a PKCE `?code=` (exchanged for a session) or, on
// implicit-flow projects, an `#access_token=...` hash fragment (only
// readable client-side, never sent to the server). Handling both means
// quick-login works regardless of the project's configured auth flow.
// supabaseBrowser (auth-helpers-nextjs) writes the resulting session into
// cookies, which is what middleware's getSession() reads on the next request.
function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function run() {
      const next = searchParams.get('next') ?? '/dashboard'
      const code = searchParams.get('code')

      if (code) {
        await supabaseBrowser.auth.exchangeCodeForSession(code)
      } else if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')
        if (access_token && refresh_token) {
          await supabaseBrowser.auth.setSession({ access_token, refresh_token })
        }
      }

      router.replace(next)
    }
    run()
  }, [router, searchParams])

  return <div className="text-sm text-muted-foreground">Signing in…</div>
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Signing in…</div>}>
      <CallbackInner />
    </Suspense>
  )
}
