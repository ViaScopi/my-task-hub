import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "./_app";
import ArchivedTaskList from "../components/ArchivedTaskList";

export default function ArchivedPage() {
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
            <h2 className="task-state__title">Loading archived tasks...</h2>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="restricted">
        <div className="restricted__card">
          <h1>Sign in to view archived tasks</h1>
          <p>
            You&apos;ll need to log in to see your archived tasks.
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
          <span className="dashboard__eyebrow">Archive</span>
          <h1>Archived Tasks</h1>
          <p>
            View all tasks you've completed and archived from your dashboard or Kanban board.
          </p>
        </div>
        <div className="dashboard__actions">
          <Link href="/dashboard" className="button button--ghost button--small">
            Back to Dashboard
          </Link>
          <Link href="/kanban" className="button button--primary button--small">
            Kanban Board
          </Link>
        </div>
      </section>
      <div className="dashboard__columns">
        <section className="dashboard__tasks dashboard__tasks--full" aria-label="Archived tasks">
          <ArchivedTaskList />
        </section>
      </div>
    </main>
  );
}
