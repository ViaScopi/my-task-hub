import { createClient } from "../../lib/supabase/api";

export default async function handler(req, res) {
  const supabase = createClient(req, res);

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = row not found (which is fine for new users)
      console.error("Error fetching user preferences:", error);
      return res.status(500).json({ error: "Failed to fetch preferences" });
    }

    return res.status(200).json(data || { preferences: {} });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
