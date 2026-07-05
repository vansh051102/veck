'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Singleton browser Supabase client, shared across client components so
// auth state (and the session used for API bearer tokens) stays in sync.
export const supabaseBrowser = createClientComponentClient()
