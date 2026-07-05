'use client'

import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'

export default function InactiveAccountPage() {
  const router = useRouter()

  async function handleSignOut() {
    await supabaseBrowser.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">Account inactive</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Your account has been deactivated or suspended. Please contact your workspace
          administrator to restore access.
        </p>
        <Button onClick={handleSignOut} className="w-full">
          Sign out
        </Button>
      </div>
    </div>
  )
}
