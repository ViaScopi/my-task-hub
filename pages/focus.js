import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "./_app";
import { useTasks } from "../hooks/useTasks";
import PomodoroTimer from "../components/PomodoroTimer";

export default function FocusPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { tasks, loading: tasksLoading } = useTasks();
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Get tasks for focus mode - prioritize Today tasks, then all others
  const focusTasks = tasks.filter((task) => {
    // Filter out completed/done tasks
    const status = task.status?.toLowerCase() || "";
    return status !== "done" && status !== "completed" && status !== "closed";
  });

  const todayTasks = focusTasks.filter((task) => task.isToday);
  const availableTasks = todayTasks.length > 0 ? todayTasks : focusTasks;

  const currentTask = availableTasks[currentTaskIndex];

  const handleNext = () => {
    if (currentTaskIndex < availableTasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
    } else {
      // Loop back to start
      setCurrentTaskIndex(0);
    }
  };

  const handlePrevious = () => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(currentTaskIndex - 1);
    } else {
      // Loop to end
      setCurrentTaskIndex(availableTasks.length - 1);
    }
  };

  const handleComplete = async () => {
    if (!currentTask) return;

    setIsCompleting(true);
    try {
      const response = await fetch("/api/completed-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: currentTask.source,
          original_id: currentTask.originalId,
          title: currentTask.title,
          description: currentTask.description || "",
          status: "completed",
          completed_at: new Date().toISOString(),
          url: currentTask.url,
          repo: currentTask.repo,
          metadata: {},
        }),
      });

      if (response.ok) {
        // Move to next task
        handleNext();
      } else {
        console.error("Failed to mark task as complete");
      }
    } catch (error) {
      console.error("Error completing task:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleExit = () => {
    router.push("/today");
  };

  if (authLoading || tasksLoading) {
    return (
      <main className="focus-mode">
        <div className="focus-mode__loading">
          <div className="task-state">
            <div className="task-state__spinner"></div>
            <h2 className="task-state__title">Loading focus mode...</h2>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (availableTasks.length === 0) {
    return (
      <main className="focus-mode">
        <div className="focus-mode__empty">
          <div className="focus-mode__empty-icon">🎯</div>
          <h1 className="focus-mode__empty-title">No Tasks Available</h1>
          <p className="focus-mode__empty-message">
            {todayTasks.length === 0
              ? "Add some tasks to your Today list to start focusing."
              : "All tasks are complete! Great work."}
          </p>
          <div className="focus-mode__empty-actions">
            <button onClick={() => router.push("/today")} className="button button--primary">
              Go to Today View
            </button>
            <button onClick={() => router.push("/dashboard")} className="button button--ghost">
              View Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  const sourceBadgeClass =
    currentTask.source === "GitHub"
      ? "source-badge--github"
      : currentTask.source === "Google Tasks"
      ? "source-badge--google"
      : currentTask.source === "Trello"
      ? "source-badge--trello"
      : "source-badge--other";

  return (
    <main className="focus-mode">
      <div className="focus-mode__header">
        <div className="focus-mode__progress">
          <span className="focus-mode__progress-text">
            Task {currentTaskIndex + 1} of {availableTasks.length}
          </span>
          {todayTasks.length > 0 && (
            <span className="focus-mode__badge">Today's Focus</span>
          )}
        </div>
        <button onClick={handleExit} className="focus-mode__exit" aria-label="Exit focus mode">
          ✕
        </button>
      </div>

      <div className="focus-mode__content">
        <div className="focus-mode__task">
          <div className="focus-mode__task-meta">
            <span className={`source-badge ${sourceBadgeClass}`}>
              {currentTask.source}
            </span>
            {currentTask.priority && (
              <span className={`priority-badge priority-badge--${currentTask.priority}`}>
                {currentTask.priority}
              </span>
            )}
            {currentTask.timeEstimate && (
              <span className="focus-mode__estimate">
                ⏱ {currentTask.timeEstimate >= 60
                  ? `${Math.floor(currentTask.timeEstimate / 60)}h ${currentTask.timeEstimate % 60 > 0 ? `${currentTask.timeEstimate % 60}m` : ""}`
                  : `${currentTask.timeEstimate}m`}
              </span>
            )}
          </div>

          <h1 className="focus-mode__task-title">{currentTask.title}</h1>

          {currentTask.description && (
            <div className="focus-mode__task-description">
              <p>{currentTask.description}</p>
            </div>
          )}

          {currentTask.repo && (
            <div className="focus-mode__task-detail">
              <strong>Repository:</strong> {currentTask.repo}
            </div>
          )}

          {currentTask.url && (
            <div className="focus-mode__task-detail">
              <a
                href={currentTask.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-mode__task-link"
              >
                View in {currentTask.source} →
              </a>
            </div>
          )}
        </div>

        <PomodoroTimer onSessionComplete={() => {
          // Optional: Auto-advance to next task after work session
          // Uncomment if desired: handleNext();
        }} />

        <div className="focus-mode__actions">
          <button
            onClick={handlePrevious}
            className="button button--ghost button--large"
            disabled={availableTasks.length <= 1}
          >
            ← Previous
          </button>
          <button
            onClick={handleComplete}
            className="button button--success button--large"
            disabled={isCompleting}
          >
            {isCompleting ? "Completing..." : "✓ Complete"}
          </button>
          <button
            onClick={handleNext}
            className="button button--ghost button--large"
            disabled={availableTasks.length <= 1}
          >
            Next →
          </button>
        </div>

        <div className="focus-mode__hint">
          <p>💡 Focus on one task at a time. Take breaks between tasks to maintain energy.</p>
        </div>
      </div>
    </main>
  );
}
