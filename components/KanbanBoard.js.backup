import { useEffect, useMemo, useState } from "react";
import { deriveOriginalId } from "../lib/taskIdentity.js";
import { useTasks } from "../hooks/useTasks";

const STAGES = ["Backlog", "In Progress", "Review", "Done"];

const MANAGED_COMPLETION_SOURCES = new Set(["GitHub", "Google Tasks", "Trello", "Fellow"]);

function isManagedCompletionTask(task) {
  if (!task) {
    return false;
  }

  return MANAGED_COMPLETION_SOURCES.has(task.source);
}

function normalizeText(value) {
  return value?.toString().trim().toLowerCase() || "";
}

function findPipelineOption(task, targetName) {
  if (!task || !Array.isArray(task.pipelineOptions)) {
    return null;
  }

  const normalizedTarget = normalizeText(targetName);

  return (
    task.pipelineOptions.find((option) => normalizeText(option?.name) === normalizedTarget) || null
  );
}

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

async function persistCompletedTaskSnapshot(task, note, overrides = {}) {
  const originalId = deriveOriginalId(task);

  if (!originalId) {
    throw new Error("Unable to determine a stable identifier for this task.");
  }

  const timestamp = overrides.completedAt || new Date().toISOString();
  const payload = {
    source: task.source || "Other",
    originalId,
    id: task.id,
    title: task.title || task.name || "Untitled task",
    notes: note || "",
    completedAt: timestamp,
    updatedAt: overrides.updatedAt || timestamp,
    repo: task.repo || null,
    pipelineId: task.pipelineId || null,
    pipelineName: task.pipelineName || null,
    url: task.url || null,
    description: task.description || "",
    status: overrides.status || task.status || "Completed locally",
    locallyCompleted: true,
  };

  if (task.issue_number) {
    payload.issue_number = task.issue_number;
  }

  if (task.googleTaskId) {
    payload.googleTaskId = task.googleTaskId;
  }

  if (task.googleTaskListId) {
    payload.googleTaskListId = task.googleTaskListId;
  }

  if (task.trelloCardId) {
    payload.trelloCardId = task.trelloCardId;
  }

  if (task.trelloListId) {
    payload.trelloListId = task.trelloListId;
  }

  if (task.fellowActionId) {
    payload.fellowActionId = task.fellowActionId;
  }

  const response = await fetch("/api/completed-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || "Failed to persist the completed task snapshot.";
    throw new Error(message);
  }

  return data;
}

export default function KanbanBoard() {
  const { tasks, setTasks, loading, fetchError } = useTasks();
  const [taskStages, setTaskStages] = useState({});
  const [visibleSources, setVisibleSources] = useState({});
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [completionModal, setCompletionModal] = useState({
    taskId: null,
    note: "",
    error: "",
    submitting: false,
    previousStage: null,
  });

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

  const handleModalNoteChange = (event) => {
    const nextValue = event?.target?.value ?? "";
    setCompletionModal((prev) => ({
      ...prev,
      note: nextValue,
    }));
  };

  const confirmCompletion = async () => {
    if (!completionTask) {
      closeCompletionModal();
      return;
    }

    const trimmedNote = completionModal.note.trim();

    setCompletionModal((prev) => ({
      ...prev,
      submitting: true,
      error: "",
    }));

    try {
      const completedAt = new Date().toISOString();
      let nextTaskVersion = null;
      let updateTasks = null;
      let updateStages = null;

      if (completionTask.source === "GitHub") {
        const repoSlug = completionTask.repo || "";
        const [owner, repo] = repoSlug.split("/");

        if (!owner || !repo || !completionTask.issue_number) {
          throw new Error("Unable to determine the GitHub issue to close.");
        }

        const response = await fetch("/api/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner,
            repo,
            issue_number: completionTask.issue_number,
            comment: trimmedNote,
          }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const message = data?.error || "Failed to mark the GitHub issue as done.";
          throw new Error(message);
        }

        nextTaskVersion = {
          ...completionTask,
          status: "Completed locally",
          locallyCompleted: true,
          completedAt,
        };

        if (trimmedNote) {
          nextTaskVersion.completionNote = trimmedNote;
        }

        updateTasks = (prev) =>
          prev.map((item) => (item.id === completionTask.id ? nextTaskVersion : item));
      } else if (completionTask.source === "Google Tasks") {
        const completedOption = findPipelineOption(completionTask, "Completed tasks");

        if (!completedOption) {
          throw new Error("Couldn't find a \"Completed tasks\" list for this Google Task.");
        }

        const currentListId = completionTask.googleTaskListId || completionTask.pipelineId;

        if (!completionTask.googleTaskId || !currentListId) {
          throw new Error("Unable to determine the Google Task identifiers to update.");
        }

        if (completedOption.id === currentListId) {
          nextTaskVersion = {
            ...completionTask,
            pipelineName: completedOption.name,
            repo: completedOption.name,
            status: "completed",
            locallyCompleted: true,
            completedAt,
          };

          updateTasks = (prev) =>
            prev.map((item) => (item.id === completionTask.id ? nextTaskVersion : item));
        } else {
          const response = await fetch("/api/google-tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: completionTask.googleTaskId,
              currentListId,
              targetListId: completedOption.id,
            }),
          });

          const data = await response.json().catch(() => null);

          if (!response.ok) {
            const message = data?.error || "Failed to move the Google Task to Completed tasks.";
            throw new Error(message);
          }

          const newTaskId = data?.task?.id || completionTask.googleTaskId;
          const newTaskListId = data?.task?.tasklist || completedOption.id;
          const nextStatus = data?.task?.status || "completed";
          const nextTaskId = `google-${newTaskId}`;

          nextTaskVersion = {
            ...completionTask,
            id: nextTaskId,
            googleTaskId: newTaskId,
            googleTaskListId: newTaskListId,
            pipelineId: newTaskListId,
            pipelineName: completedOption.name,
            repo: completedOption.name,
            status: nextStatus,
            locallyCompleted: true,
            completedAt,
          };

          updateTasks = (prev) =>
            prev.map((item) => (item.id === completionTask.id ? nextTaskVersion : item));

          updateStages = (prev) => {
            const next = { ...prev };
            delete next[completionTask.id];
            next[nextTaskId] = "Done";
            return next;
          };
        }
      } else if (completionTask.source === "Trello" || completionTask.source === "Fellow") {
        const completedOption = findPipelineOption(completionTask, "Completed");

        if (!completedOption) {
          throw new Error("Couldn't find a \"Completed\" list for this card.");
        }

        if (completedOption.id === completionTask.trelloListId) {
          if (trimmedNote) {
            const commentResponse = await fetch("/api/trello", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "comment",
                cardId: completionTask.trelloCardId,
                comment: trimmedNote,
              }),
            });

            const commentData = await commentResponse.json().catch(() => null);

            if (!commentResponse.ok) {
              const message = commentData?.error || "Adding the comment to Trello failed.";
              throw new Error(message);
            }
          }

          nextTaskVersion = {
            ...completionTask,
            pipelineName: completedOption.name,
            status: "completed",
            locallyCompleted: true,
            completedAt,
          };

          updateTasks = (prev) =>
            prev.map((item) => (item.id === completionTask.id ? nextTaskVersion : item));
        } else {
          const response = await fetch("/api/trello", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "move",
              cardId: completionTask.trelloCardId,
              targetListId: completedOption.id,
            }),
          });

          const data = await response.json().catch(() => null);

          if (!response.ok) {
            const message = data?.error || "Failed to move the Trello card to Completed.";
            throw new Error(message);
          }

          if (trimmedNote) {
            const commentResponse = await fetch("/api/trello", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "comment",
                cardId: completionTask.trelloCardId,
                comment: trimmedNote,
              }),
            });

            const commentData = await commentResponse.json().catch(() => null);

            if (!commentResponse.ok) {
              const message = commentData?.error || "The card was moved but adding the comment failed.";
              throw new Error(message);
            }
          }

          nextTaskVersion = {
            ...completionTask,
            pipelineId: completedOption.id,
            pipelineName: completedOption.name,
            trelloListId: completedOption.id,
            status: "completed",
            locallyCompleted: true,
            completedAt,
          };

          updateTasks = (prev) =>
            prev.map((item) => (item.id === completionTask.id ? nextTaskVersion : item));
        }
      } else {
        nextTaskVersion = {
          ...completionTask,
          status: completionTask.status || "Completed locally",
          locallyCompleted: true,
          completedAt,
        };

        updateTasks = (prev) =>
          prev.map((item) => (item.id === completionTask.id ? nextTaskVersion : item));
      }

      if (!nextTaskVersion) {
        nextTaskVersion = {
          ...completionTask,
          status: "Completed locally",
          locallyCompleted: true,
          completedAt,
        };

        updateTasks = (prev) =>
          prev.map((item) => (item.id === completionTask.id ? nextTaskVersion : item));
      }

      const originalId = deriveOriginalId(nextTaskVersion);
      nextTaskVersion = {
        ...nextTaskVersion,
        originalId,
      };

      if (!updateStages) {
        updateStages = (prev) => {
          const next = { ...prev };
          if (nextTaskVersion.id !== completionTask.id) {
            delete next[completionTask.id];
          }
          next[nextTaskVersion.id] = "Done";
          return next;
        };
      }

      await persistCompletedTaskSnapshot(nextTaskVersion, trimmedNote, {
        completedAt,
        status: nextTaskVersion.status,
      });

      setTasks((prev) => updateTasks(prev));
      setTaskStages((prev) => updateStages(prev));

      closeCompletionModal();
    } catch (error) {
      const message = error?.message || "We couldn't finish completing this task.";
      setCompletionModal((prev) => ({
        ...prev,
        submitting: false,
        error: message,
      }));
    }
  };

  const openCompletionModal = (taskId, previousStage) => {
    setCompletionModal({
      taskId,
      note: "",
      error: "",
      submitting: false,
      previousStage,
    });
  };

  const closeCompletionModal = () => {
    setCompletionModal({
      taskId: null,
      note: "",
      error: "",
      submitting: false,
      previousStage: null,
    });
  };

  const completionTask = useMemo(
    () => tasks.find((task) => task.id === completionModal.taskId) || null,
    [tasks, completionModal.taskId]
  );

  const previousStageLabel =
    completionModal.previousStage && completionModal.previousStage !== "Done"
      ? completionModal.previousStage
      : null;

  const handleDrop = (stage) => (event) => {
    event.preventDefault();
    if (!draggedTaskId) {
      return;
    }

    const task = tasks.find((item) => item.id === draggedTaskId) || null;
    const previousStage = taskStages[draggedTaskId] || deriveInitialStage(task);

    setDraggedTaskId(null);
    setDragOverStage(null);

    if (stage === "Done" && isManagedCompletionTask(task)) {
      openCompletionModal(draggedTaskId, previousStage);
      return;
    }

    setTaskStages((prev) => ({
      ...prev,
      [draggedTaskId]: stage,
    }));
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

      {completionTask && (
        <div className="kanban-board__modal-backdrop">
          <div
            className="kanban-board__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kanban-complete-title"
          >
            <h2 id="kanban-complete-title" className="kanban-board__modal-title">
              Complete this task?
            </h2>
            <p className="kanban-board__modal-message">
              You&apos;re about to move <strong>{completionTask.title || completionTask.name}</strong>
              {previousStageLabel ? (
                <>
                  {" from "}
                  <span className="kanban-board__modal-stage">{previousStageLabel}</span>
                  {" to the Done column."}
                </>
              ) : (
                " to the Done column."
              )}{" "}
              Add a quick note about the completion and confirm to finish.
            </p>

            <label className="kanban-board__modal-label" htmlFor="kanban-complete-note">
              Completion note (optional)
            </label>
            <textarea
              id="kanban-complete-note"
              className="kanban-board__modal-textarea"
              rows={4}
              value={completionModal.note}
              onChange={handleModalNoteChange}
              disabled={completionModal.submitting}
            />

            {completionModal.error && (
              <p className="kanban-board__modal-error" role="alert">
                {completionModal.error}
              </p>
            )}

            <div className="kanban-board__modal-actions">
              <button
                type="button"
                className="kanban-board__modal-button kanban-board__modal-button--secondary"
                onClick={closeCompletionModal}
                disabled={completionModal.submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="kanban-board__modal-button kanban-board__modal-button--primary"
                onClick={confirmCompletion}
                disabled={completionModal.submitting}
              >
                {completionModal.submitting ? "Completing…" : "Confirm completion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
