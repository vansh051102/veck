'use client'

import Image from 'next/image'
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
    <div className="auth-dark relative flex min-h-dvh flex-col text-slate-100">
      {/* Fixed full-bleed canvas — never reveals light body on overscroll */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-[#070b12]" />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <Image
          src="/auth-bg-steel-navy.jpg"
          alt=""
          fill
          priority
          quality={92}
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      {/* Depth + readability scrims — keep the photo visible, form legible */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(7,11,18,0.15),transparent_55%),linear-gradient(180deg,rgba(7,11,18,0.45)_0%,rgba(7,11,18,0.55)_45%,rgba(7,11,18,0.78)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(90%_70%_at_50%_-10%,rgba(72,116,162,0.2),transparent_50%),radial-gradient(50%_40%_at_100%_90%,rgba(30,66,106,0.28),transparent_45%)]"
      />
      <div aria-hidden className="auth-grid pointer-events-none fixed inset-0 z-0 opacity-[0.22]" />

      <div
        className={cn(
          'relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-14 sm:px-6',
          className
        )}
      >
        <header className="auth-enter text-center">
          <Link
            href="/auth/login"
            className="group inline-flex flex-col items-center gap-3 transition-opacity hover:opacity-95"
            aria-label={BRAND.name}
          >
            <span className="font-display text-[3.75rem] font-semibold leading-none tracking-[-0.06em] text-white sm:text-[4.25rem]">
              <span className="text-[#8aadc8]">v</span>
              <span>eck</span>
            </span>
            <span
              aria-hidden
              className="h-px w-14 bg-gradient-to-r from-transparent via-[#4a7aa8] to-transparent opacity-90 transition-[width] duration-300 group-hover:w-20"
            />
          </Link>
          <p className="auth-enter-delay-1 mx-auto mt-7 max-w-[20rem] text-balance text-[1.05rem] font-medium leading-snug tracking-tight text-slate-200 sm:text-lg">
            {BRAND.tagline}
          </p>
          <p className="auth-enter-delay-2 mx-auto mt-3 max-w-[18rem] text-pretty text-[13px] leading-relaxed text-slate-400">
            {BRAND.description}
          </p>
        </header>

        <div className="auth-enter-delay-3 mt-10">
          <div className="auth-glass-card rounded-2xl p-6 sm:p-7">
            <div className="mb-6 text-center">
              <h1 className="text-lg font-semibold tracking-tight text-white">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}
            </div>
            {children}
          </div>
        </div>

        {footer && (
          <footer className="auth-enter-delay-4 mt-8 text-center text-sm text-slate-400">
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
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
      {hint}
    </div>
  )
}

export const authInputClass =
  'h-11 w-full rounded-xl border border-white/[0.06] bg-black/25 px-3.5 text-sm text-slate-100 outline-none backdrop-blur-sm transition-[box-shadow,border-color,background-color] placeholder:text-slate-500 focus:border-[#4a7aa8]/60 focus:bg-black/35 focus:ring-2 focus:ring-[#4a7aa8]/25'

export const authLinkClass =
  'font-medium text-[#8aadc8] underline-offset-2 transition-colors hover:text-[#a8c5db] hover:underline'

export const authButtonClass =
  'h-11 w-full rounded-xl bg-[#4a7aa8] text-sm font-semibold text-white shadow-[0_12px_40px_-12px_rgba(74,122,168,0.55)] transition-[transform,background-color,box-shadow] hover:bg-[#5a8ab8] active:scale-[0.99] disabled:opacity-60'
