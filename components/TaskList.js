import { useState, useEffect } from "react";

export default function TaskList() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch GitHub tasks
    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const res = await fetch("/api/github");
                const data = await res.json();
                setTasks(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchTasks();
    }, []);

    // Complete a task
    const completeTask = async (task) => {
        try {
            await fetch("/api/github", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    owner: task.repo.split("/")[0],
                    repo: task.repo.split("/")[1],
                    issue_number: task.issue_number,
                }),
            });

            // Remove from local list
            setTasks(tasks.filter(t => t.id !== task.id));
        } catch (err) {
            console.error("Error completing task:", err);
        }
    };

    if (loading) return <p>Loading tasks...</p>;
    if (!tasks.length) return <p>No GitHub tasks assigned 🎉</p>;

    return (
        <ul className="space-y-2">
            {tasks.map(task => (
                <li
                    key={task.id}
                    className="flex justify-between items-center border p-2 rounded shadow-sm"
                >
                    <div>
                        <a
                            href={task.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                        >
                            {task.title}
                        </a>
                        <p className="text-xs text-gray-500">{task.repo}</p>
                    </div>
                    <button
                        onClick={() => completeTask(task)}
                        className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                    >
                        ✓ Done
                    </button>
                </li>
            ))}
        </ul>
    );
}
