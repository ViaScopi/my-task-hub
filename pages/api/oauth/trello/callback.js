import { createClient } from "../../../../lib/supabase/api";

export default async function handler(req, res) {
  const { token, state } = req.query;

  console.log('[Trello Callback] Starting callback handler');
  console.log('[Trello Callback] Token present:', !!token);
  console.log('[Trello Callback] State:', state);

  const supabase = createClient(req, res);

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log('[Trello Callback] Auth check - User ID:', user?.id);
  console.log('[Trello Callback] Auth error:', authError);

  if (authError || !user) {
    console.error('[Trello Callback] No authenticated user, redirecting to login');
    return res.redirect("/login");
  }

  // Verify state matches user ID
  if (state !== user.id) {
    console.error('[Trello Callback] State mismatch - expected:', user.id, 'got:', state);
    return res.redirect("/settings?error=invalid_state");
  }

  if (!token) {
    console.error('[Trello Callback] No token provided');
    return res.redirect("/settings?error=no_token");
  }

  try {
    const apiKey = process.env.TRELLO_API_KEY;

    if (!apiKey) {
      throw new Error("Trello API key not configured");
    }

    // Get Trello user info
    console.log('[Trello Callback] Fetching Trello user info');
    const userResponse = await fetch(
      `https://api.trello.com/1/members/me?key=${apiKey}&token=${token}`
    );

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('[Trello Callback] Trello API error:', userResponse.status, errorText);
      throw new Error("Failed to fetch Trello user info");
    }

    const trelloUser = await userResponse.json();
    console.log('[Trello Callback] Trello user:', {
      id: trelloUser.id,
      username: trelloUser.username,
      email: trelloUser.email
    });

    // Prepare the data to insert
    const integrationData = {
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
    };

    console.log('[Trello Callback] Attempting to insert/update integration for user:', user.id);

    // Store integration in database
    const { data: insertedData, error: dbError } = await supabase
      .from("user_integrations")
      .upsert(integrationData, {
        onConflict: "user_id,provider",
      })
      .select();

    console.log('[Trello Callback] Database operation result:', {
      error: dbError,
      data: insertedData,
      hasData: !!insertedData,
      dataLength: insertedData?.length
    });

    if (dbError) {
      console.error('[Trello Callback] Database error details:', JSON.stringify(dbError, null, 2));
      throw dbError;
    }

    console.log('[Trello Callback] Successfully stored integration');
    return res.redirect("/settings?success=trello_connected");
  } catch (error) {
    console.error('[Trello Callback] Error:', error);
    console.error('[Trello Callback] Error stack:', error.stack);
    return res.redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }
}
