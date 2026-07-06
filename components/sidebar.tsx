'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, LayoutDashboard, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/lib/use-current-user'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  permissions: string[] // empty = everyone can see
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permissions: [] },
  { href: '/leads', label: 'Leads', icon: Users, permissions: ['leads:read'] },
  { href: '/analytics', label: 'Analytics', icon: BarChart2, permissions: ['analytics:read'] },
  { href: '/settings', label: 'Settings', icon: Settings, permissions: ['settings:edit'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const user = useCurrentUser()

  // Filter nav items based on user permissions
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.permissions.length === 0) return true
    if (!user) return false
    if (user.permissions.includes('*')) return true
    return item.permissions.some((p) => user.permissions.includes(p))
  })

  return (
    <nav className="flex h-full flex-col gap-1 border-r border-border bg-card p-3">
      <div className="mb-4 px-2 py-2 text-lg font-semibold">VECK</div>
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
