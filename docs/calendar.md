# Google Calendar integration

This project can display upcoming events pulled from Google Calendar and show the full calendar embed. To enable it, configure the following environment variables:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`: OAuth 2.0 credentials with access to the calendars you want to surface. These are shared with the Google Tasks integration.
- `GOOGLE_CALENDAR_IDS`: A comma-separated list of calendar IDs to aggregate. Each entry may optionally include a label by appending `:Friendly name` (for example `team@example.com:Team Calendar`).
- `NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_URL`: A public embed URL generated from Google Calendar (Settings → Integrate calendar).

## API endpoint

`GET /api/google-calendar`

Retrieves upcoming events and merges them into a single sorted list. The following query parameters are supported:

- `maxResults`: Limits the number of events returned (default: 10).
- `rangeDays`: Number of days ahead to search for events (default: 30).
- `timeMin` / `timeMax`: Override the time window manually.

The response consists of simplified event objects including the title, start and end timestamps, description, calendar name, meeting URL, and attendees.

## Dashboard widget

The dashboard consumes the API through the `useCalendarEvents` hook and renders the `EventList` component. It highlights the countdown to the next event and provides quick links to join video calls or open the event in Google Calendar.

## Calendar page

The `/calendar` page shows the embedded calendar inside the app. If the embed URL is not provided, a friendly message explains how to configure it.
