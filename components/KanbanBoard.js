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
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

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

  const handleDrop = (stage) => (event) => {
    event.preventDefault();
    if (!draggedTaskId) {
      return;
    }

    setTaskStages((prev) => ({
      ...prev,
      [draggedTaskId]: stage,
    }));
    setDraggedTaskId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (stage) => (event) => {
    if (!draggedTaskId) {
      return;
    }

    event.preventDefault();
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleDragLeave = (stage) => (event) => {
    if (!draggedTaskId) {
      return;
    }

    const nextTarget = event?.relatedTarget;
    const currentTarget = event?.currentTarget;
    const canCheckContainment = typeof Node !== "undefined" && nextTarget instanceof Node;

    if (currentTarget && canCheckContainment) {
      if (currentTarget.contains(nextTarget)) {
        return;
      }
    }

    if (dragOverStage === stage) {
      setDragOverStage(null);
    }
  };

  const handleDragStart = (taskId) => (event) => {
    setDraggedTaskId(taskId);
    setDragOverStage(taskStages[taskId] || "Backlog");
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(taskId));
    }
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverStage(null);
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
          const columnClassName = `kanban-board__column${
            dragOverStage === stage ? " kanban-board__column--active" : ""
          }`;

          return (
            <section
              key={stage}
              className={columnClassName}
              aria-label={`${stage} column`}
              onDragOver={handleDragOver(stage)}
              onDragEnter={handleDragOver(stage)}
              onDragLeave={handleDragLeave(stage)}
              onDrop={handleDrop(stage)}
            >
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
                  const isDragging = draggedTaskId === task.id;

                  return (
                    <li
                      key={task.id}
                      className={`kanban-board__card${
                        isDragging ? " kanban-board__card--dragging" : ""
                      }`}
                      draggable
                      onDragStart={handleDragStart(task.id)}
                      onDragEnd={handleDragEnd}
                      aria-grabbed={isDragging}
                    >
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
                      <p className="kanban-board__stage-hint" role="note">
                        Drag to move this task to a different stage.
                      </p>
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
