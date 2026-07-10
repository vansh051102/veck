'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { toFormErrors } from '@/lib/form-errors'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useCurrentUser, invalidateCurrentUser } from '@/lib/use-current-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

const inputClass = 'crm-input'

export default function ProfilePage() {
  const me = useCurrentUser()
  const { toast } = useToast()

  // Full name
  const [fullName, setFullName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (me) setFullName(me.fullName)
  }, [me])

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Email
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailChangeRequested, setEmailChangeRequested] = useState(false)

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault()
    setNameError(null)
    setNameSaving(true)
    try {
      await api.put('/users/me', { fullName })
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
    const { error } = await supabaseBrowser.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) {
      setPasswordError(error.message)
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    toast('Password updated')
  }

  async function handleEmailSave(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setEmailSaving(true)
    const { error } = await supabaseBrowser.auth.updateUser({ email: newEmail })
    setEmailSaving(false)
    if (error) {
      setEmailError(error.message)
      return
    }
    setEmailChangeRequested(true)
    setNewEmail('')
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">Manage your account details for this workspace.</p>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Full Name</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNameSave} className="flex flex-col gap-3">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              placeholder="Full name"
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            <Button type="submit" size="sm" disabled={nameSaving} className="self-start">
              {nameSaving ? 'Saving…' : 'Save name'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSave} className="flex flex-col gap-3">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="New password"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Confirm new password"
            />
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            <Button type="submit" size="sm" disabled={passwordSaving} className="self-start">
              {passwordSaving ? 'Saving…' : 'Change password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">Current: {me?.email}</p>
          <form onSubmit={handleEmailSave} className="flex flex-col gap-3">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputClass}
              placeholder="New email address"
            />
            {emailError && <p className="text-sm text-destructive">{emailError}</p>}
            {emailChangeRequested && (
              <p className="rounded-md border border-border bg-muted p-3 text-sm">
                Check your inbox at both your old and new email address to confirm this
                change — your login email won&apos;t update until you click the
                confirmation link.
              </p>
            )}
            <Button type="submit" size="sm" disabled={emailSaving} className="self-start">
              {emailSaving ? 'Sending…' : 'Change email'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
