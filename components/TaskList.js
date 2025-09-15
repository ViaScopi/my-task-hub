import { useEffect, useState } from "react";

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [completionNote, setCompletionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch("/api/github");
        const data = await response.json();
        setTasks(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const startCompletion = (taskId) => {
    setActiveTaskId(taskId);
    setCompletionNote("");
    setError("");
  };

  const cancelCompletion = () => {
    if (submitting) return;

    setActiveTaskId(null);
    setCompletionNote("");
    setError("");
  };

  const completeTask = async (task, note) => {
    const trimmedNote = note.trim();

    if (!trimmedNote) {
      setError("Please add a note about what was completed.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

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

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.error || "Failed to complete the task.";
        throw new Error(message);
      }

      setTasks((prevTasks) => prevTasks.filter((item) => item.id !== task.id));
      setActiveTaskId(null);
      setCompletionNote("");
    } catch (err) {
      console.error("Error completing task:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="task-card">
        <div className="task-state">
          <span className="task-state__spinner" aria-hidden="true" />
          <p className="task-state__message">Loading your assigned issues…</p>
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
          <p className="task-state__message">No GitHub tasks assigned right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="task-card">
      <header className="task-card__header">
        <div>
          <span className="task-card__eyebrow">Assigned to you</span>
          <h2 className="task-card__title">Stay on top of your GitHub issues</h2>
        </div>
        <p className="task-card__description">
          Review each task, jot down a quick note about your progress, then mark it done without
          ever leaving the hub.
        </p>
      </header>

      <ul className="task-card__items">
        {tasks.map((task) => {
          const isActive = activeTaskId === task.id;
          const description = task.description?.trim();

          return (
            <li key={task.id} className={`task-item${isActive ? " task-item--active" : ""}`}>
              <div className="task-item__meta">
                <div className="task-item__heading">
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noreferrer"
                    className="task-item__title"
                  >
                    {task.title}
                  </a>
                  <p className="task-item__repo">{task.repo}</p>
                </div>
                {!isActive && (
                  <button
                    type="button"
                    onClick={() => startCompletion(task.id)}
                    className="button button--success"
                  >
                    Mark done
                  </button>
                )}
              </div>

              {description ? (
                <p className="task-item__description">{description}</p>
              ) : (
                <p className="task-item__description task-item__description--muted">
                  No description provided.
                </p>
              )}

              {isActive && (
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
                  {error && <p className="task-item__error">{error}</p>}
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
