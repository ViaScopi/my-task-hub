import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_MAX_EVENTS = 10;
const DEFAULT_RANGE_DAYS = 30;

export function useCalendarEvents({ maxEvents = DEFAULT_MAX_EVENTS, rangeDays = DEFAULT_RANGE_DAYS } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEvents = useCallback(
    async ({ silent = false, signal } = {}) => {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      try {
        const params = new URLSearchParams();
        if (maxEvents) {
          params.set("maxResults", String(maxEvents));
        }
        if (rangeDays) {
          params.set("rangeDays", String(rangeDays));
        }

        const response = await fetch(`/api/google-calendar?${params.toString()}`, { signal });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const message = data?.error || "Failed to load Google Calendar events.";
          const error = new Error(message);
          error.status = response.status;
          throw error;
        }

        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }

        console.error("Error loading calendar events", err);
        setError(err.message || "Failed to load Google Calendar events.");
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [maxEvents, rangeDays]
  );

  useEffect(() => {
    const controller = new AbortController();

    loadEvents({ signal: controller.signal }).catch(() => {
      // errors handled in loadEvents
    });

    return () => {
      controller.abort();
    };
  }, [loadEvents]);

  const nextEvent = useMemo(() => {
    if (!events.length) {
      return null;
    }

    const now = Date.now();
    const upcoming = events
      .map((event) => {
        const start = event?.start ? new Date(event.start).getTime() : null;
        if (!start || Number.isNaN(start)) {
          return null;
        }

        return { ...event, startTimeMs: start };
      })
      .filter((event) => event && event.startTimeMs >= now)
      .sort((a, b) => a.startTimeMs - b.startTimeMs);

    return upcoming[0] || null;
  }, [events]);

  return {
    events,
    loading,
    error,
    refresh: loadEvents,
    nextEvent,
  };
}
