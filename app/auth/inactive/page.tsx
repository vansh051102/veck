'use client'

import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { AuthShell, authButtonClass } from '@/components/auth/auth-shell'

export default function InactiveAccountPage() {
  const router = useRouter()

  async function handleSignOut() {
    await supabaseBrowser.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <AuthShell
      title="Account inactive"
      subtitle="Your access has been paused by a workspace admin."
    >
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-6 text-center">
        <p className="text-sm leading-relaxed text-slate-400">
          Contact your administrator to restore access. You can sign out and use a different account
          in the meantime.
        </p>
        <Button onClick={handleSignOut} className={`mt-5 ${authButtonClass}`}>
          Sign out
        </Button>
      </div>
    </AuthShell>
  )
}
