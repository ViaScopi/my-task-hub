import TaskList from "../components/TaskList";

export default function Home() {
  return (
    <main className="app">
      <div className="layout">
        <header className="hero">
          <span className="hero__eyebrow">Focus. Finish. Ship.</span>
          <h1>My Task Hub</h1>
          <p>
            A polished cockpit for your assigned GitHub issues, Google Tasks, and Trello cards.
            Scan what needs attention, reshuffle pipelines, add a quick update, and close things
            out without jumping between tabs.
          </p>
        </header>
        <section className="task-section">
          <TaskList />
        </section>
      </div>
    </main>
  );
}
