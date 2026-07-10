'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { ToastProvider } from '@/components/ui/toast'
import { AuthProvider } from '@/lib/providers/auth-provider'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex h-screen bg-background">
          <div className="hidden shrink-0 md:block">
            <Sidebar />
          </div>

          {mobileNavOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setMobileNavOpen(false)}
              />
              <div className="absolute inset-y-0 left-0">
                <Sidebar />
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onMenuClick={() => setMobileNavOpen(true)} />
            <main className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}
