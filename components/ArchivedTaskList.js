import { useEffect, useState } from "react";

const SOURCE_BADGE_CLASS = {
  GitHub: "github",
  "Google Tasks": "google",
  Trello: "trello",
  Fellow: "trello",
};

export default function ArchivedTaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadArchivedTasks();
  }, []);

  const loadArchivedTasks = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/archived-tasks");
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load archived tasks");
      }

      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading archived tasks:", err);
      setError(err.message || "Failed to load archived tasks");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="task-card">
        <div className="task-state">
          <div className="task-state__spinner"></div>
          <h2 className="task-state__title">Loading archived tasks...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="task-card">
        <p className="task-card__notice task-card__notice--warning">{error}</p>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="task-card">
        <div className="task-state">
          <span className="task-state__icon" role="img" aria-label="folder">
            📁
          </span>
          <h2 className="task-state__title">No archived tasks yet</h2>
          <p className="task-state__message">
            Tasks you archive from your dashboard or Kanban board will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="task-card">
      <header className="task-card__header">
        <div>
          <span className="task-card__eyebrow">Archive</span>
          <h2 className="task-card__title">Your archived tasks</h2>
        </div>
        <p className="task-card__description">
          Review tasks you've completed and archived. Total: {tasks.length}
        </p>
      </header>

      <ul className="task-card__items">
        {tasks.map((task) => {
          const badgeClass = SOURCE_BADGE_CLASS[task.source] || "default";
          const archivedDate = task.archived_at
            ? new Date(task.archived_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "";

          return (
            <li key={task.id} className="task-item task-item--archived">
              <div className="task-item__meta">
                <div className="task-item__heading">
                  <div className="task-item__title-row">
                    {task.url ? (
                      <a
                        href={task.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="task-item__title"
                      >
                        {task.title}
                      </a>
                    ) : (
                      <span className="task-item__title">{task.title}</span>
                    )}
                    <span className={`task-item__badge task-item__badge--${badgeClass}`}>
                      {task.source}
                    </span>
                  </div>
                  {task.repo && (
                    <p className="task-item__repo">
                      {task.source === "GitHub" ? task.repo : `${task.repo}`}
                    </p>
                  )}
                </div>
              </div>

              {task.description && (
                <p className="task-item__description">{task.description}</p>
              )}

              {(task.notes || archivedDate) && (
                <div className="task-item__archive-meta">
                  {archivedDate && (
                    <p className="task-item__archive-date">
                      Archived on {archivedDate}
                    </p>
                  )}
                  {task.notes && (
                    <div className="task-item__archive-notes">
                      <strong>Notes:</strong> {task.notes}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
