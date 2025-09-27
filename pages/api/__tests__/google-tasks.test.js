const test = require("node:test");
const assert = require("node:assert/strict");

test("does not import tasks from the Completed tasks list", async () => {
  const originalEnv = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  };

  process.env.GOOGLE_CLIENT_ID = "client";
  process.env.GOOGLE_CLIENT_SECRET = "secret";
  process.env.GOOGLE_REFRESH_TOKEN = "refresh";

  const originalFetch = global.fetch;
  const requests = [];

  global.fetch = async (url, options = {}) => {
    const urlString = typeof url === "string" ? url : url.toString();
    requests.push(urlString);

    if (urlString.startsWith("https://oauth2.googleapis.com/token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "access-token" }),
      };
    }

    if (urlString.startsWith("https://tasks.googleapis.com/tasks/v1/users/@me/lists")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: "list-1", title: "My Tasks" },
            { id: "list-completed", title: "Completed tasks" },
          ],
        }),
      };
    }

    if (urlString.includes("/lists/list-1/tasks")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: "task-1",
              title: "Draft the launch plan",
            },
          ],
        }),
      };
    }

    if (urlString.includes("/lists/list-completed/tasks")) {
      throw new Error("Should not request tasks for the Completed tasks list");
    }

    throw new Error(`Unexpected fetch request for ${urlString}`);
  };

  try {
    const { default: handler } = await import("../google-tasks.js?skip-completed");

    const req = { method: "GET" };
    let statusCode = 0;
    let payload = null;

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        payload = data;
        return this;
      },
    };

    await handler(req, res);

    assert.equal(statusCode, 200);
    assert.ok(Array.isArray(payload));
    assert.equal(payload.length, 1);

    const [task] = payload;
    assert.equal(task.id, "google-task-1");
    assert.equal(task.title, "Draft the launch plan");
    assert.ok(
      task.pipelineOptions.some((option) => option.id === "list-completed")
    );
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  assert.ok(!requests.some((url) => url.includes("list-completed")));
});

