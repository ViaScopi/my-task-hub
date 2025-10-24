import { useEffect, useState } from "react";
import { useTasks } from "../hooks/useTasks";

const SOURCE_BADGE_CLASS = {
  GitHub: "github",
  "Google Tasks": "google",
  Trello: "trello",
  Fellow: "trello",
};

const isTrelloTask = (task) => task?.source === "Trello" || task?.source === "Fellow";

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
  const { tasks, setTasks, loading, fetchError } = useTasks();
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [completionNote, setCompletionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState({});
  const [trelloCardStatus, setTrelloCardStatus] = useState({});
  const [trelloComments, setTrelloComments] = useState({});
  const [priorityStatus, setPriorityStatus] = useState({});

  useEffect(() => {
    setTrelloCardStatus((prev) => {
      const next = {};
      tasks.forEach((task) => {
        if (isTrelloTask(task) && prev[task.id]) {
          next[task.id] = prev[task.id];
        }
      });
      return next;
    });

    setTrelloComments((prev) => {
      const next = {};
      tasks.forEach((task) => {
        if (isTrelloTask(task)) {
          next[task.id] = prev[task.id] ?? "";
        }
      });
      return next;
    });
  }, [tasks]);

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

  const moveTrelloCard = async (task, targetListId) => {
    if (!task || !isTrelloTask(task)) {
      return;
    }

    if (!targetListId || targetListId === task.pipelineId) {
      return;
    }

    const selectedList = task.pipelineOptions?.find((option) => option.id === targetListId);

    setTrelloCardStatus((prev) => ({
      ...prev,
      [task.id]: {
        ...(prev[task.id] || {}),
        moveLoading: true,
        moveError: "",
        moveSuccess: "",
      },
    }));

    try {
      const response = await fetch("/api/trello", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          cardId: task.trelloCardId,
          targetListId,
        }),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const message = responseData?.error || "Failed to move the Trello card.";
        throw new Error(message);
      }

      setTasks((prevTasks) =>
        prevTasks.map((item) => {
          if (item.id !== task.id) {
            return item;
          }

          return {
            ...item,
            pipelineId: targetListId,
            pipelineName: selectedList?.name || item.pipelineName,
            trelloListId: targetListId,
          };
        })
      );

      setTrelloCardStatus((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || {}),
          moveLoading: false,
          moveError: "",
          moveSuccess: selectedList?.name
            ? `Moved to ${selectedList.name}.`
            : "Card moved successfully.",
        },
      }));
    } catch (err) {
      console.error("Failed to move Trello card:", err);
      setTrelloCardStatus((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || {}),
          moveLoading: false,
          moveError: err.message || "Unable to move the Trello card.",
          moveSuccess: "",
        },
      }));
    }
  };

  const submitTrelloComment = async (task) => {
    if (!task || task.source !== "Trello") {
      return;
    }

    const draftComment = trelloComments[task.id] ?? "";
    const trimmedComment = draftComment.trim();

    if (!trimmedComment) {
      setTrelloCardStatus((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || {}),
          commentError: "Please add a comment before submitting.",
          commentSuccess: "",
        },
      }));
      return;
    }

    setTrelloCardStatus((prev) => ({
      ...prev,
      [task.id]: {
        ...(prev[task.id] || {}),
        commentLoading: true,
        commentError: "",
        commentSuccess: "",
      },
    }));

    try {
      const response = await fetch("/api/trello", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "comment",
          cardId: task.trelloCardId,
          comment: trimmedComment,
        }),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const message = responseData?.error || "Failed to add the Trello comment.";
        throw new Error(message);
      }

      setTrelloComments((prev) => ({
        ...prev,
        [task.id]: "",
      }));

      setTrelloCardStatus((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || {}),
          commentLoading: false,
          commentError: "",
          commentSuccess: "Comment added successfully.",
        },
      }));
    } catch (err) {
      console.error("Failed to add Trello comment:", err);
      setTrelloCardStatus((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || {}),
          commentLoading: false,
          commentError: err.message || "Unable to add the Trello comment.",
          commentSuccess: "",
        },
      }));
    }
  };

  const updateTaskPriority = async (task, newPriority) => {
    if (!task || !task.originalId) {
      return;
    }

    setPriorityStatus((prev) => ({
      ...prev,
      [task.id]: { loading: true, error: "" },
    }));

    try {
      const response = await fetch("/api/task-priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: task.source,
          originalId: task.originalId,
          priority: newPriority || null, // null will remove the priority
        }),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const message = responseData?.error || "Failed to update task priority.";
        throw new Error(message);
      }

      // Update local task list
      setTasks((prevTasks) =>
        prevTasks.map((item) =>
          item.id === task.id ? { ...item, priority: newPriority || null } : item
        )
      );

      setPriorityStatus((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    } catch (err) {
      console.error("Failed to update task priority:", err);
      setPriorityStatus((prev) => ({
        ...prev,
        [task.id]: { loading: false, error: err.message || "Unable to update priority." },
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
          const priorityState = priorityStatus[task.id] || {};
          const trelloState = trelloCardStatus[task.id] || {};
          const trelloComment = trelloComments[task.id] ?? "";
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
                    {task.priority && (
                      <span className={`task-item__badge task-item__badge--priority-${task.priority}`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                  <p className="task-item__repo">
                    {task.source === "GitHub"
                      ? task.repo
                      : task.source === "Google Tasks"
                      ? `Pipeline: ${task.pipelineName}`
                      : isTrelloTask(task) && task.pipelineName
                      ? `List: ${task.pipelineName} · ${task.repo}`
                      : task.repo}
                  </p>
                  {isTrelloTask(task) && (dueLabel || statusLabel) && (
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

              <div className="task-item__priority">
                <label htmlFor={`priority-${task.id}`}>Priority</label>
                <select
                  id={`priority-${task.id}`}
                  className="task-item__priority-select"
                  value={task.priority || ""}
                  onChange={(event) => updateTaskPriority(task, event.target.value)}
                  disabled={Boolean(priorityState.loading)}
                >
                  <option value="">None</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                {priorityState.error && <p className="task-item__error">{priorityState.error}</p>}
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

              {isTrelloTask(task) && task.pipelineOptions?.length > 0 && (
                <div className="task-item__pipeline">
                  <label htmlFor={`trello-pipeline-${task.id}`}>List</label>
                  <select
                    id={`trello-pipeline-${task.id}`}
                    className="task-item__pipeline-select"
                    value={task.pipelineId}
                    onChange={(event) => moveTrelloCard(task, event.target.value)}
                    disabled={Boolean(trelloState.moveLoading)}
                  >
                    {task.pipelineOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  {trelloState.moveError && <p className="task-item__error">{trelloState.moveError}</p>}
                  {trelloState.moveSuccess && <p className="task-item__success">{trelloState.moveSuccess}</p>}
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

              {isTrelloTask(task) && (
                <div className="task-item__completion">
                  <label htmlFor={`trello-comment-${task.id}`}>Add a comment to this card</label>
                  <textarea
                    id={`trello-comment-${task.id}`}
                    className="task-item__note"
                    rows={3}
                    value={trelloComment}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTrelloComments((prev) => ({
                        ...prev,
                        [task.id]: value,
                      }));
                      setTrelloCardStatus((prev) => ({
                        ...prev,
                        [task.id]: {
                          ...(prev[task.id] || {}),
                          commentError: "",
                          commentSuccess: "",
                        },
                      }));
                    }}
                    placeholder="Share an update with your teammates…"
                    disabled={Boolean(trelloState.commentLoading)}
                  />
                  {trelloState.commentError && <p className="task-item__error">{trelloState.commentError}</p>}
                  {trelloState.commentSuccess && (
                    <p className="task-item__success">{trelloState.commentSuccess}</p>
                  )}
                  <div className="task-item__actions">
                    <button
                      type="button"
                      onClick={() => submitTrelloComment(task)}
                      className="button button--primary"
                      disabled={Boolean(trelloState.commentLoading)}
                    >
                      {trelloState.commentLoading ? "Posting..." : "Add comment"}
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
