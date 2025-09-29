import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  const { isSignedIn } = useUser();

  return (
    <main className="home">
      <section className="home__hero">
        <span className="home__eyebrow">Focus. Finish. Ship.</span>
        <h1 className="home__title">Your unified command center for every task</h1>
        <p className="home__description">
          My Task Hub keeps GitHub issues, Google Tasks, and Trello cards at your fingertips.
          Sign in to see the work waiting for you, then jump into the dashboard or Kanban board
          to prioritize the next win.
        </p>
        <div className="home__actions">
          {isSignedIn ? (
            <>
              <Link href="/dashboard" className="button button--primary">
                Go to dashboard
              </Link>
              <Link href="/kanban" className="button button--ghost">
                Open Kanban board
              </Link>
            </>
          ) : (
            <Link href="/login" className="button button--primary">
              Log in to get started
            </Link>
          )}
        </div>
      </section>
      <section className="home__callout">
        <h2>What&apos;s inside?</h2>
        <ul>
          <li>Real-time dashboard with the tasks assigned to you.</li>
          <li>Kanban board to shuffle tasks between stages and keep momentum.</li>
          <li>Filters so you only see the task sources that matter right now.</li>
        </ul>
      </section>
    </main>
  );
}
