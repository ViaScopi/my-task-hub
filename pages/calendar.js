import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "./_app";

const embedUrl = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_URL;

export default function CalendarPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="calendar-page">
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="restricted">
        <div className="restricted__card">
          <h1>Sign in to view the calendar</h1>
          <p>
            You&apos;ll need to log in to view the team&apos;s schedule.
            <Link href="/login"> Log in</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="calendar-page">
      <header className="calendar-page__header">
        <p className="calendar-page__eyebrow">Calendar</p>
        <h1>Team schedule</h1>
        <p>Review the complete Google Calendar for upcoming meetings, deadlines, and events.</p>
      </header>

      <section className="calendar-page__embed" aria-label="Embedded Google Calendar">
        {embedUrl ? (
          <iframe
            title="Google Calendar"
            src={embedUrl}
            className="calendar-page__iframe"
            frameBorder="0"
            scrolling="no"
          />
        ) : (
          <div className="calendar-page__placeholder">
            <p>
              Add a public embed URL to <code>NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_URL</code> to display the calendar here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
