import type { ReactNode } from 'react'

/** Auth routes paint their own dark canvas — keep html/body from flashing white on scroll. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background-color: #070b12 !important;
          background-image: none !important;
        }
      `}</style>
      {children}
    </>
  )
}
