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
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("GitHub OAuth credentials not configured");
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const accessToken = tokenData.access_token;

    // Get GitHub user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const githubUser = await userResponse.json();

    // Get user's email if not public
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      const emails = await emailsResponse.json();
      const primaryEmail = emails.find((e) => e.primary);
      email = primaryEmail?.email || emails[0]?.email;
    }

    // Store integration in database
    const { error: dbError } = await supabase.from("user_integrations").upsert(
      {
        user_id: user.id,
        provider: "github",
        access_token: accessToken,
        provider_user_id: githubUser.id.toString(),
        provider_user_email: email,
        scopes: tokenData.scope?.split(",") || [],
        metadata: {
          login: githubUser.login,
          name: githubUser.name,
          avatar_url: githubUser.avatar_url,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider",
      }
    );

    if (dbError) throw dbError;

    return res.redirect("/settings?success=github_connected");
  } catch (error) {
    console.error("GitHub OAuth error:", error);
    return res.redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }
}
