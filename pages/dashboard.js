import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useMemo } from "react";
import TaskList from "../components/TaskList";

export default function DashboardPage() {
  const { user } = useUser();

  const greetingName = useMemo(() => {
    if (!user) {
      return "there";
    }

    return (
      user.fullName ||
      user.firstName ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "there"
    );
  }, [user]);

  return (
    <>
      <SignedOut>
        <main className="restricted">
          <div className="restricted__card">
            <h1>Sign in to view your dashboard</h1>
            <p>
              You&apos;ll need to log in to see the tasks assigned to you.
              <Link href="/login"> Log in</Link>
            </p>
          </div>
        </main>
      </SignedOut>
      <SignedIn>
        <main className="dashboard">
          <section className="dashboard__intro">
            <h1>Welcome back, {greetingName}!</h1>
            <p>
              Here&apos;s a quick rundown of everything assigned to you across GitHub, Google Tasks, and
              Trello.
            </p>
          </section>
          <section className="dashboard__tasks" aria-label="Task rundown">
            <TaskList />
          </section>
        </main>
      </SignedIn>
    </>
  );
}
