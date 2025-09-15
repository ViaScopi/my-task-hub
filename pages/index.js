import TaskList from "../components/TaskList";

export default function Home() {
  return (
    <main className="app">
      <div className="layout">
        <header className="hero">
          <span className="hero__eyebrow">Focus. Finish. Ship.</span>
          <h1>My Task Hub</h1>
          <p>
            A polished cockpit for your assigned GitHub issues. Scan what needs
            attention, add a quick update, and close things out without jumping
            between tabs.
          </p>
        </header>
        <section className="task-section">
          <TaskList />
        </section>
      </div>
    </main>
  );
}
