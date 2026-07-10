import { createClient } from '@supabase/supabase-js'
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from './supabase-env'

const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = createClient(supabaseUrl, getSupabaseServiceRoleKey())
