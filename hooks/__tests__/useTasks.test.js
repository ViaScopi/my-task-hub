const test = require("node:test");
const assert = require("node:assert/strict");

test("mergeTasksWithCompletions marks persisted snapshots as done even when integrations omit them", async () => {
  const { mergeTasksWithCompletions } = await import("../useTasks.js?test=merge-1");
  const integrationTasks = [
    {
      id: "github-100",
      source: "GitHub",
      title: "Fix login bug",
      repo: "my-org/app",
      issue_number: 42,
      url: "https://github.com/my-org/app/issues/42",
      status: "open",
    },
  ];

  const completedSnapshots = [
    {
      source: "GitHub",
      originalId: "my-org/app#42",
      id: "github-100",
      title: "Fix login bug",
      notes: "Closed after deploy",
      completedAt: "2024-01-10T12:00:00.000Z",
      status: "Completed locally",
    },
    {
      source: "Trello",
      originalId: "card-123",
      id: "trello-card-123",
      title: "Plan marketing launch",
      pipelineName: "Done",
      completedAt: "2024-01-11T08:00:00.000Z",
    },
  ];

  const merged = mergeTasksWithCompletions(integrationTasks, completedSnapshots);

  assert.equal(merged.length, 2);

  const githubTask = merged.find((task) => task.source === "GitHub");
  assert.ok(githubTask, "GitHub task should be present");
  assert.equal(githubTask.id, "github-100");
  assert.equal(githubTask.originalId, "my-org/app#42");
  assert.equal(githubTask.locallyCompleted, true);
  assert.equal(githubTask.notes, "Closed after deploy");
  assert.ok(/complete/i.test(githubTask.status));
  assert.equal(githubTask.url, "https://github.com/my-org/app/issues/42");

  const trelloTask = merged.find((task) => task.source === "Trello");
  assert.ok(trelloTask, "Trello task should be added from history");
  assert.equal(trelloTask.locallyCompleted, true);
  assert.equal(trelloTask.pipelineName, "Done");
  assert.ok(/complete/i.test(trelloTask.status));
});

test("mergeTasksWithCompletions keeps integration identifiers while applying completion metadata", async () => {
  const { mergeTasksWithCompletions } = await import("../useTasks.js?test=merge-2");
  const integrationTasks = [
    {
      id: "trello-abc",
      source: "Trello",
      title: "Review analytics dashboard",
      trelloCardId: "card-abc",
      pipelineName: "Doing",
      status: "doing",
    },
  ];

  const completedSnapshots = [
    {
      source: "Trello",
      originalId: "card-abc",
      id: "different-local-id",
      title: "Review analytics dashboard",
      pipelineName: "Done",
      notes: "Moved to done",
    },
  ];

  const merged = mergeTasksWithCompletions(integrationTasks, completedSnapshots);

  assert.equal(merged.length, 1);
  const [card] = merged;
  assert.equal(card.id, "trello-abc", "Integration identifier should be preserved");
  assert.equal(card.pipelineName, "Done");
  assert.equal(card.notes, "Moved to done");
  assert.equal(card.locallyCompleted, true);
  assert.ok(/complete/i.test(card.status));
});
