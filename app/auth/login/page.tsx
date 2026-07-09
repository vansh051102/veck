'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { dashboardRouteForRole } from '@/lib/dashboard-routes'

export default function LoginPage() {
  return <Suspense><LoginPageContent /></Suspense>
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const diagnostic = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    return url ? null : 'WARN: NEXT_PUBLIC_SUPABASE_URL is not set'
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({ email, password })

    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      console.error('Sign in error:', signInError)
      return
    }

    // Check for explicit redirect first
    const redirectTo = searchParams.get('redirectTo')
    if (redirectTo) {
      router.push(redirectTo)
      router.refresh()
      return
    }

    // Fetch user role to determine redirect
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (session?.access_token) {
        const res = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const { user } = await res.json()
          const defaultPath = user.defaultDashboard || dashboardRouteForRole(user.role)
          setLoading(false)
          router.push(defaultPath)
          router.refresh()
          return
        }
      }
    } catch {
      // Fall through to default
    }

    setLoading(false)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">VECK</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to your workspace</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {diagnostic && <p className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950 p-2 rounded">{diagnostic}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/auth/forgot-password" className="underline hover:text-foreground">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  )
}
