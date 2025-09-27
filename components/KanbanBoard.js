import { useEffect, useMemo, useState } from "react";
import { useTasks } from "../hooks/useTasks";

const STAGES = ["Backlog", "In Progress", "Review", "Done"];

function deriveInitialStage(task) {
  const statusText = [task?.status, task?.pipelineName, task?.state]
    .filter(Boolean)
    .map((value) => value.toString().toLowerCase())
    .join(" ");

  if (statusText.includes("review")) {
    return "Review";
  }

  if (statusText.includes("progress") || statusText.includes("doing") || statusText.includes("active")) {
    return "In Progress";
  }

  if (
    statusText.includes("done") ||
    statusText.includes("complete") ||
    statusText.includes("closed") ||
    statusText.includes("resolved")
  ) {
    return "Done";
  }

  return "Backlog";
}

function getSourceKey(task) {
  return task?.source || "Other";
}

export default function KanbanBoard() {
  const { tasks, loading, fetchError } = useTasks();
  const [taskStages, setTaskStages] = useState({});
  const [visibleSources, setVisibleSources] = useState({});

  useEffect(() => {
    setTaskStages((prev) => {
      const next = { ...prev };
      tasks.forEach((task) => {
        if (!next[task.id]) {
          next[task.id] = deriveInitialStage(task);
        }
      });
      return next;
    });
  }, [tasks]);

  useEffect(() => {
    setVisibleSources((prev) => {
      const next = { ...prev };
      tasks.forEach((task) => {
        const source = getSourceKey(task);
        if (typeof next[source] === "undefined") {
          next[source] = true;
        }
      });
      return next;
    });
  }, [tasks]);

  const columns = useMemo(() => {
    const grouped = Object.fromEntries(STAGES.map((stage) => [stage, []]));

    tasks.forEach((task) => {
      const source = getSourceKey(task);
      if (!visibleSources[source]) {
        return;
      }

      const stage = taskStages[task.id] || "Backlog";
      if (!grouped[stage]) {
        grouped[stage] = [];
      }

      grouped[stage].push(task);
    });

    return grouped;
  }, [taskStages, tasks, visibleSources]);

  const toggleSource = (source) => {
    setVisibleSources((prev) => ({
      ...prev,
      [source]: !prev[source],
    }));
  };

  const handleStageChange = (taskId, stage) => {
    setTaskStages((prev) => ({
      ...prev,
      [taskId]: stage,
    }));
  };

  if (loading) {
    return (
      <div className="kanban-board kanban-board--loading">
        <p>Loading board…</p>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="kanban-board kanban-board--empty">
        <p>You&apos;re all caught up! No tasks to show right now.</p>
      </div>
    );
  }

  const sources = Object.keys(visibleSources);

  return (
    <div className="kanban-board">
      <div className="kanban-board__controls" aria-label="Task source filters">
        <span className="kanban-board__filters-label">Task sources:</span>
        <div className="kanban-board__filters">
          {sources.map((source) => (
            <button
              key={source}
              type="button"
              className={`kanban-board__filter${visibleSources[source] ? " kanban-board__filter--active" : ""}`}
              onClick={() => toggleSource(source)}
              aria-pressed={visibleSources[source]}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      {fetchError && <p className="kanban-board__error">{fetchError}</p>}

      <div className="kanban-board__columns">
        {STAGES.map((stage) => {
          const stageTasks = columns[stage] || [];

          return (
            <section key={stage} className="kanban-board__column" aria-label={`${stage} column`}>
              <header className="kanban-board__column-header">
                <h2>{stage}</h2>
                <span className="kanban-board__count">{stageTasks.length}</span>
              </header>

              <ul className="kanban-board__list">
                {stageTasks.map((task) => {
                  const source = getSourceKey(task);
                  const badgeClass = source.toLowerCase().includes("github")
                    ? "task-item__badge--github"
                    : source.toLowerCase().includes("google")
                      ? "task-item__badge--google"
                      : source.toLowerCase().includes("trello")
                        ? "task-item__badge--trello"
                        : "task-item__badge--default";

                  return (
                    <li key={task.id} className="kanban-board__card">
                      <div className="kanban-board__card-meta">
                        <span className={`task-item__badge ${badgeClass}`}>{source}</span>
                        {(task.repo || task.pipelineName) && (
                          <p className="kanban-board__card-subtext">{task.repo || task.pipelineName}</p>
                        )}
                      </div>
                      <p className="kanban-board__card-title">{task.title || task.name}</p>
                      {task.description && (
                        <p className="kanban-board__card-description">{task.description}</p>
                      )}
                      <label className="kanban-board__stage-label" htmlFor={`stage-${task.id}`}>
                        Stage
                      </label>
                      <select
                        id={`stage-${task.id}`}
                        className="kanban-board__stage-select"
                        value={taskStages[task.id] || "Backlog"}
                        onChange={(event) => handleStageChange(task.id, event.target.value)}
                      >
                        {STAGES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
