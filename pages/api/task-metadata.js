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
      const { data: metadata, error } = await supabase
        .from("task_metadata")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      // Convert to a map for easy lookup: "source:original_id" -> metadata
      const metadataMap = {};
      (metadata || []).forEach((item) => {
        const key = `${item.source}:${item.original_id}`;
        metadataMap[key] = {
          timeEstimate: item.time_estimate,
          isToday: item.is_today,
        };
      });

      return res.status(200).json(metadataMap);
    } catch (error) {
      console.error("Failed to load task metadata:", error);
      return res.status(500).json({
        error: "Failed to load task metadata",
        details: error.message
      });
    }
  }

  if (req.method === "POST" || req.method === "PUT") {
    try {
      const { source, originalId, timeEstimate, isToday } = req.body;

      if (!source || !originalId) {
        return res.status(400).json({
          error: "source and originalId are required"
        });
      }

      const payload = {
        user_id: user.id,
        source: String(source),
        original_id: String(originalId),
      };

      // Only include fields that are provided
      if (timeEstimate !== undefined) {
        payload.time_estimate = timeEstimate === null ? null : parseInt(timeEstimate, 10);
      }

      if (isToday !== undefined) {
        payload.is_today = Boolean(isToday);
      }

      console.log("Updating task metadata:", { source, originalId, timeEstimate, isToday, userId: user.id });

      const { data: saved, error } = await supabase
        .from("task_metadata")
        .upsert(payload, {
          onConflict: "user_id,source,original_id",
        })
        .select()
        .single();

      if (error) {
        console.error("Database error updating task metadata:", error);
        throw error;
      }

      return res.status(200).json({
        success: true,
        metadata: {
          timeEstimate: saved.time_estimate,
          isToday: saved.is_today,
        },
      });
    } catch (error) {
      console.error("Failed to update task metadata:", error);
      return res.status(500).json({
        error: "Failed to update task metadata",
        details: error.message,
        code: error.code,
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
