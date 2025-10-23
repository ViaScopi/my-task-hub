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

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({
      error: "GitHub OAuth is not configured. Please set GITHUB_OAUTH_CLIENT_ID.",
    });
  }

  // Build GitHub OAuth authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/github/callback`,
    scope: "repo,user:email", // Permissions we need
    state: user.id, // Include user ID to verify on callback
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  return res.redirect(authUrl);
}
