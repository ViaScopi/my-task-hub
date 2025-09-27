import { useCallback, useEffect, useState } from "react";

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
        ];

        const [githubResult, googleResult, trelloResult] = await Promise.allSettled(requests);

        if (signal?.aborted) {
          return;
        }

        const combinedTasks = [];
        const errors = [];

        if (githubResult.status === "fulfilled") {
          const githubTasks = githubResult.value.map((task) => ({
            ...task,
            id: task.id ?? `github-${task.issue_number}`,
          }));
          combinedTasks.push(...githubTasks);
        } else {
          errors.push("GitHub tasks");
          console.error("Failed to load GitHub tasks:", githubResult.reason);
        }

        if (googleResult.status === "fulfilled") {
          combinedTasks.push(...googleResult.value);
        } else {
          const isConfigError = googleResult.reason?.status === 503;
          errors.push(isConfigError ? "Google Tasks (integration not configured)" : "Google Tasks");
          console.error("Failed to load Google Tasks:", googleResult.reason);
        }

        if (trelloResult.status === "fulfilled") {
          combinedTasks.push(...trelloResult.value);
        } else {
          const isConfigError = trelloResult.reason?.status === 503;
          errors.push(isConfigError ? "Trello (integration not configured)" : "Trello");
          console.error("Failed to load Trello cards:", trelloResult.reason);
        }

        setTasks(combinedTasks);

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
