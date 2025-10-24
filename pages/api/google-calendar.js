import { createClient } from "../../lib/supabase/api";
import { getValidAccessToken } from "../../lib/google-auth";

const CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";

function parseCalendarConfig(value) {
  const [idPart, ...labelParts] = value.split(":");
  const id = idPart?.trim();
  const label = labelParts.join(":").trim();

  if (!id) {
    return null;
  }

  return {
    id,
    label: label || id,
  };
}

async function getConfiguredCalendars(supabase, userId) {
  // Get user preferences for which calendars to show
  const { data, error } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .single();

  // If specific calendars are configured, use those
  if (!error && data && data.preferences && data.preferences.google_calendar_ids) {
    const calendarConfigs = data.preferences.google_calendar_ids;

    if (typeof calendarConfigs === 'string') {
      return calendarConfigs
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => parseCalendarConfig(value))
        .filter(Boolean);
    } else if (Array.isArray(calendarConfigs)) {
      return calendarConfigs
        .map((value) => parseCalendarConfig(value))
        .filter(Boolean);
    }
  }

  // Default: use primary calendar if no specific calendars configured
  return [{ id: 'primary', label: 'Primary Calendar' }];
}

function mapEventToResponse(event, calendar) {
  if (!event || event.status === "cancelled") {
    return null;
  }

  const startValue = event.start?.dateTime || event.start?.date || null;
  const endValue = event.end?.dateTime || event.end?.date || null;
  const conferenceEntryPoint = Array.isArray(event.conferenceData?.entryPoints)
    ? event.conferenceData.entryPoints.find((entry) => entry.entryPointType === "video")
    : null;

  return {
    id: `${calendar.id}-${event.id}`,
    eventId: event.id,
    calendarId: calendar.id,
    calendarName: calendar.label,
    title: event.summary || "Untitled event",
    description: event.description || "",
    start: startValue,
    end: endValue,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
    location: event.location || null,
    meetingUrl: conferenceEntryPoint?.uri || event.hangoutLink || null,
    htmlLink: event.htmlLink || null,
    attendees: Array.isArray(event.attendees)
      ? event.attendees.map((attendee) => ({
          email: attendee.email,
          displayName: attendee.displayName || attendee.email || null,
          responseStatus: attendee.responseStatus || null,
        }))
      : [],
  };
}

async function fetchEventsForCalendar(accessToken, calendar, { timeMin, timeMax, maxResults }) {
  const events = [];
  let pageToken;

  do {
    const url = new URL(`${CALENDAR_BASE_URL}/calendars/${encodeURIComponent(calendar.id)}/events`);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", timeMin);
    if (timeMax) {
      url.searchParams.set("timeMax", timeMax);
    }
    if (maxResults) {
      url.searchParams.set("maxResults", String(maxResults));
    }
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = data?.error?.message || `Failed to retrieve events for Google Calendar ${calendar.id}.`;
      throw new Error(message);
    }

    const data = await response.json();
    if (Array.isArray(data.items)) {
      events.push(
        ...data.items
          .map((event) => mapEventToResponse(event, calendar))
          .filter(Boolean)
      );
    }
    pageToken = data.nextPageToken;

    if (maxResults && events.length >= maxResults) {
      break;
    }
  } while (pageToken);

  return events;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed." });
  }

  const supabase = createClient(req, res);

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const calendars = await getConfiguredCalendars(supabase, user.id);

    if (!calendars.length) {
      return res.status(200).json([]);
    }

    const maxResults = Number.parseInt(req.query.maxResults, 10);
    const safeMaxResults = Number.isNaN(maxResults) || maxResults <= 0 ? undefined : maxResults;
    const rangeDays = Number.parseInt(req.query.rangeDays, 10);
    const effectiveRangeDays = Number.isNaN(rangeDays) || rangeDays <= 0 ? 30 : rangeDays;

    const now = new Date();
    const timeMin = req.query.timeMin || now.toISOString();
    const timeMax = req.query.timeMax || new Date(now.getTime() + effectiveRangeDays * 24 * 60 * 60 * 1000).toISOString();

    const accessToken = await getValidAccessToken(supabase, user.id);
    const eventsByCalendar = await Promise.all(
      calendars.map((calendar) => fetchEventsForCalendar(accessToken, calendar, { timeMin, timeMax, maxResults: safeMaxResults }))
    );

    const events = eventsByCalendar.flat();
    events.sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.start ? new Date(b.start).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });

    if (safeMaxResults) {
      return res.status(200).json(events.slice(0, safeMaxResults));
    }

    return res.status(200).json(events);
  } catch (error) {
    console.error("Error loading Google Calendar events", error);
    return res.status(500).json({ error: error.message || "Failed to load Google Calendar events." });
  }
}
