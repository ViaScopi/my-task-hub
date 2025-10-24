import { createClient } from "../../lib/supabase/server";

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

  // Handle GET request - fetch all priorities for the user
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("task_priorities")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching task priorities:", error);
      return res.status(500).json({ error: "Failed to fetch priorities" });
    }

    // Convert to a map for easy lookup: "source:originalId" -> priority
    const priorityMap = {};
    (data || []).forEach((item) => {
      const key = `${item.source}:${item.original_id}`;
      priorityMap[key] = item.priority;
    });

    return res.status(200).json(priorityMap);
  }

  // Handle POST request - update priority
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { source, originalId, priority } = req.body;

  // Validate input
  if (!source || !originalId) {
    return res.status(400).json({ error: "Missing required fields: source, originalId" });
  }

  if (!priority) {
    // If no priority is provided, delete the existing priority
    const { error: deleteError } = await supabase
      .from("task_priorities")
      .delete()
      .eq("user_id", user.id)
      .eq("source", source)
      .eq("original_id", originalId);

    if (deleteError) {
      console.error("Error deleting task priority:", deleteError);
      return res.status(500).json({ error: "Failed to remove priority" });
    }

    return res.status(200).json({ success: true, priority: null });
  }

  if (!["high", "medium", "low"].includes(priority)) {
    return res.status(400).json({ error: "Invalid priority. Must be high, medium, or low." });
  }

  // Upsert priority
  const { data, error } = await supabase
    .from("task_priorities")
    .upsert(
      {
        user_id: user.id,
        source,
        original_id: originalId,
        priority,
      },
      {
        onConflict: "user_id,source,original_id",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error updating task priority:", error);
    return res.status(500).json({ error: "Failed to update priority" });
  }

  return res.status(200).json({ success: true, priority: data.priority });
}
