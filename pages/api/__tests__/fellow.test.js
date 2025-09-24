const test = require("node:test");
const assert = require("node:assert/strict");

const { mapActionItemsToTasks } = require("../fellow.js");

test("maps REST action items payload", () => {
  const payload = {
    action_items: [
      {
        id: "123",
        content: "Follow up with the team",
        description: "<p>Ensure blockers are resolved</p>",
        summary: "Ensure blockers are resolved",
        html_content: "<p>Ensure blockers are resolved</p>",
        due_date: "2025-01-02",
        status: "open",
        url: "/action-items/123",
        meeting: {
          title: "Weekly Sync",
          url: "/meetings/weekly-sync",
        },
      },
    ],
  };

  const tasks = mapActionItemsToTasks(payload);

  assert.equal(tasks.length, 1);

  const [task] = tasks;

  assert.equal(task.id, "fellow-123");
  assert.equal(task.title, "Follow up with the team");
  assert.equal(task.description, "Ensure blockers are resolved");
  assert.equal(task.dueDate, "2025-01-02");
  assert.equal(task.status, "open");
  assert.equal(task.repo, "Meeting: Weekly Sync");
  assert.equal(task.url, "https://fellow.app/action-items/123");
});

test("dedupes duplicate REST containers and preserves stream context", () => {
  const payload = {
    action_items: [
      { id: "a-1", content: "First" },
      { id: "a-2", content: "Second" },
    ],
    items: [
      { id: "a-2", content: "Second duplicate" },
      {
        id: "a-3",
        content: "Third",
        stream: {
          name: "Product Roadmap",
          url: "/streams/roadmap",
        },
      },
    ],
    data: {
      action_items: [{ id: "a-1", content: "First duplicate" }, { id: "a-4", content: "Fourth" }],
    },
  };

  const tasks = mapActionItemsToTasks(payload);

  const ids = tasks.map((task) => task.id).sort();
  assert.deepEqual(ids, ["fellow-a-1", "fellow-a-2", "fellow-a-3", "fellow-a-4"]);

  const streamTask = tasks.find((task) => task.id === "fellow-a-3");
  assert(streamTask, "Expected to find stream task");
  assert.equal(streamTask.repo, "Stream: Product Roadmap");
  assert.equal(streamTask.url, "https://fellow.app/streams/roadmap");
});
