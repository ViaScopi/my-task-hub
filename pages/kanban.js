import Link from "next/link";
import KanbanBoard from "../components/KanbanBoard";
import { useAuth } from "../context/AuthContext";

export default function KanbanPage() {
  const { user } = useAuth();

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
