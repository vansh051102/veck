'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import {
  AuthField,
  AuthShell,
  authButtonClass,
  authInputClass,
  authLinkClass,
} from '@/components/auth/auth-shell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // try/finally: resetPasswordForEmail can reject (network failure) rather
    // than resolve with {error} — without this, that path left the button
    // frozen on "Sending…" forever, same bug as the login form had.
    try {
      const { error: resetError } = await supabaseBrowser.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/auth/login` }
      )
      if (resetError) {
        setError(resetError.message)
        return
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We’ll email you a secure link if that account exists."
      footer={
        <Link href="/auth/login" className={authLinkClass}>
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-6 text-center">
          <p className="text-sm leading-relaxed text-slate-400">
            If an account exists for <span className="font-medium text-slate-100">{email}</span>, a
            reset link is on its way. Check your inbox and spam folder.
          </p>
          <Link href="/auth/login" className={`mt-5 inline-block text-sm ${authLinkClass}`}>
            Return to sign in
          </Link>
        </div>
      ) : (
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
          {error && (
            <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
