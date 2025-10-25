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
  const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());
  const [taskComments, setTaskComments] = useState({});
  const [taskStates, setTaskStates] = useState({});
  const [priorityStatus, setPriorityStatus] = useState({});
  const [pipelineStatus, setPipelineStatus] = useState({});
  const [sourceFilter, setSourceFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  useEffect(() => {
    // Initialize comments for all tasks
    setTaskComments((prev) => {
      const next = { ...prev };
      tasks.forEach((task) => {
        if (!next[task.id]) {
          next[task.id] = "";
        }
      });
      return next;
    });
  }, [tasks]);

  const toggleTaskExpanded = (taskId) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const updateTaskComment = (taskId, value) => {
    setTaskComments((prev) => ({
      ...prev,
      [taskId]: value,
    }));
    // Clear errors when user types
    setTaskStates((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        commentError: "",
        commentSuccess: "",
      },
    }));
  };

  const submitComment = async (task) => {
    const comment = taskComments[task.id]?.trim();

    if (!comment) {
      setTaskStates((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || {}),
          commentError: "Please enter a comment",
        },
      }));
      return;
    }

    setTaskStates((prev) => ({
      ...prev,
      [task.id]: {
        ...(prev[task.id] || {}),
        commentLoading: true,
        commentError: "",
        commentSuccess: "",
      },
    }));

    try {
      const response = await fetch("/api/task-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, comment }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to add comment");
      }

      setTaskComments((prev) => ({
        ...prev,
        [task.id]: "",
      }));

      setTaskStates((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || {}),
          commentLoading: false,
          commentSuccess: "Comment added successfully",
        },
      }));
    } catch (error) {
      console.error("Error adding comment:", error);
      setTaskStates((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || {}),
          commentLoading: false,
          commentError: error.message || "Failed to add comment",
        },
      }));
    }
  };

  const completeTask = async (task) => {
    const note = taskComments[task.id]?.trim() || "";

    setTaskStates((prev) => ({
      ...prev,
      [task.id]: {
        ...(prev[task.id] || {}),
        completeLoading: true,
        completeError: "",
      },
    }));

    try {
      const response = await fetch("/api/task-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, note }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to complete task");
      }

      // Remove from task list
      setTasks((prevTasks) => prevTasks.filter((item) => item.id !== task.id));
      setExpandedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    } catch (error) {
      console.error("Error completing task:", error);
      setTaskStates((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || {}),
          completeLoading: false,
          completeError: error.message || "Failed to complete task",
        },
      }));
    }
  };

  const updateTaskPriority = async (task, newPriority) => {
    if (!task || !task.originalId) {
      console.error("Missing task or originalId:", { task, hasOriginalId: !!task?.originalId });
      setPriorityStatus((prev) => ({
        ...prev,
        [task.id]: { loading: false, error: "Task missing required originalId" },
      }));
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
          priority: newPriority || null,
        }),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const message = responseData?.error || "Failed to update task priority.";
        const details = responseData?.details ? ` (${responseData.details})` : "";
        throw new Error(message + details);
      }

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

    setTaskStates((prev) => ({
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

      setTaskStates((prev) => ({
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
      setTaskStates((prev) => ({
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

  // Apply filters
  const filteredTasks = tasks.filter((task) => {
    // Source filter
    if (sourceFilter !== "all" && task.source !== sourceFilter) {
      return false;
    }
    // Priority filter
    if (priorityFilter !== "all") {
      if (priorityFilter === "none" && task.priority) {
        return false;
      }
      if (priorityFilter !== "none" && task.priority !== priorityFilter) {
        return false;
      }
    }
    return true;
  });

  // Get unique sources for filter buttons
  const availableSources = ["all", ...new Set(tasks.map((task) => task.source))];

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

      {/* Filter Controls */}
      <div className="filter-controls">
        <div className="filter-controls__group">
          <label className="filter-controls__label">Source</label>
          <div className="filter-controls__buttons">
            {availableSources.map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setSourceFilter(source)}
                className={`filter-controls__button${
                  sourceFilter === source ? " filter-controls__button--active" : ""
                }`}
              >
                {source === "all" ? "All" : source}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-controls__group">
          <label className="filter-controls__label">Priority</label>
          <div className="filter-controls__buttons">
            <button
              type="button"
              onClick={() => setPriorityFilter("all")}
              className={`filter-controls__button${
                priorityFilter === "all" ? " filter-controls__button--active" : ""
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setPriorityFilter("high")}
              className={`filter-controls__button${
                priorityFilter === "high" ? " filter-controls__button--active" : ""
              }`}
            >
              High
            </button>
            <button
              type="button"
              onClick={() => setPriorityFilter("medium")}
              className={`filter-controls__button${
                priorityFilter === "medium" ? " filter-controls__button--active" : ""
              }`}
            >
              Medium
            </button>
            <button
              type="button"
              onClick={() => setPriorityFilter("low")}
              className={`filter-controls__button${
                priorityFilter === "low" ? " filter-controls__button--active" : ""
              }`}
            >
              Low
            </button>
            <button
              type="button"
              onClick={() => setPriorityFilter("none")}
              className={`filter-controls__button${
                priorityFilter === "none" ? " filter-controls__button--active" : ""
              }`}
            >
              None
            </button>
          </div>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="task-state">
          <p className="task-state__message">No tasks match the selected filters.</p>
        </div>
      ) : (
        <ul className="task-card__items">
          {filteredTasks.map((task) => {
          const isExpanded = expandedTaskIds.has(task.id);
          const description = task.description?.trim();
          const badgeClass = SOURCE_BADGE_CLASS[task.source] || "default";
          const priorityState = priorityStatus[task.id] || {};
          const pipelineState = pipelineStatus[task.id] || {};
          const taskState = taskStates[task.id] || {};
          const comment = taskComments[task.id] ?? "";
          const dueLabel = formatDueDate(task.dueDate || task.due);
          const statusLabel = formatStatus(task.status);

          return (
            <li key={task.id} className="task-item">
              {/* Title and Badges */}
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
                <button
                  type="button"
                  onClick={() => toggleTaskExpanded(task.id)}
                  className="button button--primary button--small"
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </button>
              </div>

              {/* Description */}
              {description ? (
                <p className="task-item__description">{description}</p>
              ) : (
                <p className="task-item__description task-item__description--muted">
                  No description provided.
                </p>
              )}

              {/* Expanded Section */}
              {isExpanded && (
                <div className="task-item__expanded">
                  {/* Priority Dropdown */}
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

                  {/* Pipeline/List Dropdown for Google Tasks */}
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

                  {/* List Dropdown for Trello */}
                  {isTrelloTask(task) && task.pipelineOptions?.length > 0 && (
                    <div className="task-item__pipeline">
                      <label htmlFor={`trello-pipeline-${task.id}`}>List</label>
                      <select
                        id={`trello-pipeline-${task.id}`}
                        className="task-item__pipeline-select"
                        value={task.pipelineId}
                        onChange={(event) => moveTrelloCard(task, event.target.value)}
                        disabled={Boolean(taskState.moveLoading)}
                      >
                        {task.pipelineOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                      {taskState.moveError && <p className="task-item__error">{taskState.moveError}</p>}
                      {taskState.moveSuccess && <p className="task-item__success">{taskState.moveSuccess}</p>}
                    </div>
                  )}

                  {/* Unified Comment Section */}
                  <div className="task-item__comment-section">
                    <label htmlFor={`comment-${task.id}`}>Add a comment or note</label>
                    <textarea
                      id={`comment-${task.id}`}
                      className="task-item__note"
                      rows={3}
                      value={comment}
                      onChange={(event) => updateTaskComment(task.id, event.target.value)}
                      placeholder="Share an update or note about this task…"
                      disabled={Boolean(taskState.commentLoading)}
                    />
                    {taskState.commentError && <p className="task-item__error">{taskState.commentError}</p>}
                    {taskState.commentSuccess && (
                      <p className="task-item__success">{taskState.commentSuccess}</p>
                    )}
                    <div className="task-item__actions">
                      <button
                        type="button"
                        onClick={() => submitComment(task)}
                        className="button button--ghost button--small"
                        disabled={Boolean(taskState.commentLoading)}
                      >
                        {taskState.commentLoading ? "Posting..." : "Add Comment"}
                      </button>
                    </div>
                  </div>

                  {/* Unified Complete Button */}
                  <div className="task-item__completion-section">
                    {taskState.completeError && (
                      <p className="task-item__error">{taskState.completeError}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => completeTask(task)}
                      className="button button--success"
                      disabled={Boolean(taskState.completeLoading)}
                    >
                      {taskState.completeLoading ? "Completing..." : "Mark Complete"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        </ul>
      )}
    </div>
  );
}
