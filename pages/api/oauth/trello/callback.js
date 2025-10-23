import { createClient } from "../../../../lib/supabase/api";

export default async function handler(req, res) {
  const { token, state } = req.query;
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

  if (!token) {
    return res.redirect("/settings?error=no_token");
  }

  try {
    const apiKey = process.env.TRELLO_API_KEY;

    if (!apiKey) {
      throw new Error("Trello API key not configured");
    }

    // Get Trello user info
    const userResponse = await fetch(
      `https://api.trello.com/1/members/me?key=${apiKey}&token=${token}`
    );

    if (!userResponse.ok) {
      throw new Error("Failed to fetch Trello user info");
    }

    const trelloUser = await userResponse.json();

    // Store integration in database
    const { error: dbError } = await supabase.from("user_integrations").upsert(
      {
        user_id: user.id,
        provider: "trello",
        access_token: token,
        provider_user_id: trelloUser.id,
        provider_user_email: trelloUser.email,
        metadata: {
          username: trelloUser.username,
          fullName: trelloUser.fullName,
          avatar_url: trelloUser.avatarUrl,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider",
      }
    );

    if (dbError) throw dbError;

    return res.redirect("/settings?success=trello_connected");
  } catch (error) {
    console.error("Trello OAuth error:", error);
    return res.redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }
}
