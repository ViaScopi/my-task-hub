/**
 * Calculate streak information from completed tasks
 * @param {Array} completedTasks - Array of completed task objects with completed_at dates
 * @returns {Object} Streak data including current streak, longest streak, and recent activity
 */
export function calculateStreak(completedTasks) {
  if (!completedTasks || completedTasks.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastCompletionDate: null,
      completionDates: [],
      isActiveToday: false,
    };
  }

  // Get unique completion dates (just the date part, no time)
  const completionDates = new Set();

  completedTasks.forEach((task) => {
    if (task.completed_at) {
      const date = new Date(task.completed_at);
      // Convert to local date string (YYYY-MM-DD)
      const dateStr = date.toISOString().split('T')[0];
      completionDates.add(dateStr);
    }
  });

  // Convert to sorted array (newest first)
  const sortedDates = Array.from(completionDates).sort((a, b) =>
    new Date(b) - new Date(a)
  );

  if (sortedDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastCompletionDate: null,
      completionDates: [],
      isActiveToday: false,
    };
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const isActiveToday = sortedDates[0] === todayStr;
  const lastCompletionDate = sortedDates[0];

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = isActiveToday ? today : yesterday;

  for (let i = 0; i < sortedDates.length; i++) {
    const checkDateStr = checkDate.toISOString().split('T')[0];

    if (sortedDates[i] === checkDateStr) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Check if we skipped a day
      const expectedDateStr = checkDate.toISOString().split('T')[0];
      if (sortedDates[i] !== expectedDateStr) {
        break; // Streak is broken
      }
    }
  }

  // If last completion was not today or yesterday, current streak is 0
  if (!isActiveToday && sortedDates[0] !== yesterdayStr) {
    currentStreak = 0;
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 0; i < sortedDates.length - 1; i++) {
    const currentDate = new Date(sortedDates[i]);
    const nextDate = new Date(sortedDates[i + 1]);

    // Calculate difference in days
    const diffTime = currentDate - nextDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day
      tempStreak++;
    } else {
      // Streak broken
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
    lastCompletionDate,
    completionDates: sortedDates,
    isActiveToday,
  };
}

/**
 * Get a visual representation of the last N days of activity
 * @param {Array} completionDates - Sorted array of completion date strings
 * @param {number} days - Number of days to show (default 7)
 * @returns {Array} Array of day objects with date and hasActivity
 */
export function getRecentActivity(completionDates, days = 7) {
  const activity = [];
  const today = new Date();
  const completionSet = new Set(completionDates);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    activity.push({
      date: dateStr,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      hasActivity: completionSet.has(dateStr),
      isToday: i === 0,
    });
  }

  return activity;
}

/**
 * Get streak milestone message
 * @param {number} streak - Current streak count
 * @returns {string|null} Milestone message or null
 */
export function getStreakMilestone(streak) {
  const milestones = {
    1: "🎉 You started a streak!",
    3: "🔥 3 days! Building momentum!",
    7: "⭐ One week streak! Amazing!",
    14: "💪 Two weeks! You're unstoppable!",
    30: "🏆 30 days! Legendary streak!",
    50: "🌟 50 days! Incredible dedication!",
    100: "👑 100 days! You're a productivity master!",
  };

  return milestones[streak] || null;
}
