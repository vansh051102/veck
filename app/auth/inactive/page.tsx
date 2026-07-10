'use client'

import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/auth/auth-shell'

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
      <div className="rounded-xl border border-border/80 bg-card/80 px-5 py-6 text-center shadow-soft backdrop-blur-sm">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Contact your administrator to restore access. You can sign out and use a different account
          in the meantime.
        </p>
        <Button onClick={handleSignOut} className="mt-5 h-11 w-full rounded-full font-semibold">
          Sign out
        </Button>
      </div>
    </AuthShell>
  )
}
