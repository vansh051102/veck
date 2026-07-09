import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/db'

export const GET = async () => {
  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'UNDEFINED',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'UNDEFINED',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'UNDEFINED',
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'UNDEFINED',
  }

  const checks: Record<string, string> = {}

  try {
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    checks.supabaseClient = 'OK'
  } catch (e: any) {
    checks.supabaseClient = `ERROR: ${e.message}`
  }

  try {
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    checks.supabaseAdmin = 'OK'
  } catch (e: any) {
    checks.supabaseAdmin = `ERROR: ${e.message}`
  }

  try {
    const orgCount = await prisma.organization.count()
    checks.prisma = `CONNECTED (${orgCount} orgs)`
  } catch (e: any) {
    checks.prisma = `ERROR: ${e.message?.substring(0, 200)}`
  }

  return NextResponse.json({ env: vars, checks })
}