/**
 * Calculate completion data for the last N days
 * @param {Array} completedTasks - Array of completed task objects
 * @param {number} days - Number of days to include (default 30)
 * @returns {Array} Array of day objects with date and count
 */
export function getCompletionTrend(completedTasks, days = 30) {
  const today = new Date();
  const trendData = [];

  // Create map of completion dates
  const completionMap = {};
  completedTasks.forEach((task) => {
    if (task.completed_at) {
      const date = new Date(task.completed_at);
      const dateStr = date.toISOString().split('T')[0];
      completionMap[dateStr] = (completionMap[dateStr] || 0) + 1;
    }
  });

  // Build array for last N days
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    trendData.push({
      date: dateStr,
      count: completionMap[dateStr] || 0,
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayOfMonth: date.getDate(),
      isToday: i === 0,
    });
  }

  return trendData;
}

/**
 * Calculate completions by day of week
 * @param {Array} completedTasks - Array of completed task objects
 * @returns {Array} Array of weekday objects with counts
 */
export function getCompletionsByDayOfWeek(completedTasks) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = [0, 0, 0, 0, 0, 0, 0];

  completedTasks.forEach((task) => {
    if (task.completed_at) {
      const date = new Date(task.completed_at);
      const dayIndex = date.getDay();
      counts[dayIndex]++;
    }
  });

  return days.map((day, index) => ({
    day,
    count: counts[index],
    percentage: completedTasks.length > 0
      ? Math.round((counts[index] / completedTasks.length) * 100)
      : 0,
  }));
}

/**
 * Calculate completions by source
 * @param {Array} completedTasks - Array of completed task objects
 * @returns {Array} Array of source objects with counts
 */
export function getCompletionsBySource(completedTasks) {
  const sourceMap = {};

  completedTasks.forEach((task) => {
    const source = task.source || 'Other';
    sourceMap[source] = (sourceMap[source] || 0) + 1;
  });

  const sources = Object.keys(sourceMap).map((source) => ({
    source,
    count: sourceMap[source],
    percentage: Math.round((sourceMap[source] / completedTasks.length) * 100),
  }));

  // Sort by count descending
  sources.sort((a, b) => b.count - a.count);

  return sources;
}

/**
 * Calculate weekly completion stats
 * @param {Array} completedTasks - Array of completed task objects
 * @returns {Object} Weekly stats
 */
export function getWeeklyStats(completedTasks) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  let thisWeek = 0;
  let lastWeek = 0;

  completedTasks.forEach((task) => {
    if (task.completed_at) {
      const date = new Date(task.completed_at);
      if (date >= weekStart) {
        thisWeek++;
      } else if (date >= lastWeekStart && date < weekStart) {
        lastWeek++;
      }
    }
  });

  const change = lastWeek > 0
    ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
    : thisWeek > 0 ? 100 : 0;

  return {
    thisWeek,
    lastWeek,
    change,
    trending: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  };
}

/**
 * Calculate total time invested (from time estimates)
 * @param {Array} completedTasks - Array of completed task objects with time_estimate
 * @returns {Object} Time stats
 */
export function getTimeInvested(completedTasks) {
  let totalMinutes = 0;
  let tasksWithEstimates = 0;

  completedTasks.forEach((task) => {
    if (task.time_estimate) {
      totalMinutes += task.time_estimate;
      tasksWithEstimates++;
    }
  });

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    totalMinutes,
    hours,
    minutes,
    tasksWithEstimates,
    tasksWithoutEstimates: completedTasks.length - tasksWithEstimates,
    formattedTime: hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}m`,
  };
}
