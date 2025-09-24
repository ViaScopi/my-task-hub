const test = require("node:test");
const assert = require("node:assert/strict");

const { fetchAssignedActionItems, mapActionItemsToTasks } = require("../fellow.js");

test("maps REST action items payload", () => {
  const payload = {
    notes: [
      {
        note_title: "Weekly Sync",
        note_url: "/notes/weekly-sync",
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
          },
        ],
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
  assert.equal(task.repo, "Note: Weekly Sync");
  assert.equal(task.url, "https://fellow.app/action-items/123");
});

test("dedupes duplicate REST containers and preserves stream context", () => {
  const payload = {
    data: {
      notes: [
        {
          note_title: "Planning",
          action_items: [
            { id: "a-1", content: "First duplicate" },
            { id: "a-4", content: "Fourth" },
          ],
        },
      ],
    },
    notes: [
      {
        note_title: "Weekly Sync",
        action_items: [
          { id: "a-1", content: "First" },
          { id: "a-2", content: "Second" },
        ],
      },
      {
        note_title: "Product Roadmap",
        note_url: "/streams/roadmap",
        actionItems: [
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
      },
    ],
  };

  const tasks = mapActionItemsToTasks(payload);

  const ids = tasks.map((task) => task.id).sort();
  assert.deepEqual(ids, ["fellow-a-1", "fellow-a-2", "fellow-a-3", "fellow-a-4"]);

  const streamTask = tasks.find((task) => task.id === "fellow-a-3");
  assert(streamTask, "Expected to find stream task");
  assert.equal(streamTask.repo, "Stream: Product Roadmap");
  assert.equal(streamTask.url, "https://fellow.app/streams/roadmap");
});

test("maps GraphQL action items payload", () => {
  const payload = {
    viewer: {
      assignedActionItems: {
        edges: [
          {
            node: {
              id: "g-1",
              content: "Review draft",
              description: "<p>Leave comments</p>",
              dueDate: "2025-02-03",
              status: "open",
              url: "/action-items/g-1",
              note: {
                title: "Sprint Planning",
                url: "/notes/sprint-planning",
              },
            },
          },
        ],
      },
    },
  };

  const tasks = mapActionItemsToTasks(payload);

  assert.equal(tasks.length, 1);
  const [task] = tasks;

  assert.equal(task.id, "fellow-g-1");
  assert.equal(task.title, "Review draft");
  assert.equal(task.description, "Leave comments");
  assert.equal(task.dueDate, "2025-02-03");
  assert.equal(task.status, "open");
  assert.equal(task.repo, "Note: Sprint Planning");
  assert.equal(task.url, "https://fellow.app/action-items/g-1");
});

test("fetchAssignedActionItems falls back to API subdomain and v1 route", async () => {
  const requests = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });

    if (requests.length <= 8) {
      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: "Not found" }),
      };
    }

    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: {
            viewer: {
              assignedActionItems: {
                edges: [],
              },
            },
          },
        }),
    };
  };

  try {
    const payload = await fetchAssignedActionItems("https://fellow.app", "test-token", 25);
    assert.deepEqual(payload, {
      viewer: {
        assignedActionItems: {
          edges: [],
        },
      },
    });
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }

  assert.equal(requests.length, 9);
  assert.match(requests[0].url, /https:\/\/fellow\.app\/apps\/api\/v1\/notes\/list/);
  assert.match(requests[1].url, /https:\/\/fellow\.app\/api\/v1\/notes\/list/);
  assert.match(requests[2].url, /https:\/\/fellow\.app\/apps\/v1\/notes\/list/);
  assert.match(requests[3].url, /https:\/\/fellow\.app\/v1\/notes\/list/);
  assert.match(requests[4].url, /https:\/\/api\.fellow\.app\/apps\/api\/v1\/notes\/list/);
  assert.match(requests[5].url, /https:\/\/api\.fellow\.app\/api\/v1\/notes\/list/);
  assert.match(requests[6].url, /https:\/\/api\.fellow\.app\/apps\/v1\/notes\/list/);
  assert.match(requests[7].url, /https:\/\/api\.fellow\.app\/v1\/notes\/list/);

  for (let i = 0; i < 8; i += 1) {
    assert.equal(requests[i].options.method, "POST");
    const body = JSON.parse(requests[i].options.body);
    assert.equal(body.include.action_items, true);
    assert.equal(body.filters.note_filters.action_item_assignee, "me");
    assert.equal(body.filters.note_filters.action_item_status, "open");
    assert.equal(body.page_size, 25);
  }

  assert.equal(requests[requests.length - 1].options.method, "POST");
  const body = JSON.parse(requests[requests.length - 1].options.body);
  assert.equal(body.variables.first, 25);
  assert(body.query.includes("assignedActionItems"));
});

test("fetchAssignedActionItems returns GraphQL payload when REST endpoints missing", async () => {
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });

    if (/notes\/list/.test(url)) {
      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: "Not found" }),
      };
    }

    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: {
            viewer: {
              assignedActionItems: {
                edges: [
                  {
                    node: {
                      id: "graphql-1",
                      content: "GraphQL task",
                    },
                  },
                ],
              },
            },
          },
        }),
    };
  };

  try {
    const payload = await fetchAssignedActionItems("https://fellow.app", "test-token", 5);
    assert.equal(
      payload.viewer.assignedActionItems.edges[0].node.id,
      "graphql-1"
    );
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }

  assert.equal(calls.length, 9);
  assert.match(calls[8].url, /\/graphql$/);
  assert.equal(calls[8].options.method, "POST");
});
