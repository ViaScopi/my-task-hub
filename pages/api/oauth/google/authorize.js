import { createClient } from "../../../../lib/supabase/api";

export default async function handler(req, res) {
  const supabase = createClient(req, res);

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.redirect("/login");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({
      error: "Google OAuth is not configured. Please set GOOGLE_OAUTH_CLIENT_ID.",
    });
  }

  // Build Google OAuth authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/google/callback`,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/tasks",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" "),
    access_type: "offline", // Get refresh token
    prompt: "consent", // Force consent to get refresh token
    state: user.id, // Include user ID to verify on callback
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return res.redirect(authUrl);
}
