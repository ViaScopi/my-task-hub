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
  const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());
  const [taskComments, setTaskComments] = useState({});
  const [taskStates, setTaskStates] = useState({});
  const [priorityStatus, setPriorityStatus] = useState({});
  const [pipelineStatus, setPipelineStatus] = useState({});
  const [sortBy, setSortBy] = useState("none");
  const [sortOrder, setSortOrder] = useState("asc");

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

  // Initialize comments for all tasks
  useEffect(() => {
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

  const updateTaskPriority = async (task, newPriority) => {
    if (!task || !task.originalId) {
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
    const isTrello = task?.source === "Trello" || task?.source === "Fellow";
    if (!task || !isTrello) {
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

  const archiveTask = async (task) => {
    if (!task) {
      return;
    }

    const note = taskComments[task.id]?.trim() || "";

    setTaskStates((prev) => ({
      ...prev,
      [task.id]: {
        ...(prev[task.id] || {}),
        archiveLoading: true,
        archiveError: "",
        archiveSuccess: "",
      },
    }));

    try {
      const response = await fetch("/api/task-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, note }),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const message = responseData?.error || responseData?.details || "Failed to archive task.";
        throw new Error(message);
      }

      // Remove task from the list
      setTasks((prevTasks) => prevTasks.filter((item) => item.id !== task.id));

      // Clean up state
      setExpandedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setTaskComments((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      setTaskStates((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    } catch (err) {
      console.error("Failed to archive task:", err);
      setTaskStates((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || {}),
          archiveLoading: false,
          archiveError: err.message || "Unable to archive task.",
          archiveSuccess: "",
        },
      }));
    }
  };

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

    // Apply sorting to each column
    if (sortBy !== "none") {
      Object.keys(grouped).forEach((stage) => {
        grouped[stage].sort((a, b) => {
          let compareValue = 0;

          if (sortBy === "source") {
            const sourceA = getSourceKey(a) || "";
            const sourceB = getSourceKey(b) || "";
            compareValue = sourceA.localeCompare(sourceB);
          } else if (sortBy === "priority") {
            const priorityOrder = { high: 3, medium: 2, low: 1, "": 0, null: 0, undefined: 0 };
            const priorityA = priorityOrder[a.priority] || 0;
            const priorityB = priorityOrder[b.priority] || 0;
            compareValue = priorityB - priorityA; // Higher priority first by default
          }

          // Apply sort order
          return sortOrder === "asc" ? compareValue : -compareValue;
        });
      });
    }

    return grouped;
  }, [taskStages, tasks, visibleSources, sortBy, sortOrder]);

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

      {/* Sorting Controls */}
      <div className="kanban-board__sort-controls">
        <div className="kanban-board__sort-group">
          <label className="kanban-board__sort-label">Sort by:</label>
          <select
            className="kanban-board__sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="none">None</option>
            <option value="source">Source</option>
            <option value="priority">Priority</option>
          </select>
        </div>
        {sortBy !== "none" && (
          <div className="kanban-board__sort-group">
            <label className="kanban-board__sort-label">Order:</label>
            <select
              className="kanban-board__sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="asc">
                {sortBy === "priority" ? "High to Low" : "Ascending"}
              </option>
              <option value="desc">
                {sortBy === "priority" ? "Low to High" : "Descending"}
              </option>
            </select>
          </div>
        )}
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
                  const isExpanded = expandedTaskIds.has(task.id);
                  const priorityState = priorityStatus[task.id] || {};
                  const pipelineState = pipelineStatus[task.id] || {};
                  const taskState = taskStates[task.id] || {};
                  const comment = taskComments[task.id] ?? "";
                  const isTrello = task?.source === "Trello" || task?.source === "Fellow";

                  return (
                    <li
                      key={task.id}
                      className={`kanban-board__card${
                        isDragging ? " kanban-board__card--dragging" : ""
                      }${isExpanded ? " kanban-board__card--expanded" : ""}`}
                      draggable
                      onDragStart={handleDragStart(task.id)}
                      onDragEnd={handleDragEnd}
                      aria-grabbed={isDragging}
                    >
                      {/* Header with badges and expand button */}
                      <div className="kanban-board__card-header">
                        <div className="kanban-board__card-badges">
                          <span className={`task-item__badge ${badgeClass}`}>{source}</span>
                          {task.priority && (
                            <span className={`task-item__badge task-item__badge--priority-${task.priority}`}>
                              {task.priority}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskExpanded(task.id);
                          }}
                          className="kanban-board__expand-btn"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? "−" : "+"}
                        </button>
                      </div>

                      {/* Title */}
                      <a
                        href={task.url}
                        target="_blank"
                        rel="noreferrer"
                        className="kanban-board__card-title"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {task.title || task.name}
                      </a>

                      {/* Repo/Pipeline info */}
                      {(task.repo || task.pipelineName) && (
                        <p className="kanban-board__card-subtext">
                          {task.source === "GitHub"
                            ? task.repo
                            : task.source === "Google Tasks"
                            ? `Pipeline: ${task.pipelineName}`
                            : isTrello && task.pipelineName
                            ? `List: ${task.pipelineName} · ${task.repo}`
                            : task.repo}
                        </p>
                      )}

                      {/* Description */}
                      {task.description ? (
                        <p className="kanban-board__card-description">{task.description}</p>
                      ) : (
                        !isExpanded && (
                          <p className="kanban-board__card-description kanban-board__card-description--muted">
                            No description provided.
                          </p>
                        )
                      )}

                      {/* Expanded section */}
                      {isExpanded && (
                        <div className="kanban-board__card-expanded" onClick={(e) => e.stopPropagation()}>
                          {/* Priority Dropdown */}
                          <div className="kanban-board__card-field">
                            <label htmlFor={`kanban-priority-${task.id}`}>Priority</label>
                            <select
                              id={`kanban-priority-${task.id}`}
                              className="kanban-board__card-select"
                              value={task.priority || ""}
                              onChange={(event) => updateTaskPriority(task, event.target.value)}
                              disabled={Boolean(priorityState.loading)}
                            >
                              <option value="">None</option>
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                            {priorityState.error && (
                              <p className="kanban-board__card-error">{priorityState.error}</p>
                            )}
                          </div>

                          {/* Pipeline/List Dropdown for Google Tasks */}
                          {task.source === "Google Tasks" && task.pipelineOptions?.length > 0 && (
                            <div className="kanban-board__card-field">
                              <label htmlFor={`kanban-pipeline-${task.id}`}>Pipeline</label>
                              <select
                                id={`kanban-pipeline-${task.id}`}
                                className="kanban-board__card-select"
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
                              {pipelineState.error && (
                                <p className="kanban-board__card-error">{pipelineState.error}</p>
                              )}
                            </div>
                          )}

                          {/* List Dropdown for Trello */}
                          {isTrello && task.pipelineOptions?.length > 0 && (
                            <div className="kanban-board__card-field">
                              <label htmlFor={`kanban-trello-list-${task.id}`}>List</label>
                              <select
                                id={`kanban-trello-list-${task.id}`}
                                className="kanban-board__card-select"
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
                              {taskState.moveError && (
                                <p className="kanban-board__card-error">{taskState.moveError}</p>
                              )}
                              {taskState.moveSuccess && (
                                <p className="kanban-board__card-success">{taskState.moveSuccess}</p>
                              )}
                            </div>
                          )}

                          {/* Comment section */}
                          <div className="kanban-board__card-field">
                            <label htmlFor={`kanban-comment-${task.id}`}>Add a comment or note</label>
                            <textarea
                              id={`kanban-comment-${task.id}`}
                              className="kanban-board__card-textarea"
                              rows={3}
                              value={comment}
                              onChange={(event) => updateTaskComment(task.id, event.target.value)}
                              placeholder="Share an update or note about this task…"
                              disabled={Boolean(taskState.commentLoading)}
                            />
                            {taskState.commentError && (
                              <p className="kanban-board__card-error">{taskState.commentError}</p>
                            )}
                            {taskState.commentSuccess && (
                              <p className="kanban-board__card-success">{taskState.commentSuccess}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => submitComment(task)}
                              className="kanban-board__card-btn kanban-board__card-btn--secondary"
                              disabled={Boolean(taskState.commentLoading)}
                            >
                              {taskState.commentLoading ? "Posting..." : "Add Comment"}
                            </button>
                          </div>

                          {/* Archive button - only show for tasks in Done column */}
                          {stage === "Done" && (
                            <div className="kanban-board__card-field">
                              {taskState.archiveError && (
                                <p className="kanban-board__card-error">{taskState.archiveError}</p>
                              )}
                              <button
                                type="button"
                                onClick={() => archiveTask(task)}
                                className="kanban-board__card-btn kanban-board__card-btn--archive"
                                disabled={Boolean(taskState.archiveLoading)}
                              >
                                {taskState.archiveLoading ? "Archiving..." : "Archive Task"}
                              </button>
                              <p className="kanban-board__card-hint">
                                Archiving removes this task from your active views
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {!isExpanded && (
                        <p className="kanban-board__stage-hint" role="note">
                          Drag to move • Click + to manage
                        </p>
                      )}
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
