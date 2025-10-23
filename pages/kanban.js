import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "./_app";
import KanbanBoard from "../components/KanbanBoard";

export default function KanbanPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="kanban-page">
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="restricted">
        <div className="restricted__card">
          <h1>Sign in to access the Kanban board</h1>
          <p>
            Manage your work visually by logging in first.
            <Link href="/login"> Log in</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="kanban-page">
      <header className="kanban-page__intro">
        <h1>Kanban board</h1>
        <p>
          Drag and drop cards between stages to keep work moving, and filter by task source to
          focus on the right work.
        </p>
      </header>
      <KanbanBoard />
    </main>
  );
}
