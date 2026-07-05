import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VECK',
  description: 'Steel trading operating system',
}

// Applies the saved theme before React hydrates, avoiding a flash of the
// wrong theme on load. Kept as a tiny inline script rather than a client
// component so it runs before paint.
const themeInitScript = `
  (function () {
    try {
      var stored = localStorage.getItem('veck-theme');
      var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      if (theme === 'dark') document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
