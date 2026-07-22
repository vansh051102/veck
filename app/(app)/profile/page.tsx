'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { toFormErrors } from '@/lib/form-errors'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useCurrentUser, invalidateCurrentUser } from '@/lib/use-current-user'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

const inputClass =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

function roleLabel(role?: string | null) {
  if (!role) return 'Member'
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function ProfilePage() {
  const me = useCurrentUser()
  const { toast } = useToast()

  const [fullName, setFullName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (me) setFullName(me.fullName)
  }, [me])

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailChangeRequested, setEmailChangeRequested] = useState(false)

  const initial = me?.fullName?.[0]?.toUpperCase() ?? 'V'
  const nameDirty = Boolean(me && fullName.trim() && fullName.trim() !== me.fullName)

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault()
    setNameError(null)
    if (!fullName.trim()) {
      setNameError('Enter your full name')
      return
    }
    setNameSaving(true)
    try {
      await api.put('/users/me', { fullName: fullName.trim() })
      invalidateCurrentUser()
      toast('Name updated')
    } catch (err) {
      setNameError(toFormErrors(err, 'Failed to update name').message)
    } finally {
      setNameSaving(false)
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    setPasswordSaving(true)
    // try/finally: updateUser can reject (network failure) rather than resolve
    // with {error} — without this, that path left the button frozen on
    // "Saving…" forever, same bug as the login form had.
    try {
      const { error } = await supabaseBrowser.auth.updateUser({ password: newPassword })
      if (error) {
        setPasswordError(error.message)
        return
      }
      setNewPassword('')
      setConfirmPassword('')
      toast('Password updated')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Network error — please try again')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleEmailSave(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    if (!newEmail.trim()) {
      setEmailError('Enter the new email address')
      return
    }
    setEmailSaving(true)
    try {
      const { error } = await supabaseBrowser.auth.updateUser({ email: newEmail.trim() })
      if (error) {
        setEmailError(error.message)
        return
      }
      setEmailChangeRequested(true)
      setNewEmail('')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Network error — please try again')
    } finally {
      setEmailSaving(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <section className="flex items-start gap-4 rounded-lg border border-border bg-card p-5 shadow-soft">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {initial}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">
            {me?.fullName ?? 'Your profile'}
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{me?.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {roleLabel(me?.role)}
            </span>
            {me?.department && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                {me.department}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Display name</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shown across leads, assignments, and activity.
          </p>
        </div>
        <form onSubmit={handleNameSave} className="flex flex-col gap-3 px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-full-name" className="text-sm font-medium">
              Full name
            </label>
            <input
              id="profile-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              autoComplete="name"
            />
          </div>
          {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          <Button type="submit" size="sm" disabled={nameSaving || !nameDirty} className="self-start">
            {nameSaving ? 'Saving…' : 'Save name'}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Password</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Use at least 8 characters. You will stay signed in after changing it.
          </p>
        </div>
        <form onSubmit={handlePasswordSave} className="flex flex-col gap-3 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-new-password" className="text-sm font-medium">
                New password
              </label>
              <input
                id="profile-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-confirm-password" className="text-sm font-medium">
                Confirm password
              </label>
              <input
                id="profile-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
              />
            </div>
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          <Button
            type="submit"
            size="sm"
            disabled={passwordSaving || !newPassword || !confirmPassword}
            className="self-start"
          >
            {passwordSaving ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Email</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Login email for this workspace. Changes need confirmation on both addresses.
          </p>
        </div>
        <form onSubmit={handleEmailSave} className="flex flex-col gap-3 px-5 py-4">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Current email
            </p>
            <p className="mt-0.5 text-sm font-medium">{me?.email ?? '—'}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-new-email" className="text-sm font-medium">
              New email address
            </label>
            <input
              id="profile-new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
              placeholder="name@company.com"
            />
          </div>
          {emailError && <p className="text-sm text-destructive">{emailError}</p>}
          {emailChangeRequested && (
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground">
              Confirmation links were sent to your old and new email. Your login email updates only
              after you confirm both.
            </p>
          )}
          <Button type="submit" size="sm" disabled={emailSaving || !newEmail.trim()} className="self-start">
            {emailSaving ? 'Sending…' : 'Request email change'}
          </Button>
        </form>
      </section>
    </div>
  )
}
