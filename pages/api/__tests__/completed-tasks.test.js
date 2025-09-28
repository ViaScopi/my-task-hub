const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function createTempStorePath(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix)).then((dir) => ({
    dir,
    file: path.join(dir, "store.json"),
  }));
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end() {
      return this;
    },
  };
}

test("GET /api/completed-tasks returns an empty list when no snapshots exist", async (t) => {
  const { dir, file } = await createTempStorePath("completed-store-");
  process.env.COMPLETED_TASKS_STORE_PATH = file;

  const { default: handler } = await import("../completed-tasks.js?test=get-empty");

  const req = { method: "GET" };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);

  await fs.rm(dir, { recursive: true, force: true });
  delete process.env.COMPLETED_TASKS_STORE_PATH;
});

test("POST /api/completed-tasks upserts snapshots by source and originalId", async (t) => {
  const { dir, file } = await createTempStorePath("completed-store-");
  process.env.COMPLETED_TASKS_STORE_PATH = file;

  const { default: handler } = await import("../completed-tasks.js?test=upsert");

  const postReq = {
    method: "POST",
    body: {
      source: "GitHub",
      originalId: "my-org/my-repo#42",
      id: "github-issue-42",
      title: "Initial title",
      notes: "Reviewed",
    },
  };
  const postRes = createMockResponse();

  await handler(postReq, postRes);

  assert.equal(postRes.statusCode, 200);
  assert.equal(postRes.body.source, "GitHub");
  assert.equal(postRes.body.originalId, "my-org/my-repo#42");
  assert.equal(postRes.body.title, "Initial title");
  assert.ok(postRes.body.updatedAt);

  const updateReq = {
    method: "POST",
    body: {
      source: "GitHub",
      originalId: "my-org/my-repo#42",
      id: "github-issue-42",
      title: "Updated title",
      notes: "Completed after QA",
    },
  };
  const updateRes = createMockResponse();

  await handler(updateReq, updateRes);

  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.body.title, "Updated title");
  assert.equal(updateRes.body.notes, "Completed after QA");

  const getReq = { method: "GET" };
  const getRes = createMockResponse();

  await handler(getReq, getRes);

  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.length, 1);
  const [stored] = getRes.body;
  assert.equal(stored.title, "Updated title");
  assert.equal(stored.notes, "Completed after QA");

  await fs.rm(dir, { recursive: true, force: true });
  delete process.env.COMPLETED_TASKS_STORE_PATH;
});
