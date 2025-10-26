import { useState, useEffect, useMemo } from "react";
import { getCompletionsBySource } from "../lib/chartDataCalculator";

export default function SourceBreakdown() {
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

  const sourceData = useMemo(() => {
    return getCompletionsBySource(completedTasks);
  }, [completedTasks]);

  if (loading) {
    return (
      <div className="source-breakdown">
        <h3 className="source-breakdown__title">By Source</h3>
        <div className="source-breakdown__loading">Loading breakdown...</div>
      </div>
    );
  }

  if (sourceData.length === 0) {
    return (
      <div className="source-breakdown">
        <h3 className="source-breakdown__title">🎯 By Source</h3>
        <div className="source-breakdown__empty">
          No completed tasks yet. Start completing tasks to see your breakdown!
        </div>
      </div>
    );
  }

  const getSourceColor = (source) => {
    const colors = {
      GitHub: "#6366f1",
      "Google Tasks": "#10b981",
      Trello: "#0284c7",
      Fellow: "#f59e0b",
    };
    return colors[source] || "#64748b";
  };

  return (
    <div className="source-breakdown">
      <h3 className="source-breakdown__title">🎯 By Source</h3>
      <div className="source-breakdown__list">
        {sourceData.map((item) => (
          <div key={item.source} className="source-breakdown__item">
            <div className="source-breakdown__item-header">
              <span className="source-breakdown__source">{item.source}</span>
              <span className="source-breakdown__count">{item.count}</span>
            </div>
            <div className="source-breakdown__bar-bg">
              <div
                className="source-breakdown__bar"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: getSourceColor(item.source),
                }}
              />
            </div>
            <div className="source-breakdown__percentage">{item.percentage}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
