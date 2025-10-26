import { createClient } from "../../lib/supabase/api";
import { deriveOriginalId } from "../../lib/taskIdentity.js";

async function persistArchivedTask(supabase, userId, task, note) {
  const originalId = deriveOriginalId(task);

  if (!originalId) {
    throw new Error("Unable to determine a stable identifier for this task.");
  }

  const timestamp = new Date().toISOString();
  const payload = {
    user_id: userId,
    source: task.source || "Other",
    original_id: originalId,
    title: task.title || task.name || "Untitled task",
    description: task.description || "",
    status: task.status || "archived",
    completed_at: task.completedAt || task.completed_at || timestamp,
    archived_at: timestamp,
    notes: note || "",
    url: task.url || null,
    repo: task.repo || null,
    pipeline_id: task.pipelineId || null,
    pipeline_name: task.pipelineName || null,
    metadata: {},
  };

  if (task.issue_number) {
    payload.metadata.issue_number = task.issue_number;
  }

  if (task.googleTaskId) {
    payload.metadata.googleTaskId = task.googleTaskId;
  }

  if (task.googleTaskListId) {
    payload.metadata.googleTaskListId = task.googleTaskListId;
  }

  if (task.trelloCardId) {
    payload.metadata.trelloCardId = task.trelloCardId;
  }

  if (task.trelloListId) {
    payload.metadata.trelloListId = task.trelloListId;
  }

  if (task.fellowActionId) {
    payload.metadata.fellowActionId = task.fellowActionId;
  }

  const { data, error } = await supabase
    .from("archived_tasks")
    .upsert(payload, {
      onConflict: "user_id,source,original_id",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createClient(req, res);

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { task, note } = req.body;

    if (!task || typeof task !== "object") {
      return res.status(400).json({ error: "Task object is required" });
    }

    if (!task.source) {
      return res.status(400).json({ error: "Task must have a source" });
    }

    // Persist to archived_tasks table
    const archivedTask = await persistArchivedTask(supabase, user.id, task, note);

    return res.status(200).json({
      success: true,
      archivedTask,
    });
  } catch (error) {
    console.error("Error archiving task:", error);
    return res.status(500).json({
      error: "Failed to archive task",
      details: error.message,
    });
  }
}
