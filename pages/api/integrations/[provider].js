import { createClient } from "../../../lib/supabase/api";

export default async function handler(req, res) {
  const supabase = createClient(req, res);
  const { provider } = req.query;

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Validate provider
  const validProviders = ["github", "google", "trello", "fellow"];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ error: "Invalid provider" });
  }

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" - that's ok
        throw error;
      }

      return res.status(200).json(data || null);
    } catch (error) {
      console.error("Error fetching integration:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { error } = await supabase
        .from("user_integrations")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", provider);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting integration:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  res.setHeader("Allow", ["GET", "DELETE"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
