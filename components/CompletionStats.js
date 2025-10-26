import { useState, useEffect, useMemo } from "react";

export default function CompletionStats() {
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCompletedTasks() {
      try {
        const response = await fetch("/api/completed-tasks");
        if (!response.ok) {
          throw new Error("Failed to fetch completed tasks");
        }
        const data = await response.json();
        setCompletedTasks(data || []);
      } catch (err) {
        console.error("Error fetching completed tasks:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCompletedTasks();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Calculate start of this week (Monday)
    const currentDay = now.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Sunday is 0, so we want 6 days back
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - daysFromMonday);

    const completedToday = completedTasks.filter((task) => {
      const completedDate = new Date(task.completed_at);
      return completedDate >= todayStart;
    });

    const completedThisWeek = completedTasks.filter((task) => {
      const completedDate = new Date(task.completed_at);
      return completedDate >= weekStart;
    });

    return {
      today: completedToday.length,
      thisWeek: completedThisWeek.length,
      total: completedTasks.length,
    };
  }, [completedTasks]);

  if (loading) {
    return (
      <div className="completion-stats">
        <div className="completion-stats__loading">Loading stats...</div>
      </div>
    );
  }

  if (error) {
    return null; // Silently fail - stats are not critical
  }

  return (
    <div className="completion-stats">
      <div className="completion-stats__item">
        <div className="completion-stats__icon">✓</div>
        <div className="completion-stats__content">
          <div className="completion-stats__value">{stats.today}</div>
          <div className="completion-stats__label">Completed Today</div>
        </div>
      </div>

      <div className="completion-stats__item">
        <div className="completion-stats__icon">📊</div>
        <div className="completion-stats__content">
          <div className="completion-stats__value">{stats.thisWeek}</div>
          <div className="completion-stats__label">This Week</div>
        </div>
      </div>

      <div className="completion-stats__item">
        <div className="completion-stats__icon">🏆</div>
        <div className="completion-stats__content">
          <div className="completion-stats__value">{stats.total}</div>
          <div className="completion-stats__label">All Time</div>
        </div>
      </div>
    </div>
  );
}
