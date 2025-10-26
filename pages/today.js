import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "./_app";
import TodayTaskList from "../components/TodayTaskList";

export default function TodayPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="dashboard">
        <div className="dashboard__loading">
          <div className="task-state">
            <div className="task-state__spinner"></div>
            <h2 className="task-state__title">Loading your day...</h2>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="restricted">
        <div className="restricted__card">
          <h1>Sign in to view today's tasks</h1>
          <p>
            You&apos;ll need to log in to see your daily focus.
            <Link href="/login"> Log in</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <section className="dashboard__intro">
        <div>
          <span className="dashboard__eyebrow">Focus Mode</span>
          <h1>Today's Tasks</h1>
          <p>
            Your focused list for today. These are the tasks you've committed to accomplishing.
            Stay on track and avoid overwhelm by keeping this list manageable.
          </p>
        </div>
        <div className="dashboard__actions">
          <Link href="/focus" className="button button--success button--small">
            🎯 Start Focus Mode
          </Link>
          <Link href="/dashboard" className="button button--ghost button--small">
            Back to Dashboard
          </Link>
          <Link href="/kanban" className="button button--ghost button--small">
            Kanban Board
          </Link>
        </div>
      </section>

      <div className="dashboard__columns">
        <section className="dashboard__tasks dashboard__tasks--full" aria-label="Today's tasks">
          <TodayTaskList />
        </section>
      </div>

      {/* Helpful Tips */}
      <section className="today-tips">
        <h3 className="today-tips__title">💡 Tips for a Productive Day</h3>
        <ul className="today-tips__list">
          <li>Aim for 4-6 hours of focused work per day</li>
          <li>Schedule your most important tasks for when you have the most energy</li>
          <li>Take breaks between tasks to maintain focus</li>
          <li>It's okay to move tasks to tomorrow if needed</li>
        </ul>
      </section>
    </main>
  );
}
