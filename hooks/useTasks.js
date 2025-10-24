import { useCallback, useEffect, useState } from "react";
import { buildTaskKey, deriveOriginalId } from "../lib/taskIdentity.js";

function ensureOriginalId(task) {
  const originalId = deriveOriginalId(task);
  return {
    ...task,
    originalId,
  };
}

function normalizeCompletedSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const source = snapshot.source || "Other";
  const originalId = snapshot.originalId ?? deriveOriginalId(snapshot);

  const base = {
    id: snapshot.id || snapshot.taskId,
    source,
    originalId,
    title: snapshot.title || snapshot.name || "Untitled task",
    name: snapshot.name || snapshot.title || "Untitled task",
    repo: snapshot.repo || null,
    pipelineId: snapshot.pipelineId || null,
    pipelineName: snapshot.pipelineName || snapshot.repo || null,
    description: snapshot.description || "",
    url: snapshot.url || null,
    notes: snapshot.notes || "",
    completedAt: snapshot.completedAt || snapshot.updatedAt || null,
    status: snapshot.status || "Completed locally",
    locallyCompleted: true,
  };

  if (snapshot.issue_number) {
    base.issue_number = snapshot.issue_number;
  }

  if (snapshot.googleTaskId) {
    base.googleTaskId = snapshot.googleTaskId;
  }

  if (snapshot.googleTaskListId) {
    base.googleTaskListId = snapshot.googleTaskListId;
    base.pipelineId = base.pipelineId || snapshot.googleTaskListId;
  }

  if (snapshot.trelloCardId) {
    base.trelloCardId = snapshot.trelloCardId;
  }

  if (snapshot.trelloListId) {
    base.trelloListId = snapshot.trelloListId;
    base.pipelineId = base.pipelineId || snapshot.trelloListId;
  }

  if (snapshot.fellowActionId) {
    base.fellowActionId = snapshot.fellowActionId;
  }

  return ensureOriginalId(base);
}

export function mergeTasksWithCompletions(integrationTasks = [], completedSnapshots = []) {
  const map = new Map();
  const ordered = [];

  const upsertTask = (task, { markCompleted = false } = {}) => {
    if (!task || typeof task !== "object") {
      return;
    }

    const normalizedTask = ensureOriginalId(task);
    const key = buildTaskKey(normalizedTask.source, normalizedTask.originalId);

    if (!key) {
      return;
    }

    const existing = map.get(key);
    const completedStatus = markCompleted
      ? normalizedTask.status || "Completed locally"
      : normalizedTask.status;

    if (existing) {
      const mergedTask = {
        ...existing.task,
        ...normalizedTask,
      };

      if (markCompleted) {
        mergedTask.locallyCompleted = true;
        mergedTask.status = completedStatus || existing.task.status || "Completed locally";
        mergedTask.completedAt =
          normalizedTask.completedAt || existing.task.completedAt || new Date().toISOString();
        mergedTask.notes = normalizedTask.notes ?? existing.task.notes;
        mergedTask.id = existing.task.id || normalizedTask.id || mergedTask.id;
      }

      const preserveFields = ["url", "repo", "pipelineName", "pipelineId", "description", "title", "name"];
      for (const field of preserveFields) {
        if (mergedTask[field] == null && existing.task[field] != null) {
          mergedTask[field] = existing.task[field];
        }
      }

      ordered[existing.index] = mergedTask;
      map.set(key, { index: existing.index, task: mergedTask });
      return;
    }

    const entry = { ...normalizedTask };

    if (markCompleted) {
      entry.locallyCompleted = true;
      entry.status = completedStatus || "Completed locally";
      entry.completedAt = entry.completedAt || new Date().toISOString();
    }

    if (!entry.id) {
      entry.id = `completed-${key.replace(/[^a-zA-Z0-9]/g, "-")}`;
    }

    ordered.push(entry);
    map.set(key, { index: ordered.length - 1, task: entry });
  };

  integrationTasks.forEach((task) => upsertTask(task));
  completedSnapshots
    .map((snapshot) => normalizeCompletedSnapshot(snapshot))
    .filter(Boolean)
    .forEach((snapshotTask) => {
      upsertTask(snapshotTask, { markCompleted: true });
    });

  return ordered;
}

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const loadTasks = useCallback(
    async ({ silent = false, signal } = {}) => {
      if (!silent) {
        setLoading(true);
        setFetchError("");
      }

      try {
        const requests = [
          fetch("/api/github", { signal }).then(async (response) => {
            const data = await response.json().catch(() => null);

            if (!response.ok) {
              const error = new Error(data?.error || "Failed to load GitHub tasks.");
              error.status = response.status;
              throw error;
            }

            return Array.isArray(data) ? data : [];
          }),
          fetch("/api/google-tasks", { signal }).then(async (response) => {
            const data = await response.json().catch(() => null);

            if (!response.ok) {
              const error = new Error(data?.error || "Failed to load Google Tasks.");
              error.status = response.status;
              throw error;
            }

            return Array.isArray(data) ? data : [];
          }),
          fetch("/api/trello", { signal }).then(async (response) => {
            const data = await response.json().catch(() => null);

            if (!response.ok) {
              const error = new Error(data?.error || "Failed to load Trello cards.");
              error.status = response.status;
              throw error;
            }

            return Array.isArray(data) ? data : [];
          }),
          fetch("/api/completed-tasks", { signal }).then(async (response) => {
            const data = await response.json().catch(() => null);

            if (!response.ok) {
              const error = new Error(data?.error || "Failed to load completed task history.");
              error.status = response.status;
              throw error;
            }

            return Array.isArray(data) ? data : [];
          }),
          fetch("/api/task-priority", { signal }).then(async (response) => {
            const data = await response.json().catch(() => null);

            if (!response.ok) {
              return {}; // Priorities are optional, don't fail if unavailable
            }

            return data || {};
          }),
        ];

        const [githubResult, googleResult, trelloResult, completedResult, prioritiesResult] =
          await Promise.allSettled(requests);

        if (signal?.aborted) {
          return;
        }

        const integrationTasks = [];
        const completedSnapshots = [];
        const errors = [];

        if (githubResult.status === "fulfilled") {
          const githubTasks = githubResult.value.map((task) => ({
            ...task,
            id: task.id ?? `github-${task.issue_number}`,
          }));
          integrationTasks.push(...githubTasks);
        } else {
          errors.push("GitHub tasks");
          console.error("Failed to load GitHub tasks:", githubResult.reason);
        }

        if (googleResult.status === "fulfilled") {
          integrationTasks.push(...googleResult.value);
        } else {
          const isConfigError = googleResult.reason?.status === 503;
          errors.push(isConfigError ? "Google Tasks (integration not configured)" : "Google Tasks");
          console.error("Failed to load Google Tasks:", googleResult.reason);
        }

        if (trelloResult.status === "fulfilled") {
          integrationTasks.push(...trelloResult.value);
        } else {
          const isConfigError = trelloResult.reason?.status === 503;
          errors.push(isConfigError ? "Trello (integration not configured)" : "Trello");
          console.error("Failed to load Trello cards:", trelloResult.reason);
        }

        if (completedResult.status === "fulfilled") {
          completedSnapshots.push(...completedResult.value);
        } else {
          errors.push("Completed tasks history");
          console.error("Failed to load completed task history:", completedResult.reason);
        }

        // Get priorities map
        let priorities = {};
        if (prioritiesResult.status === "fulfilled") {
          priorities = prioritiesResult.value || {};
        }

        const mergedTasks = mergeTasksWithCompletions(integrationTasks, completedSnapshots);

        // Add priorities to tasks
        const tasksWithPriorities = mergedTasks.map((task) => {
          const priorityKey = `${task.source}:${task.originalId}`;
          const priority = priorities[priorityKey] || null;
          return { ...task, priority };
        });

        setTasks(tasksWithPriorities);

        if (errors.length === 1) {
          setFetchError(`Heads up: ${errors[0]} couldn't be loaded right now.`);
        } else if (errors.length >= 2) {
          setFetchError("We couldn't load your tasks right now. Please try again.");
        } else {
          setFetchError("");
        }
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        console.error("Error loading tasks:", error);
        setTasks([]);
        setFetchError("We couldn't load your tasks right now. Please try again.");
      } finally {
        if (!silent && !signal?.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    loadTasks({ signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [loadTasks]);

  return { tasks, setTasks, loading, fetchError, reload: loadTasks };
}
