import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { BRAND } from '@/lib/brand'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.metaDescription,
}

const themeInitScript = `
  (function () {
    try {
      var stored = localStorage.getItem('veck-theme');
      var theme = stored || 'light';
      if (theme === 'dark') document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-sm text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
