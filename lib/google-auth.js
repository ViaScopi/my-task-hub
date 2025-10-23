// Google OAuth token management helpers

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export async function getUserGoogleTokens(supabase, userId) {
  const { data, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single();

  if (error || !data) {
    throw new Error("Google not connected. Please connect your Google account in Settings.");
  }

  return data;
}

export async function getValidAccessToken(supabase, userId) {
  const integration = await getUserGoogleTokens(supabase, userId);

  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at)
    : null;
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  const needsRefresh = !expiresAt || expiresAt < fiveMinutesFromNow;

  if (!needsRefresh) {
    return integration.access_token;
  }

  // Token expired or about to expire - refresh it
  if (!integration.refresh_token) {
    throw new Error(
      "Google refresh token not available. Please reconnect your Google account."
    );
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  // Refresh the access token
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integration.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message =
      data?.error_description || data?.error || "Failed to refresh Google access token.";
    throw new Error(message);
  }

  const data = await response.json();
  const newAccessToken = data.access_token;

  if (!newAccessToken) {
    throw new Error("Google access token response did not include an access_token.");
  }

  // Calculate new expiry
  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  // Update the token in the database
  await supabase
    .from("user_integrations")
    .update({
      access_token: newAccessToken,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google");

  return newAccessToken;
}
