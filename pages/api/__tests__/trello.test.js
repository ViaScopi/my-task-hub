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

  const boardLists = new Map([
    [
      "board-1",
      [
        { id: "list-1", name: "Backlog" },
        { id: "list-2", name: "In Progress" },
        { id: "list-3", name: "Review" },
      ],
    ],
  ]);

  const tasks = mapCardsToTasks(cards, boardLists);

  assert.equal(tasks.length, 1);
  const [task] = tasks;

  assert.equal(task.id, "trello-abc123");
  assert.equal(task.source, "Trello");
  assert.equal(task.title, "Update onboarding docs");
  assert.equal(task.description, "Ensure the getting started guide references the latest tooling.");
  assert.equal(task.repo, "Board: Product Ops");
  assert.equal(task.pipelineId, "list-2");
  assert.equal(task.pipelineName, "In Progress");
  assert.equal(task.url, "https://trello.com/c/abc123");
  assert.equal(task.dueDate, "2025-05-01T10:00:00.000Z");
  assert.equal(task.status, "");
  assert.deepEqual(task.pipelineOptions, [
    { id: "list-1", name: "Backlog" },
    { id: "list-2", name: "In Progress" },
    { id: "list-3", name: "Review" },
  ]);
});

test("maps cards from the fellow board with a Fellow source label", async () => {
  const originalValue = process.env.TRELLO_FELLOW_BOARD_ID;
  process.env.TRELLO_FELLOW_BOARD_ID = "fellow-board";

  try {
    const { mapCardsToTasks } = await import("../trello.js?fellow");

    const cards = [
      {
        id: "fellow-1",
        name: "Prep mentorship notes",
        idBoard: "fellow-board",
        idList: "list-1",
      },
    ];

    const tasks = mapCardsToTasks(cards, new Map());

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].source, "Fellow");
  } finally {
    if (originalValue === undefined) {
      delete process.env.TRELLO_FELLOW_BOARD_ID;
    } else {
      process.env.TRELLO_FELLOW_BOARD_ID = originalValue;
    }
  }
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
  const { ensureBaseUrl, buildUrl } = await import("../trello.js");

  assert.equal(ensureBaseUrl("api.trello.com/1"), "https://api.trello.com/1");
  assert.equal(ensureBaseUrl("https://api.trello.com/1/"), "https://api.trello.com/1");

  assert.equal(
    buildUrl("https://api.trello.com/1", "/members/test/cards"),
    "https://api.trello.com/1/members/test/cards"
  );
  assert.equal(
    buildUrl("https://api.trello.com/1/", "members/test/cards"),
    "https://api.trello.com/1/members/test/cards"
  );
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

  assert.equal(request.url.pathname, "/1/members/member/cards");
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

test("fetchBoardLists requests lists for the given board", async () => {
  const { fetchBoardLists } = await import("../trello.js");

  const requests = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    requests.push({ url: new URL(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => [
        { id: "list-1", name: "Backlog" },
        { id: "list-2", name: "In Progress" },
      ],
    };
  };

  try {
    const lists = await fetchBoardLists("https://api.trello.com/1", "key", "token", "board-123");
    assert.equal(lists.length, 2);
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

  assert.equal(request.url.pathname, "/1/boards/board-123/lists");
  assert.equal(params.get("key"), "key");
  assert.equal(params.get("token"), "token");
  assert.equal(params.get("filter"), "open");
  assert.equal(params.get("fields"), "name");
  assert.equal(request.options.headers.Accept, "application/json");
});

test("moveCardToList updates the Trello list", async () => {
  const { moveCardToList } = await import("../trello.js");

  const requests = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    requests.push({ url: new URL(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "card-123", idList: "list-2" }),
    };
  };

  try {
    const response = await moveCardToList("https://api.trello.com/1", "key", "token", "card-123", "list-2");
    assert.equal(response.idList, "list-2");
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

  assert.equal(request.url.pathname, "/1/cards/card-123/idList");
  assert.equal(request.options.method, "PUT");
  assert.equal(params.get("value"), "list-2");
  assert.equal(params.get("key"), "key");
  assert.equal(params.get("token"), "token");
});

test("addCommentToCard posts comments to Trello", async () => {
  const { addCommentToCard } = await import("../trello.js");

  const requests = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    requests.push({ url: new URL(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "comment-1" }),
    };
  };

  try {
    const response = await addCommentToCard(
      "https://api.trello.com/1",
      "key",
      "token",
      "card-123",
      "This needs attention"
    );
    assert.equal(response.id, "comment-1");
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

  assert.equal(request.url.pathname, "/1/cards/card-123/actions/comments");
  assert.equal(request.options.method, "POST");
  assert.equal(params.get("key"), "key");
  assert.equal(params.get("token"), "token");
  assert.equal(request.options.headers["Content-Type"], "application/x-www-form-urlencoded");

  const body = request.options.body;
  assert.equal(body.get("text"), "This needs attention");
});
