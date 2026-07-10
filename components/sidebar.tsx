'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Contact, LayoutDashboard, Settings, Trophy, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/providers/auth-provider'
import { dashboardRouteForRole } from '@/lib/dashboard-routes'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  permissions: string[]
}

const NAV_ICONS = { LayoutDashboard, Users, Contact, BarChart2, Trophy, Settings } as const

export function Sidebar() {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  const role = user?.role ?? 'admin'
  const overviewHref = dashboardRouteForRole(role)

  const navItems: NavItem[] = [
    {
      href: overviewHref,
      label: 'Overview',
      icon: NAV_ICONS.LayoutDashboard,
      permissions: [],
    },
    { href: '/leads', label: 'Leads', icon: NAV_ICONS.Users, permissions: ['leads:read'] },
    { href: '/contacts', label: 'Contacts', icon: NAV_ICONS.Contact, permissions: ['contacts:read'] },
    {
      href: '/analytics',
      label: 'Analytics',
      icon: NAV_ICONS.BarChart2,
      permissions: ['analytics:read'],
    },
    { href: '/performance', label: 'Performance', icon: NAV_ICONS.Trophy, permissions: [] },
    {
      href: role === 'admin' ? '/admin' : '/settings',
      label: role === 'admin' ? 'Admin' : 'Settings',
      icon: NAV_ICONS.Settings,
      permissions: role === 'admin' ? [] : ['settings:edit'],
    },
  ]

  const visibleItems = navItems.filter((item) => {
    if (item.permissions.length === 0) return true
    // Keep the full rail painted while auth resolves — avoids icon pop-in.
    if (isLoading || !user) return true
    if (user.permissions.includes('*')) return true
    return item.permissions.some((p) => user.permissions.includes(p))
  })

  const initial = user?.fullName?.[0]?.toUpperCase() ?? 'v'
  const displayName = user?.fullName ?? (isLoading ? 'Loading…' : 'Profile')

  return (
    <nav className="flex h-full w-56 flex-col border-r border-border bg-primary py-4 text-primary-foreground">
      <Link
        href={overviewHref}
        className="mx-3 mb-5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-primary-foreground/10"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-sm font-bold tracking-tight">
          v
        </span>
        <span className="text-lg font-semibold tracking-tight">veck</span>
      </Link>

      <div className="flex flex-1 flex-col gap-0.5 px-2">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== '/' && pathname?.startsWith(href + '/')) ||
            (href.startsWith('/dashboards') && pathname?.startsWith('/dashboards')) ||
            (href === '/admin' && pathname?.startsWith('/admin'))
          return (
            <Link
              key={`${href}-${label}`}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </div>

      <Link
        href="/profile"
        className="mx-2 mt-auto flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-primary-foreground/10"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
          {initial}
        </span>
        <span className="min-w-0 truncate text-sm font-medium">{displayName}</span>
      </Link>
    </nav>
  )
}
