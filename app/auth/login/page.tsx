'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import {
  AuthField,
  AuthShell,
  authButtonClass,
  authInputClass,
  authLinkClass,
} from '@/components/auth/auth-shell'
import { dashboardRouteForRole } from '@/lib/dashboard-routes'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setLoading(false)
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Email or password is incorrect'
          : signInError.message
      )
      return
    }

    const redirectTo = searchParams.get('redirectTo')
    if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
      router.push(redirectTo)
      router.refresh()
      return
    }

    try {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession()
      if (session?.access_token) {
        const res = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const body = await res.json()
          const user = body.data?.user ?? body.user
          const defaultPath = user?.defaultDashboard || dashboardRouteForRole(user?.role ?? 'admin')
          setLoading(false)
          router.push(defaultPath)
          router.refresh()
          return
        }
      }
    } catch {
      // fall through
    }

    setLoading(false)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your workspace"
      footer={
        <>
          New to veck?{' '}
          <Link href="/auth/signup" className={authLinkClass}>
            Create a workspace
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField id="email" label="Email">
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </AuthField>

        <AuthField
          id="password"
          label="Password"
          hint={
            <div className="flex justify-end">
              <Link href="/auth/forgot-password" className={`text-sm ${authLinkClass}`}>
                Forgot password?
              </Link>
            </div>
          }
        >
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authInputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </AuthField>

        {error && (
          <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070b12] text-sm text-slate-400">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
