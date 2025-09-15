import { useState, useEffect } from "react";

export default function TaskList() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTaskId, setActiveTaskId] = useState(null);
    const [completionNote, setCompletionNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

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

    const startCompletion = (taskId) => {
        setActiveTaskId(taskId);
        setCompletionNote("");
        setError("");
    };

    const cancelCompletion = () => {
        if (submitting) return;
        setActiveTaskId(null);
        setCompletionNote("");
        setError("");
    };

    const completeTask = async (task, note) => {
        const trimmedNote = note.trim();

        if (!trimmedNote) {
            setError("Please add a note about what was completed.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const response = await fetch("/api/github", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    owner: task.repo.split("/")[0],
                    repo: task.repo.split("/")[1],
                    issue_number: task.issue_number,
                    comment: trimmedNote,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const message = errorData?.error || "Failed to complete the task.";
                throw new Error(message);
            }

            setTasks((prevTasks) => prevTasks.filter((t) => t.id !== task.id));
            setActiveTaskId(null);
            setCompletionNote("");
        } catch (err) {
            console.error("Error completing task:", err);
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <p>Loading tasks...</p>;
    if (!tasks.length) return <p>No GitHub tasks assigned 🎉</p>;

    return (
        <ul className="space-y-4">
            {tasks.map((task) => {
                const isActive = activeTaskId === task.id;

                return (
                    <li key={task.id} className="border p-3 rounded shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
                                {task.description ? (
                                    <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                                        {task.description}
                                    </p>
                                ) : (
                                    <p className="text-sm text-gray-400 mt-2 italic">
                                        No description provided.
                                    </p>
                                )}
                            </div>
                            {!isActive && (
                                <button
                                    onClick={() => startCompletion(task.id)}
                                    className="self-start bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                                >
                                    ✓ Done
                                </button>
                            )}
                        </div>

                        {isActive && (
                            <div className="mt-3 space-y-2">
                                <label
                                    htmlFor={`completion-note-${task.id}`}
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Add a note about what was completed
                                </label>
                                <textarea
                                    id={`completion-note-${task.id}`}
                                    className="w-full border rounded p-2 text-sm focus:outline-none focus:ring"
                                    rows={4}
                                    value={completionNote}
                                    onChange={(event) => setCompletionNote(event.target.value)}
                                    placeholder="Share what you completed before closing the issue..."
                                    disabled={submitting}
                                />
                                {error && <p className="text-sm text-red-600">{error}</p>}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => completeTask(task, completionNote)}
                                        className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 disabled:opacity-60"
                                        disabled={submitting}
                                    >
                                        {submitting ? "Saving..." : "Submit & Close"}
                                    </button>
                                    <button
                                        onClick={cancelCompletion}
                                        className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 disabled:opacity-60"
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
