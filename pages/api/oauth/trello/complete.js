import { createClient } from "../../../../lib/supabase/api";

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, state } = req.body;

  console.log('[Trello Complete] Starting completion handler');
  console.log('[Trello Complete] Token present:', !!token);
  console.log('[Trello Complete] State:', state);

  const supabase = createClient(req, res);

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log('[Trello Complete] Auth check - User ID:', user?.id);
  console.log('[Trello Complete] Auth error:', authError);

  if (authError || !user) {
    console.error('[Trello Complete] No authenticated user');
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Verify state matches user ID
  if (state !== user.id) {
    console.error('[Trello Complete] State mismatch - expected:', user.id, 'got:', state);
    return res.status(403).json({ error: 'Invalid state parameter' });
  }

  if (!token) {
    console.error('[Trello Complete] No token provided');
    return res.status(400).json({ error: 'No token provided' });
  }

  try {
    const apiKey = process.env.TRELLO_API_KEY;

    if (!apiKey) {
      throw new Error("Trello API key not configured");
    }

    // Get Trello user info
    console.log('[Trello Complete] Fetching Trello user info');
    const userResponse = await fetch(
      `https://api.trello.com/1/members/me?key=${apiKey}&token=${token}`
    );

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('[Trello Complete] Trello API error:', userResponse.status, errorText);
      throw new Error("Failed to fetch Trello user info");
    }

    const trelloUser = await userResponse.json();
    console.log('[Trello Complete] Trello user:', {
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

    console.log('[Trello Complete] Attempting to insert/update integration for user:', user.id);

    // Store integration in database
    const { data: insertedData, error: dbError } = await supabase
      .from("user_integrations")
      .upsert(integrationData, {
        onConflict: "user_id,provider",
      })
      .select();

    console.log('[Trello Complete] Database operation result:', {
      error: dbError,
      data: insertedData,
      hasData: !!insertedData,
      dataLength: insertedData?.length
    });

    if (dbError) {
      console.error('[Trello Complete] Database error details:', JSON.stringify(dbError, null, 2));
      throw dbError;
    }

    console.log('[Trello Complete] Successfully stored integration');
    return res.status(200).json({
      success: true,
      message: 'Trello integration connected successfully',
      data: insertedData
    });
  } catch (error) {
    console.error('[Trello Complete] Error:', error);
    console.error('[Trello Complete] Error stack:', error.stack);
    return res.status(500).json({ error: error.message });
  }
}
