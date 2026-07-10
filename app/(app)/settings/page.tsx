'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/providers/auth-provider'

export default function SettingsRedirectPage() {
  const { user, org, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (user?.role === 'admin' && org?.id) {
      router.replace(`/admin/workspace/${org.id}/company-details`)
    } else if (user?.role === 'admin') {
      router.replace('/admin')
    } else {
      router.replace('/profile')
    }
  }, [user, org, isLoading, router])

  return <p className="text-sm text-muted-foreground">Redirecting…</p>
}
