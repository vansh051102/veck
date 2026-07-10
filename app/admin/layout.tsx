'use client'

import { AuthProvider } from '@/lib/providers/auth-provider'
import { ToastProvider } from '@/components/ui/toast'

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  )
}
