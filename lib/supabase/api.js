// Server-side Supabase client for API routes (Pages Router compatible)
import { createServerClient } from '@supabase/ssr'

export function createClient(req, res) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return req.cookies[name]
        },
        set(name, value, options) {
          res.setHeader('Set-Cookie', serialize(name, value, options))
        },
        remove(name, options) {
          res.setHeader('Set-Cookie', serialize(name, '', { ...options, maxAge: 0 }))
        },
      },
    }
  )
}

// Helper function to serialize cookies
function serialize(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.domain) parts.push(`Domain=${options.domain}`)
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.secure) parts.push('Secure')
  if (options.httpOnly) parts.push('HttpOnly')

  return parts.join('; ')
}

// Helper to get authenticated user from API route
export async function getUser(req, res) {
  const supabase = createClient(req, res)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}
