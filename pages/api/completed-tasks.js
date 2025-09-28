import { getAllCompletedTasks, upsertCompletedTask } from "../../lib/completedTasksStore.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const tasks = await getAllCompletedTasks();
      return res.status(200).json(tasks);
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

      const saved = await upsertCompletedTask(snapshot);
      return res.status(200).json(saved);
    } catch (error) {
      const status = error?.message?.includes("source") || error?.message?.includes("snapshot") ? 400 : 500;
      console.error("Failed to save completed task:", error);
      return res
        .status(status)
        .json({ error: error?.message || "Failed to save the completed task snapshot." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
