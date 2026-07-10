'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { AuthField, AuthShell, authButtonClass, authInputClass, authLinkClass } from '@/components/auth/auth-shell'
import { dashboardRouteForRole } from '@/lib/dashboard-routes'

function passwordStrength(password: string): { score: number; label: string } {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  return { score, label: labels[Math.min(score, 5)] }
}

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const strength = useMemo(() => passwordStrength(password), [password])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          orgName: orgName.trim(),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.success) {
        const details = body.error?.details
        const detailMsg = Array.isArray(details)
          ? details.map((d: { message?: string }) => d.message).filter(Boolean).join('. ')
          : null
        throw new Error(detailMsg || body.error?.message || 'Could not create your workspace')
      }

      const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        // Account created — send them to login if auto sign-in fails
        router.push(`/auth/login?email=${encodeURIComponent(email.trim())}`)
        return
      }

      const role = body.data?.user?.role ?? 'admin'
      router.push(dashboardRouteForRole(role))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Start with your company — invite your team after."
      footer={
        <>
          Already on veck?{' '}
          <Link href="/auth/login" className={authLinkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField id="fullName" label="Your name">
          <input
            id="fullName"
            required
            autoComplete="name"
            placeholder="Vansh Gupta"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={authInputClass}
          />
        </AuthField>

        <AuthField id="orgName" label="Company / workspace name">
          <input
            id="orgName"
            required
            autoComplete="organization"
            placeholder="Veck Pvt. Ltd."
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className={authInputClass}
          />
        </AuthField>

        <AuthField id="email" label="Work email">
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
            password ? (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < strength.score
                          ? strength.score >= 4
                            ? 'bg-emerald-500'
                            : strength.score >= 2
                              ? 'bg-amber-500'
                              : 'bg-destructive'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-400">{strength.label}</span>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">At least 8 characters</p>
            )
          }
        >
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="Create a password"
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

        <AuthField id="confirm" label="Confirm password">
          <input
            id="confirm"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Repeat password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authInputClass}
          />
        </AuthField>

        {error && (
          <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? 'Creating workspace…' : 'Create workspace'}
        </Button>

        <p className="text-center text-xs leading-relaxed text-slate-500">
          By continuing you agree to use veck for your team&apos;s lead and order operations.
        </p>
      </form>
    </AuthShell>
  )
}
