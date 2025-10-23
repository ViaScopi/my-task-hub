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
        <p>Loading...</p>
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
        <h1>Welcome back, {greetingName}!</h1>
        <p>
          Here&apos;s a quick rundown of everything assigned to you across GitHub, Google Tasks, and
          Trello.
        </p>
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
