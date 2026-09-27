import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.',
  )
}

export const supabase = createClient(url, key)

/** Returns true if the Supabase project answers a health check. */
export async function checkSupabase(): Promise<boolean> {
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
    })
    return res.ok
  } catch {
    return false
  }
}
