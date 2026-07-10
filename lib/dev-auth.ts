/** Temporary dev bypass — set DISABLE_AUTH=true in .env.local. Never use in production. */
export function isAuthDisabled(): boolean {
  return (
    process.env.DISABLE_AUTH === 'true' ||
    process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'
  )
}
