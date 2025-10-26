import { useMemo, useState } from "react";
import { useTasks } from "../hooks/useTasks";

const SOURCE_BADGE_CLASS = {
  GitHub: "github",
  "Google Tasks": "google",
  Trello: "trello",
  Fellow: "trello",
};

function formatTimeEstimate(minutes) {
  if (!minutes) return "Not set";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function TodayTaskList() {
  const { tasks, setTasks, loading, fetchError } = useTasks();
  const [removingTaskId, setRemovingTaskId] = useState(null);

  // Filter for today tasks
  const todayTasks = useMemo(() => {
    return tasks.filter((task) => task.isToday);
  }, [tasks]);

  // Calculate time budget
  const timeStats = useMemo(() => {
    const totalMinutes = todayTasks.reduce((sum, task) => {
      return sum + (task.timeEstimate || 0);
    }, 0);

    const tasksWithEstimates = todayTasks.filter((task) => task.timeEstimate).length;
    const tasksWithoutEstimates = todayTasks.length - tasksWithEstimates;

    return {
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(1),
      tasksWithEstimates,
      tasksWithoutEstimates,
      isOverCommitted: totalMinutes > 480, // More than 8 hours
      isAlmostFull: totalMinutes > 360 && totalMinutes <= 480, // 6-8 hours
    };
  }, [todayTasks]);

  const removeFromToday = async (task) => {
    setRemovingTaskId(task.id);

    // Optimistically update UI
    setTasks((prevTasks) =>
      prevTasks.map((item) =>
        item.id === task.id ? { ...item, isToday: false } : item
      )
    );

    try {
      const response = await fetch("/api/task-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: task.source,
          originalId: task.originalId,
          isToday: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update today flag");
      }
    } catch (err) {
      console.error("Failed to remove from today:", err);
      // Revert on error
      setTasks((prevTasks) =>
        prevTasks.map((item) =>
          item.id === task.id ? { ...item, isToday: true } : item
        )
      );
    } finally {
      setRemovingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="task-card">
        <div className="task-state">
          <div className="task-state__spinner"></div>
          <h2 className="task-state__title">Loading your tasks for today...</h2>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="task-card">
        <p className="task-card__notice task-card__notice--warning">{fetchError}</p>
      </div>
    );
  }

  if (todayTasks.length === 0) {
    return (
      <div className="task-card">
        <div className="task-state">
          <span className="task-state__icon" role="img" aria-label="calendar">
            📅
          </span>
          <h2 className="task-state__title">No tasks scheduled for today</h2>
          <p className="task-state__message">
            Go to your Dashboard or Kanban board and check the "Add to Today list" box on tasks
            you want to focus on today.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="task-card">
      {/* Time Budget Header */}
      <div className={`today-budget ${timeStats.isOverCommitted ? "today-budget--over" : timeStats.isAlmostFull ? "today-budget--almost" : ""}`}>
        <div className="today-budget__main">
          <div className="today-budget__icon">
            {timeStats.isOverCommitted ? "⚠️" : timeStats.isAlmostFull ? "⏰" : "✓"}
          </div>
          <div className="today-budget__content">
            <h3 className="today-budget__title">
              {todayTasks.length} {todayTasks.length === 1 ? "task" : "tasks"} for today
            </h3>
            {timeStats.tasksWithEstimates > 0 && (
              <p className="today-budget__time">
                Estimated time: <strong>{formatTimeEstimate(timeStats.totalMinutes)}</strong>
                {timeStats.isOverCommitted && (
                  <span className="today-budget__warning"> - Over-committed!</span>
                )}
                {timeStats.isAlmostFull && !timeStats.isOverCommitted && (
                  <span className="today-budget__caution"> - Almost a full day</span>
                )}
              </p>
            )}
            {timeStats.tasksWithoutEstimates > 0 && (
              <p className="today-budget__unestimated">
                {timeStats.tasksWithoutEstimates} {timeStats.tasksWithoutEstimates === 1 ? "task" : "tasks"} without time estimates
              </p>
            )}
          </div>
        </div>
        {timeStats.tasksWithEstimates > 0 && (
          <div className="today-budget__bar">
            <div
              className="today-budget__bar-fill"
              style={{
                width: `${Math.min((timeStats.totalMinutes / 480) * 100, 100)}%`,
              }}
            ></div>
          </div>
        )}
      </div>

      {/* Task List */}
      <ul className="task-card__items">
        {todayTasks.map((task) => {
          const badgeClass = SOURCE_BADGE_CLASS[task.source] || "default";
          const description = task.description?.trim();

          return (
            <li key={task.id} className="task-item task-item--today">
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
                        {task.title || task.name}
                      </a>
                    ) : (
                      <span className="task-item__title">{task.title || task.name}</span>
                    )}
                    <span className={`task-item__badge task-item__badge--${badgeClass}`}>
                      {task.source}
                    </span>
                    {task.priority && (
                      <span className={`task-item__badge task-item__badge--priority-${task.priority}`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                  {task.repo && (
                    <p className="task-item__repo">
                      {task.source === "GitHub" ? task.repo : `${task.repo}`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeFromToday(task)}
                  className="button button--ghost button--small"
                  disabled={removingTaskId === task.id}
                >
                  {removingTaskId === task.id ? "Removing..." : "Remove"}
                </button>
              </div>

              {description && (
                <p className="task-item__description">{description}</p>
              )}

              {/* Time estimate badge */}
              {task.timeEstimate && (
                <div className="task-item__time-badge">
                  ⏱️ {formatTimeEstimate(task.timeEstimate)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
