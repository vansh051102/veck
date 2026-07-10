'use client'

import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

interface AuthShellProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function AuthShell({ title, subtitle, children, footer, className }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Atmospheric plane — navy depth, not flat white */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_-10%,hsl(207_85%_61%/0.22),transparent_55%),radial-gradient(90%_70%_at_100%_0%,hsl(206_79%_28%/0.35),transparent_50%),linear-gradient(165deg,hsl(210_33%_99%)_0%,hsl(210_40%_96%)_45%,hsl(214_28%_92%)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(hsl(206_79%_28%/0.06)_1px,transparent_1px),linear-gradient(90deg,hsl(206_79%_28%/0.06)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />

      <div
        className={cn(
          'relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-14 sm:px-6',
          className
        )}
      >
        <header className="auth-enter text-center">
          <Link
            href="/auth/login"
            className="inline-block text-[2.75rem] font-semibold leading-none tracking-[-0.06em] text-primary transition-opacity hover:opacity-90 sm:text-5xl"
          >
            {BRAND.name}
          </Link>
          <p className="auth-enter-delay-1 mx-auto mt-5 max-w-[22rem] text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {BRAND.tagline}
          </p>
          <p className="auth-enter-delay-2 mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            {BRAND.description}
          </p>
        </header>

        <div className="auth-enter-delay-3 mt-10">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {children}
        </div>

        {footer && (
          <footer className="auth-enter-delay-4 mt-8 text-center text-sm text-muted-foreground">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

export function AuthField({
  id,
  label,
  children,
  hint,
}: {
  id: string
  label: string
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint}
    </div>
  )
}

export const authInputClass =
  'h-11 w-full rounded-lg border border-border/80 bg-card/80 px-3.5 text-sm shadow-soft outline-none backdrop-blur-sm transition-[box-shadow,border-color] placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/25'
