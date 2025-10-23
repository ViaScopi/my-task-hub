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
    try {
      const { data: tasks, error } = await supabase
        .from("completed_tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false });

      if (error) {
        throw error;
      }

      return res.status(200).json(tasks || []);
    } catch (error) {
      console.error("Failed to load completed tasks:", error);
      return res.status(500).json({ error: "Failed to load completed tasks." });
    }
  }

  if (req.method === "POST") {
    try {
      const snapshot = req.body;
      if (!snapshot || typeof snapshot !== "object") {
        return res.status(400).json({ error: "A completed task payload is required." });
      }

      const { source, original_id } = snapshot;
      if (!source || !original_id) {
        return res.status(400).json({ 
          error: "Completed task must include both source and original_id." 
        });
      }

      // Prepare the data for insertion
      const taskData = {
        user_id: user.id,
        source: String(source),
        original_id: String(original_id),
        title: snapshot.title || "Untitled task",
        description: snapshot.description || null,
        status: snapshot.status || "completed",
        completed_at: snapshot.completed_at || snapshot.completedAt || new Date().toISOString(),
        notes: snapshot.notes || null,
        url: snapshot.url || null,
        repo: snapshot.repo || null,
        pipeline_id: snapshot.pipeline_id || snapshot.pipelineId || null,
        pipeline_name: snapshot.pipeline_name || snapshot.pipelineName || null,
        metadata: snapshot.metadata || {},
      };

      // Upsert the completed task (insert or update if exists)
      const { data: saved, error } = await supabase
        .from("completed_tasks")
        .upsert(taskData, {
          onConflict: "user_id,source,original_id",
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json(saved);
    } catch (error) {
      const status = error?.message?.includes("source") || error?.message?.includes("original_id") ? 400 : 500;
      console.error("Failed to save completed task:", error);
      return res
        .status(status)
        .json({ error: error?.message || "Failed to save the completed task snapshot." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
