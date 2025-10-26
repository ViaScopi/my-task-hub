import { useState, useEffect, useMemo } from "react";
import { getCompletionTrend } from "../lib/chartDataCalculator";

export default function WeeklyChart() {
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);

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

    fetchData();
  }, []);

  const chartData = useMemo(() => {
    return getCompletionTrend(completedTasks, 7);
  }, [completedTasks]);

  const maxCount = useMemo(() => {
    return Math.max(...chartData.map((d) => d.count), 1);
  }, [chartData]);

  if (loading) {
    return (
      <div className="weekly-chart">
        <h3 className="weekly-chart__title">Last 7 Days</h3>
        <div className="weekly-chart__loading">Loading chart...</div>
      </div>
    );
  }

  return (
    <div className="weekly-chart">
      <h3 className="weekly-chart__title">📈 Last 7 Days</h3>
      <div className="weekly-chart__bars">
        {chartData.map((day) => {
          const heightPercent = maxCount > 0 ? (day.count / maxCount) * 100 : 0;

          return (
            <div key={day.date} className="weekly-chart__bar-container">
              <div className="weekly-chart__bar-wrapper">
                <div
                  className={`weekly-chart__bar ${
                    day.isToday ? "weekly-chart__bar--today" : ""
                  }`}
                  style={{ height: `${heightPercent}%` }}
                  title={`${day.count} task${day.count !== 1 ? 's' : ''} completed`}
                >
                  {day.count > 0 && (
                    <span className="weekly-chart__bar-count">{day.count}</span>
                  )}
                </div>
              </div>
              <div className="weekly-chart__label">
                <div className="weekly-chart__day">{day.dayOfWeek}</div>
                <div className="weekly-chart__date">{day.dayOfMonth}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
