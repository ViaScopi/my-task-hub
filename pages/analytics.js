import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "./_app";
import { calculateStreak, getRecentActivity } from "../lib/streakCalculator";
import {
  getCompletionTrend,
  getCompletionsByDayOfWeek,
  getCompletionsBySource,
  getWeeklyStats,
  getTimeInvested,
} from "../lib/chartDataCalculator";

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/completed-tasks");
        if (response.ok) {
          const data = await response.json();
          setCompletedTasks(data);
        }
      } catch (error) {
        console.error("Error fetching completed tasks:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchData();
    }
  }, [user]);

  const streakData = useMemo(() => {
    return calculateStreak(completedTasks);
  }, [completedTasks]);

  const weeklyStats = useMemo(() => {
    return getWeeklyStats(completedTasks);
  }, [completedTasks]);

  const timeInvested = useMemo(() => {
    return getTimeInvested(completedTasks);
  }, [completedTasks]);

  const completionTrend = useMemo(() => {
    return getCompletionTrend(completedTasks, 30);
  }, [completedTasks]);

  const dayOfWeekData = useMemo(() => {
    return getCompletionsByDayOfWeek(completedTasks);
  }, [completedTasks]);

  const sourceData = useMemo(() => {
    return getCompletionsBySource(completedTasks);
  }, [completedTasks]);

  const maxDayCount = useMemo(() => {
    return Math.max(...completionTrend.map((d) => d.count), 1);
  }, [completionTrend]);

  const maxWeekdayCount = useMemo(() => {
    return Math.max(...dayOfWeekData.map((d) => d.count), 1);
  }, [dayOfWeekData]);

  if (authLoading || loading) {
    return (
      <main className="dashboard">
        <div className="dashboard__loading">
          <div className="task-state">
            <div className="task-state__spinner"></div>
            <h2 className="task-state__title">Loading analytics...</h2>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const totalCompleted = completedTasks.length;

  return (
    <main className="dashboard">
      <section className="dashboard__intro">
        <div>
          <span className="dashboard__eyebrow">Analytics</span>
          <h1>Your Progress & Insights</h1>
          <p>
            Comprehensive view of your productivity patterns and achievements.
          </p>
        </div>
        <div className="dashboard__actions">
          <Link href="/dashboard" className="button button--ghost button--small">
            Back to Dashboard
          </Link>
        </div>
      </section>

      {/* Summary Stats */}
      <div className="analytics-summary">
        <div className="analytics-summary__card">
          <div className="analytics-summary__icon">🎯</div>
          <div className="analytics-summary__content">
            <div className="analytics-summary__value">{totalCompleted}</div>
            <div className="analytics-summary__label">Tasks Completed</div>
          </div>
        </div>

        <div className="analytics-summary__card">
          <div className="analytics-summary__icon">🔥</div>
          <div className="analytics-summary__content">
            <div className="analytics-summary__value">{streakData.currentStreak}</div>
            <div className="analytics-summary__label">Current Streak</div>
          </div>
        </div>

        <div className="analytics-summary__card">
          <div className="analytics-summary__icon">🏆</div>
          <div className="analytics-summary__content">
            <div className="analytics-summary__value">{streakData.longestStreak}</div>
            <div className="analytics-summary__label">Longest Streak</div>
          </div>
        </div>

        <div className="analytics-summary__card">
          <div className="analytics-summary__icon">⏱️</div>
          <div className="analytics-summary__content">
            <div className="analytics-summary__value">{timeInvested.formattedTime}</div>
            <div className="analytics-summary__label">Time Invested</div>
          </div>
        </div>
      </div>

      {/* Weekly Comparison */}
      <div className="analytics-section">
        <h2 className="analytics-section__title">📊 Weekly Overview</h2>
        <div className="analytics-weekly">
          <div className="analytics-weekly__stat">
            <div className="analytics-weekly__label">This Week</div>
            <div className="analytics-weekly__value">{weeklyStats.thisWeek}</div>
          </div>
          <div className="analytics-weekly__arrow">
            {weeklyStats.trending === 'up' && '📈'}
            {weeklyStats.trending === 'down' && '📉'}
            {weeklyStats.trending === 'flat' && '➡️'}
          </div>
          <div className="analytics-weekly__stat">
            <div className="analytics-weekly__label">Last Week</div>
            <div className="analytics-weekly__value">{weeklyStats.lastWeek}</div>
          </div>
          <div className="analytics-weekly__change">
            <span className={`analytics-weekly__change-badge analytics-weekly__change-badge--${weeklyStats.trending}`}>
              {weeklyStats.change > 0 && '+'}
              {weeklyStats.change}%
            </span>
          </div>
        </div>
      </div>

      {/* 30-Day Trend */}
      <div className="analytics-section">
        <h2 className="analytics-section__title">📈 30-Day Completion Trend</h2>
        <div className="analytics-trend">
          {completionTrend.map((day, index) => {
            const heightPercent = maxDayCount > 0 ? (day.count / maxDayCount) * 100 : 0;
            const showLabel = index % 5 === 0 || index === completionTrend.length - 1;

            return (
              <div key={day.date} className="analytics-trend__bar-container">
                <div className="analytics-trend__bar-wrapper">
                  <div
                    className={`analytics-trend__bar ${day.isToday ? 'analytics-trend__bar--today' : ''}`}
                    style={{ height: `${heightPercent}%` }}
                    title={`${day.date}: ${day.count} task${day.count !== 1 ? 's' : ''}`}
                  />
                </div>
                {showLabel && (
                  <div className="analytics-trend__label">
                    {day.dayOfMonth}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day of Week Pattern */}
      <div className="analytics-section">
        <h2 className="analytics-section__title">📅 Most Productive Days</h2>
        <div className="analytics-weekdays">
          {dayOfWeekData.map((day) => {
            const heightPercent = maxWeekdayCount > 0 ? (day.count / maxWeekdayCount) * 100 : 0;

            return (
              <div key={day.day} className="analytics-weekdays__bar-container">
                <div className="analytics-weekdays__bar-wrapper">
                  <div
                    className="analytics-weekdays__bar"
                    style={{ height: `${heightPercent}%` }}
                    title={`${day.count} tasks completed on ${day.day}s`}
                  >
                    {day.count > 0 && (
                      <span className="analytics-weekdays__count">{day.count}</span>
                    )}
                  </div>
                </div>
                <div className="analytics-weekdays__label">{day.day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source Breakdown */}
      <div className="analytics-section">
        <h2 className="analytics-section__title">🎯 Completion by Source</h2>
        <div className="analytics-sources">
          {sourceData.length > 0 ? (
            sourceData.map((item) => (
              <div key={item.source} className="analytics-sources__item">
                <div className="analytics-sources__header">
                  <span className="analytics-sources__source">{item.source}</span>
                  <span className="analytics-sources__count">{item.count} tasks</span>
                </div>
                <div className="analytics-sources__bar-bg">
                  <div
                    className="analytics-sources__bar"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <div className="analytics-sources__percentage">{item.percentage}%</div>
              </div>
            ))
          ) : (
            <div className="analytics-sources__empty">
              No completed tasks yet. Start completing tasks to see your breakdown!
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
