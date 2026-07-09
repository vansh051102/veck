import { NextResponse } from 'next/server'

export const GET = async () => {
  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'UNDEFINED',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'UNDEFINED',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'UNDEFINED',
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'UNDEFINED',
  }
  return NextResponse.json({ env: vars })
}