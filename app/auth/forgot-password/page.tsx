'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { AuthField, AuthShell, authInputClass } from '@/components/auth/auth-shell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: resetError } = await supabaseBrowser.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/login`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We’ll email you a secure link if that account exists."
      footer={
        <Link href="/auth/login" className="font-medium text-accent underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-border/80 bg-card/80 px-5 py-6 text-center shadow-soft backdrop-blur-sm">
          <p className="text-sm leading-relaxed text-muted-foreground">
            If an account exists for{' '}
            <span className="font-medium text-foreground">{email}</span>, a reset link is on its way.
            Check your inbox and spam folder.
          </p>
          <Link
            href="/auth/login"
            className="mt-5 inline-block text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
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
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-full text-sm font-semibold shadow-soft"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
