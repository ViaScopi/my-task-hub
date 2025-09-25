const test = require("node:test");
const assert = require("node:assert/strict");

test("maps Trello cards into task objects", async () => {
  const { mapCardsToTasks } = await import("../trello.js");

  const cards = [
    {
      id: "abc123",
      name: "Update onboarding docs",
      desc: "Ensure the getting started guide references the latest tooling.",
      shortUrl: "https://trello.com/c/abc123",
      due: "2025-05-01T10:00:00.000Z",
      dueComplete: false,
      closed: false,
      idBoard: "board-1",
      idList: "list-2",
      board: { name: "Product Ops" },
      list: { name: "In Progress" },
    },
  ];

  const tasks = mapCardsToTasks(cards);

  assert.equal(tasks.length, 1);
  const [task] = tasks;

  assert.equal(task.id, "trello-abc123");
  assert.equal(task.title, "Update onboarding docs");
  assert.equal(task.description, "Ensure the getting started guide references the latest tooling.");
  assert.equal(task.repo, "Board: Product Ops");
  assert.equal(task.pipelineId, "list-2");
  assert.equal(task.pipelineName, "In Progress");
  assert.equal(task.url, "https://trello.com/c/abc123");
  assert.equal(task.dueDate, "2025-05-01T10:00:00.000Z");
  assert.equal(task.status, "");
});

test("filters cards by configured board IDs", async () => {
  const { filterCardsByBoard } = await import("../trello.js");

  const cards = [
    { id: "1", idBoard: "board-a" },
    { id: "2", idBoard: "board-b" },
    { id: "3", idBoard: "board-c" },
  ];

  const filtered = filterCardsByBoard(cards, ["board-b", "board-c"]);

  assert.deepEqual(
    filtered.map((card) => card.id),
    ["2", "3"]
  );
});

test("ensureBaseUrl normalizes Trello endpoints", async () => {
  const { ensureBaseUrl } = await import("../trello.js");

  assert.equal(ensureBaseUrl("api.trello.com/1"), "https://api.trello.com/1");
  assert.equal(ensureBaseUrl("https://api.trello.com/1/"), "https://api.trello.com/1");
});

test("fetchMemberCards requests open cards with board and list context", async () => {
  const { fetchMemberCards } = await import("../trello.js");

  const requests = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    requests.push({ url: new URL(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => [{ id: "abc" }],
    };
  };

  try {
    const cards = await fetchMemberCards("https://api.trello.com/1", "key", "token", "member", 25);
    assert.equal(cards.length, 1);
  } finally {
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  }

  assert.equal(requests.length, 1);
  const request = requests[0];
  const params = request.url.searchParams;

  assert.equal(request.url.pathname, "/members/member/cards");
  assert.equal(params.get("key"), "key");
  assert.equal(params.get("token"), "token");
  assert.equal(params.get("filter"), "open");
  assert.equal(params.get("fields"), "name,url,shortUrl,due,dueComplete,idBoard,idList,desc,closed");
  assert.equal(params.get("board"), "true");
  assert.equal(params.get("board_fields"), "name,url");
  assert.equal(params.get("list"), "true");
  assert.equal(params.get("list_fields"), "name");
  assert.equal(params.get("limit"), "25");
  assert.equal(request.options.headers.Accept, "application/json");
});
