import { useState, useEffect } from "react";
import { calculateStreak, getRecentActivity, getStreakMilestone } from "../lib/streakCalculator";

export default function StreakDisplay() {
  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchStreakData() {
      try {
        const response = await fetch("/api/completed-tasks");
        if (!response.ok) {
          throw new Error("Failed to fetch completed tasks");
        }

        const tasks = await response.json();
        const streak = calculateStreak(tasks);
        const recentActivity = getRecentActivity(streak.completionDates, 7);
        const milestone = getStreakMilestone(streak.currentStreak);

        setStreakData({
          ...streak,
          recentActivity,
          milestone,
        });
      } catch (err) {
        console.error("Error fetching streak data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchStreakData();
  }, []);

  if (loading) {
    return (
      <div className="streak-display">
        <div className="streak-display__loading">Loading streak...</div>
      </div>
    );
  }

  if (error) {
    return null; // Fail silently - streaks are not critical
  }

  if (!streakData) {
    return null;
  }

  const { currentStreak, longestStreak, isActiveToday, recentActivity, milestone } = streakData;

  return (
    <div className="streak-display">
      {milestone && currentStreak > 0 && (
        <div className="streak-display__milestone">{milestone}</div>
      )}

      <div className="streak-display__stats">
        <div className="streak-display__stat streak-display__stat--primary">
          <div className="streak-display__stat-icon">
            {currentStreak > 0 ? "🔥" : "💤"}
          </div>
          <div className="streak-display__stat-content">
            <div className="streak-display__stat-value">{currentStreak}</div>
            <div className="streak-display__stat-label">
              {currentStreak === 1 ? "Day Streak" : "Day Streak"}
            </div>
            {!isActiveToday && currentStreak > 0 && (
              <div className="streak-display__stat-hint">
                Complete a task today to continue!
              </div>
            )}
            {currentStreak === 0 && (
              <div className="streak-display__stat-hint">
                Complete a task to start your streak!
              </div>
            )}
          </div>
        </div>

        <div className="streak-display__stat">
          <div className="streak-display__stat-icon">🏆</div>
          <div className="streak-display__stat-content">
            <div className="streak-display__stat-value">{longestStreak}</div>
            <div className="streak-display__stat-label">Best Streak</div>
          </div>
        </div>
      </div>

      <div className="streak-display__calendar">
        <div className="streak-display__calendar-title">Last 7 Days</div>
        <div className="streak-display__calendar-grid">
          {recentActivity.map((day) => (
            <div key={day.date} className="streak-display__calendar-day">
              <div className="streak-display__calendar-day-name">
                {day.dayName}
              </div>
              <div
                className={`streak-display__calendar-day-dot ${
                  day.hasActivity
                    ? "streak-display__calendar-day-dot--active"
                    : ""
                } ${
                  day.isToday
                    ? "streak-display__calendar-day-dot--today"
                    : ""
                }`}
                title={day.hasActivity ? "Task completed" : "No activity"}
              >
                {day.hasActivity ? "✓" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
