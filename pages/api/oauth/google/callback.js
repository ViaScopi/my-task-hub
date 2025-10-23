import { createClient } from "../../../../lib/supabase/api";

export default async function handler(req, res) {
  const { code, state } = req.query;
  const supabase = createClient(req, res);

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.redirect("/login");
  }

  // Verify state matches user ID
  if (state !== user.id) {
    return res.redirect("/settings?error=invalid_state");
  }

  if (!code) {
    return res.redirect("/settings?error=no_code");
  }

  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Get Google user info
    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const googleUser = await userResponse.json();

    // Calculate token expiry
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Store integration in database
    const { error: dbError } = await supabase.from("user_integrations").upsert(
      {
        user_id: user.id,
        provider: "google",
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
        provider_user_id: googleUser.id,
        provider_user_email: googleUser.email,
        scopes: tokenData.scope?.split(" ") || [],
        metadata: {
          name: googleUser.name,
          picture: googleUser.picture,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider",
      }
    );

    if (dbError) throw dbError;

    return res.redirect("/settings?success=google_connected");
  } catch (error) {
    console.error("Google OAuth error:", error);
    return res.redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }
}
