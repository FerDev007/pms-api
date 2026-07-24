import { createClient } from '@supabase/supabase-js'

// Usernames are mapped onto synthetic emails so the login form can keep asking for a
// username while Supabase Auth gets the email address it requires.
export const EMAIL_DOMAIN = import.meta.env.VITE_PMS_EMAIL_DOMAIN ?? 'pms.local'
export const emailFor = (username: string) => `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`

// Vite inlines these at build time, so a Cloudflare Pages build with the variables
// missing produces a bundle that fails at runtime with a blank screen. Fail loudly
// instead -- the message names the variable that was not set.
for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_API_URL'] as const) {
  if (!import.meta.env[key]) throw new Error(`Falta la variable de entorno ${key} en la compilación`)
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
)
