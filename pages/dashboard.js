import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "./_app";
import EventList from "../components/EventList";
import TaskList from "../components/TaskList";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const greetingName = useMemo(() => {
    if (!user) {
      return "there";
    }

    // Use user metadata if available
    const metadata = user.user_metadata || {};
    return (
      metadata.full_name ||
      metadata.name ||
      user.email?.split("@")[0] ||
      "there"
    );
  }, [user]);

  if (loading) {
    return (
      <main className="dashboard">
        <div className="dashboard__loading">
          <div className="task-state">
            <div className="task-state__spinner"></div>
            <h2 className="task-state__title">Loading your dashboard...</h2>
            <p className="task-state__message">Please wait while we gather your tasks.</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="restricted">
        <div className="restricted__card">
          <h1>Sign in to view your dashboard</h1>
          <p>
            You&apos;ll need to log in to see the tasks assigned to you.
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
          <span className="dashboard__eyebrow">Your Dashboard</span>
          <h1>Welcome back, {greetingName}!</h1>
          <p>
            Here&apos;s a quick rundown of everything assigned to you across GitHub, Google Tasks, and
            Trello.
          </p>
        </div>
        <div className="dashboard__actions">
          <Link href="/settings" className="button button--ghost button--small">
            Manage Integrations
          </Link>
          <Link href="/kanban" className="button button--primary button--small">
            Kanban Board
          </Link>
        </div>
      </section>
      <div className="dashboard__columns">
        <section className="dashboard__tasks" aria-label="Task rundown">
          <TaskList />
        </section>
        <section className="dashboard__events" aria-label="Calendar rundown">
          <EventList />
        </section>
      </div>
    </main>
  );
}
