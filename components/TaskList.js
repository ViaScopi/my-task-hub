import { useCallback, useEffect, useState } from "react";

const SOURCE_BADGE_CLASS = {
  GitHub: "github",
  "Google Tasks": "google",
  Trello: "trello",
};

function formatDueDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });

  return formatter.format(date);
}

function formatStatus(value) {
  if (!value) {
    return "";
  }

  return value
    .toString()
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [completionNote, setCompletionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState({});

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

  const startCompletion = (task) => {
    if (!task || task.source !== "GitHub") {
      return;
    }

    setActiveTaskId(task.id);
    setCompletionNote("");
    setCompletionError("");
  };

  const cancelCompletion = () => {
    if (submitting) {
      return;
    }

    setActiveTaskId(null);
    setCompletionNote("");
    setCompletionError("");
  };

  const completeTask = async (task, note) => {
    if (!task || task.source !== "GitHub") {
      return;
    }

    const trimmedNote = note.trim();

    if (!trimmedNote) {
      setCompletionError("Please add a note about what was completed.");
      return;
    }

    try {
      setSubmitting(true);
      setCompletionError("");

      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: task.repo.split("/")[0],
          repo: task.repo.split("/")[1],
          issue_number: task.issue_number,
          comment: trimmedNote,
        }),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const message = responseData?.error || "Failed to complete the task.";
        throw new Error(message);
      }

      setTasks((prevTasks) => prevTasks.filter((item) => item.id !== task.id));
      setActiveTaskId(null);
      setCompletionNote("");
    } catch (err) {
      console.error("Error completing task:", err);
      setCompletionError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const updatePipeline = async (task, targetListId) => {
    if (!task || task.source !== "Google Tasks") {
      return;
    }

    if (!targetListId || targetListId === task.pipelineId) {
      return;
    }

    setPipelineStatus((prev) => ({
      ...prev,
      [task.id]: { loading: true, error: "" },
    }));

    try {
      const response = await fetch("/api/google-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.googleTaskId,
          currentListId: task.googleTaskListId,
          targetListId,
        }),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const message = responseData?.error || "Failed to update the Google Task pipeline.";
        throw new Error(message);
      }

      const newGoogleTaskId = responseData?.task?.id || task.googleTaskId;
      const newTaskListId = responseData?.task?.tasklist || targetListId;
      const nextPipeline = task.pipelineOptions?.find((option) => option.id === newTaskListId);
      const pipelineName = nextPipeline?.name || task.pipelineName;

      setTasks((prevTasks) =>
        prevTasks.map((item) => {
          if (item.id !== task.id) {
            return item;
          }

          const nextId = `google-${newGoogleTaskId}`;

          return {
            ...item,
            id: nextId,
            googleTaskId: newGoogleTaskId,
            googleTaskListId: newTaskListId,
            pipelineId: newTaskListId,
            pipelineName,
            repo: pipelineName,
          };
        })
      );

      setPipelineStatus((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    } catch (err) {
      console.error("Failed to update Google Task pipeline:", err);
      setPipelineStatus((prev) => ({
        ...prev,
        [task.id]: { loading: false, error: err.message || "Unable to update pipeline." },
      }));
    }
  };

  if (loading) {
    return (
      <div className="task-card">
        <div className="task-state">
          <span className="task-state__spinner" aria-hidden="true" />
          <p className="task-state__message">Loading your assigned tasks…</p>
        </div>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="task-card">
        <div className="task-state">
          <span className="task-state__icon" role="img" aria-label="party popper">
            🎉
          </span>
          <h2 className="task-state__title">You're all caught up!</h2>
          <p className="task-state__message">No tasks need your attention right now.</p>
          {fetchError && <p className="task-state__message task-state__message--muted">{fetchError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="task-card">
      <header className="task-card__header">
        <div>
          <span className="task-card__eyebrow">Assigned to you</span>
          <h2 className="task-card__title">Stay on top of your workstreams</h2>
        </div>
        <p className="task-card__description">
          Review GitHub issues, keep your Google Tasks organized, and stay accountable for your
          Trello cards without leaving your cockpit.
        </p>
      </header>

      {fetchError && <p className="task-card__notice task-card__notice--warning">{fetchError}</p>}

      <ul className="task-card__items">
        {tasks.map((task) => {
          const isActive = activeTaskId === task.id;
          const description = task.description?.trim();
          const badgeClass = SOURCE_BADGE_CLASS[task.source] || "default";
          const pipelineState = pipelineStatus[task.id] || {};
          const dueLabel = formatDueDate(task.dueDate || task.due);
          const statusLabel = formatStatus(task.status);

          return (
            <li key={task.id} className={`task-item${isActive ? " task-item--active" : ""}`}>
              <div className="task-item__meta">
                <div className="task-item__heading">
                  <div className="task-item__title-row">
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noreferrer"
                      className="task-item__title"
                    >
                      {task.title}
                    </a>
                    {task.source && (
                      <span className={`task-item__badge task-item__badge--${badgeClass}`}>
                        {task.source}
                      </span>
                    )}
                  </div>
                  <p className="task-item__repo">
                    {task.source === "GitHub"
                      ? task.repo
                      : task.source === "Google Tasks"
                      ? `Pipeline: ${task.pipelineName}`
                      : task.source === "Trello" && task.pipelineName
                      ? `List: ${task.pipelineName} · ${task.repo}`
                      : task.repo}
                  </p>
                  {task.source === "Trello" && (dueLabel || statusLabel) && (
                    <p className="task-item__meta-detail">
                      {dueLabel && <span>Due {dueLabel}</span>}
                      {dueLabel && statusLabel && <span aria-hidden="true"> · </span>}
                      {statusLabel && <span>{statusLabel}</span>}
                    </p>
                  )}
                </div>
                {task.source === "GitHub" && !isActive && (
                  <button
                    type="button"
                    onClick={() => startCompletion(task)}
                    className="button button--success"
                  >
                    Mark done
                  </button>
                )}
              </div>

              {task.source === "Google Tasks" && task.pipelineOptions?.length > 0 && (
                <div className="task-item__pipeline">
                  <label htmlFor={`pipeline-${task.id}`}>Pipeline</label>
                  <select
                    id={`pipeline-${task.id}`}
                    className="task-item__pipeline-select"
                    value={task.pipelineId}
                    onChange={(event) => updatePipeline(task, event.target.value)}
                    disabled={Boolean(pipelineState.loading)}
                  >
                    {task.pipelineOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  {pipelineState.error && <p className="task-item__error">{pipelineState.error}</p>}
                </div>
              )}

              {description ? (
                <p className="task-item__description">{description}</p>
              ) : (
                <p className="task-item__description task-item__description--muted">
                  No description provided.
                </p>
              )}

              {isActive && task.source === "GitHub" && (
                <div className="task-item__completion">
                  <label htmlFor={`completion-note-${task.id}`}>
                    Add a note about what was completed
                  </label>
                  <textarea
                    id={`completion-note-${task.id}`}
                    className="task-item__note"
                    rows={4}
                    value={completionNote}
                    onChange={(event) => setCompletionNote(event.target.value)}
                    placeholder="Share what you accomplished before closing the issue…"
                    disabled={submitting}
                  />
                  {completionError && <p className="task-item__error">{completionError}</p>}
                  <div className="task-item__actions">
                    <button
                      type="button"
                      onClick={() => completeTask(task, completionNote)}
                      className="button button--primary"
                      disabled={submitting}
                    >
                      {submitting ? "Saving..." : "Submit & Close"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelCompletion}
                      className="button button--ghost"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
