import { createClient } from "../../../lib/supabase/api";

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
    try {
      const { data, error } = await supabase
        .from("user_integrations")
        .select("id, provider, provider_user_id, provider_user_email, connected_at, updated_at")
        .eq("user_id", user.id);

      if (error) throw error;

      return res.status(200).json(data || []);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  res.setHeader("Allow", ["GET"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
