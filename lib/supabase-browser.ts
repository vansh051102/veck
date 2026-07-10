'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { getSupabasePublicEnv } from './supabase-env'

const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()

// Singleton browser Supabase client, shared across client components so
// auth state (and the session used for API bearer tokens) stays in sync.
export const supabaseBrowser = createClientComponentClient({
  supabaseUrl,
  supabaseKey: supabaseAnonKey,
})
