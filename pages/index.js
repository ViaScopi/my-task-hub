import TaskList from "../components/TaskList";

export default function Home() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8">
            <h1 className="text-2xl font-bold mb-6">My Task Hub</h1>
            <TaskList />
        </main>
    );
}
