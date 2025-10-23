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

  const apiKey = process.env.TRELLO_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Trello OAuth is not configured. Please set TRELLO_API_KEY.",
    });
  }

  // Build Trello OAuth authorization URL
  // Note: Trello appends the token as a URL fragment (#token=...)
  // So we use a client-side page to capture it
  const params = new URLSearchParams({
    key: apiKey,
    name: "My Task Hub",
    scope: "read,write",
    expiration: "never",
    response_type: "token",
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/oauth/trello/callback?state=${user.id}`,
  });

  const authUrl = `https://trello.com/1/authorize?${params.toString()}`;

  return res.redirect(authUrl);
}
