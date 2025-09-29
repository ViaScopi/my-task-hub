const CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const MISSING_CREDENTIALS_ERROR = "MISSING_GOOGLE_CALENDAR_CREDENTIALS";

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

function getConfiguredCalendars() {
  const raw = process.env.GOOGLE_CALENDAR_IDS;

  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => parseCalendarConfig(value))
    .filter(Boolean);
}

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    const error = new Error(
      "Google Calendar integration is not configured. Please provide GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables."
    );
    error.code = MISSING_CREDENTIALS_ERROR;
    throw error;
  }

  return { clientId, clientSecret, refreshToken };
}

async function getAccessToken() {
  const { clientId, clientSecret, refreshToken } = getOAuthConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.error_description || data?.error || "Failed to refresh Google access token.";
    throw new Error(message);
  }

  const data = await response.json();
  const accessToken = data?.access_token;

  if (!accessToken) {
    throw new Error("Google access token response did not include an access_token.");
  }

  return accessToken;
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

  const calendars = getConfiguredCalendars();
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

  try {
    const accessToken = await getAccessToken();
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
    if (error.code === MISSING_CREDENTIALS_ERROR) {
      return res.status(501).json({ error: error.message, code: error.code });
    }

    console.error("Error loading Google Calendar events", error);
    return res.status(500).json({ error: error.message || "Failed to load Google Calendar events." });
  }
}
