// Middleware utilities for protecting routes
import { createClient } from './api'

// Middleware to require authentication on API routes
export async function requireAuth(req, res, handler) {
  const supabase = createClient(req, res)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Add user to request object for use in handler
  req.user = user

  return handler(req, res)
}
