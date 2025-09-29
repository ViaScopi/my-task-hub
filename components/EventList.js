import Link from "next/link";
import { useMemo } from "react";
import { useCalendarEvents } from "../hooks/useCalendarEvents";

function formatEventDate(value, { allDay } = {}) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const options = allDay
    ? { month: "short", day: "numeric", year: "numeric" }
    : {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      };

  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatRelativeTime(target) {
  if (!target) {
    return "";
  }

  const now = Date.now();
  const diffMs = target.getTime() - now;

  if (Number.isNaN(diffMs)) {
    return "";
  }

  if (diffMs <= 0) {
    return "In progress";
  }

  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) {
    return `In ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;

  if (diffHours < 24) {
    return remainingMinutes ? `In ${diffHours}h ${remainingMinutes}m` : `In ${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;

  if (diffDays < 7) {
    if (!remainingHours) {
      return `In ${diffDays} day${diffDays === 1 ? "" : "s"}`;
    }
    return `In ${diffDays}d ${remainingHours}h`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  return `In ${diffWeeks} week${diffWeeks === 1 ? "" : "s"}`;
}

function EventItem({ event }) {
  const startDate = event?.start ? new Date(event.start) : null;
  const countdown = startDate ? formatRelativeTime(startDate) : "";
  const dateLabel = formatEventDate(event.start, { allDay: event.allDay });
  const locationLabel = event.location || event.meetingUrl || "";

  return (
    <li className="event-item">
      <div className="event-item__header">
        <p className="event-item__calendar" aria-label="Calendar name">
          {event.calendarName}
        </p>
        {countdown && <span className="event-item__countdown">{countdown}</span>}
      </div>
      <h3 className="event-item__title">{event.title}</h3>
      <dl className="event-item__meta">
        {dateLabel && (
          <div>
            <dt>Date</dt>
            <dd>{dateLabel}</dd>
          </div>
        )}
        {locationLabel && (
          <div>
            <dt>{event.meetingUrl ? "Join" : "Location"}</dt>
            <dd>
              {event.meetingUrl ? (
                <a
                  href={event.meetingUrl}
                  className="event-item__link"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Join meeting
                </a>
              ) : (
                locationLabel
              )}
            </dd>
          </div>
        )}
      </dl>
      {event.description && <p className="event-item__description">{event.description}</p>}
      {event.htmlLink && (
        <Link
          href={event.htmlLink}
          className="event-item__external"
          target="_blank"
          rel="noreferrer noopener"
        >
          View in Google Calendar
        </Link>
      )}
    </li>
  );
}

export default function EventList() {
  const { events, loading, error, nextEvent } = useCalendarEvents({ maxEvents: 8, rangeDays: 21 });

  const eventItems = useMemo(() => events.slice(0, 8), [events]);
  const nextEventCountdown = useMemo(() => {
    if (!nextEvent?.start) {
      return "";
    }
    return formatRelativeTime(new Date(nextEvent.start));
  }, [nextEvent]);

  return (
    <section className="event-card" aria-label="Upcoming events">
      <div className="event-card__header">
        <div>
          <p className="event-card__eyebrow">Calendar</p>
          <h2 className="event-card__title">Upcoming meetings</h2>
        </div>
        {nextEvent && nextEventCountdown && (
          <div className="event-card__next">
            <p className="event-card__next-label">Next event</p>
            <p className="event-card__next-value">{nextEventCountdown}</p>
          </div>
        )}
      </div>

      {loading && <p className="event-card__status">Loading calendar events…</p>}
      {error && !loading && <p className="event-card__status event-card__status--error">{error}</p>}
      {!loading && !error && !eventItems.length && (
        <p className="event-card__status">No upcoming events found.</p>
      )}

      {!loading && !error && eventItems.length > 0 && (
        <ol className="event-card__list">
          {eventItems.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </ol>
      )}

      <div className="event-card__footer">
        <Link href="/calendar" className="event-card__footer-link">
          View full calendar
        </Link>
      </div>
    </section>
  );
}
