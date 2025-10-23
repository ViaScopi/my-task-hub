import { createClient } from "../../lib/supabase/api";

const DEFAULT_BASE_URL = "https://api.trello.com/1";
const DEFAULT_LIMIT = 200;

async function getUserTrelloAuth(supabase, userId) {
  // Get user's Trello integration from database
  const { data, error } = await supabase
    .from("user_integrations")
    .select("access_token, metadata")
    .eq("user_id", userId)
    .eq("provider", "trello")
    .single();

  if (error || !data) {
    throw new Error("Trello not connected. Please connect your Trello account in Settings.");
  }

  const apiKey = process.env.TRELLO_API_KEY;
  if (!apiKey) {
    throw new Error("Trello API key not configured on server.");
  }

  return {
    key: apiKey,
    token: data.access_token,
    username: data.metadata?.username || null,
  };
}

async function getTrelloMemberId(key, token) {
  // Fetch current member info to get member ID
  const response = await fetch(
    `${DEFAULT_BASE_URL}/members/me?key=${key}&token=${token}&fields=id,username`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Trello member information");
  }

  const data = await response.json();
  return data.id;
}

function ensureBaseUrl(rawBaseUrl) {
  let normalized = rawBaseUrl?.trim();

  if (!normalized) {
    normalized = DEFAULT_BASE_URL;
  }

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  try {
    const url = new URL(normalized);
    url.search = "";
    url.hash = "";

    let pathname = url.pathname.replace(/\/+$/, "");
    if (!pathname) {
      pathname = "/";
    }

    url.pathname = pathname;
    return url.toString().replace(/\/+$/, "");
  } catch (error) {
    return normalized.replace(/\/+$/, "");
  }
}

function buildUrl(baseUrl, path) {
  const normalizedBase = ensureBaseUrl(baseUrl);

  if (!path) {
    return normalizedBase;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(path)) {
    return path;
  }

  const trimmedBase = normalizedBase.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${trimmedBase}${normalizedPath}`;
}

function getBaseUrl() {
  return ensureBaseUrl(process.env.TRELLO_API_BASE_URL);
}

function getCardLimit() {
  const rawLimit = process.env.TRELLO_CARD_LIMIT;

  if (!rawLimit) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawLimit, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, 500);
}

function normalizeCardUrl(card) {
  const candidates = [card?.shortUrl, card?.url];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "string" && candidate.trim()) {
      const trimmed = candidate.trim();
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
    }
  }

  return "";
}

function mapListsToOptions(lists) {
  if (!Array.isArray(lists)) {
    return [];
  }

  const options = [];
  const seen = new Set();

  for (const list of lists) {
    if (!list || typeof list !== "object") {
      continue;
    }

    const id = typeof list.id === "string" ? list.id.trim() : "";

    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);

    const name = list.name?.trim() || "Untitled list";

    options.push({ id, name });
  }

  return options;
}

function getBoardSource(boardId) {
  const fellowBoardId = process.env.TRELLO_FELLOW_BOARD_ID?.trim();

  if (fellowBoardId && boardId === fellowBoardId) {
    return "Fellow";
  }

  return "Trello";
}

function mapCardsToTasks(cards, boardLists = new Map()) {
  if (!Array.isArray(cards)) {
    return [];
  }

  const tasks = [];
  const seen = new Set();

  for (const card of cards) {
    if (!card || typeof card !== "object") {
      continue;
    }

    const id = typeof card.id === "string" ? card.id.trim() : "";

    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);

    const title = card.name?.trim() || "Untitled card";
    const description = card.desc?.trim() || "";
    const boardName = card.board?.name?.trim();
    const boardId = typeof card.idBoard === "string" ? card.idBoard.trim() : "";

    let listName = typeof card.list?.name === "string" ? card.list.name.trim() : "";
    const cardListId = typeof card.idList === "string" ? card.idList.trim() : "";

    if (!listName && boardId && cardListId) {
      const listsForBoard = boardLists.get(boardId) || [];

      for (const list of listsForBoard) {
        const listId = typeof list?.id === "string" ? list.id.trim() : "";

        if (listId && listId === cardListId) {
          listName = typeof list?.name === "string" ? list.name.trim() : "";
          if (listName) {
            break;
          }
        }
      }
    }

    const normalizedListName = listName.toLowerCase();

    if (normalizedListName === "completed") {
      continue;
    }

    const due = card.due || null;

    let status = "";
    if (card.dueComplete === true) {
      status = "Completed";
    } else if (card.closed === true) {
      status = "Closed";
    }

    const pipelineOptions = boardId
      ? mapListsToOptions(boardLists.get(boardId))
      : [];
    const source = getBoardSource(boardId);

    tasks.push({
      id: `trello-${id}`,
      source,
      title,
      description,
      url: normalizeCardUrl(card),
      repo: boardName ? `Board: ${boardName}` : "Trello",
      pipelineId: card.idList || "",
      pipelineName: listName || "",
      pipelineOptions,
      dueDate: due,
      due,
      status,
      trelloCardId: id,
      trelloBoardId: boardId,
      trelloListId: card.idList || "",
    });
  }

  return tasks;
}

async function fetchMemberCards(baseUrl, key, token, memberId, limit) {
  const url = new URL(buildUrl(baseUrl, `members/${encodeURIComponent(memberId)}/cards`));
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);
  url.searchParams.set("filter", "open");
  url.searchParams.set(
    "fields",
    "name,url,shortUrl,due,dueComplete,idBoard,idList,desc,closed"
  );
  url.searchParams.set("board", "true");
  url.searchParams.set("board_fields", "name,url");
  url.searchParams.set("list", "true");
  url.searchParams.set("list_fields", "name");

  if (limit) {
    url.searchParams.set("limit", String(limit));
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    let message = `Trello API responded with status ${response.status}.`;

    try {
      const data = await response.json();
      message = data?.message || data?.error || message;
    } catch (error) {
      // Ignore JSON parse errors and fall back to the default message.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data;
}

async function fetchBoardLists(baseUrl, key, token, boardId) {
  if (!boardId) {
    return [];
  }

  const url = new URL(buildUrl(baseUrl, `boards/${encodeURIComponent(boardId)}/lists`));
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);
  url.searchParams.set("filter", "open");
  url.searchParams.set("fields", "name");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    let message = `Trello API responded with status ${response.status}.`;

    try {
      const data = await response.json();
      message = data?.message || data?.error || message;
    } catch (error) {
      // Ignore JSON parse errors and fall back to the default message.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data;
}

async function moveCardToList(baseUrl, key, token, cardId, targetListId) {
  const url = new URL(buildUrl(baseUrl, `cards/${encodeURIComponent(cardId)}/idList`));
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);
  url.searchParams.set("value", targetListId);

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    let message = `Trello API responded with status ${response.status}.`;

    try {
      const data = await response.json();
      message = data?.message || data?.error || message;
    } catch (error) {
      // Ignore JSON parse errors and fall back to the default message.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function addCommentToCard(baseUrl, key, token, cardId, comment) {
  const url = new URL(buildUrl(baseUrl, `cards/${encodeURIComponent(cardId)}/actions/comments`));
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);

  const body = new URLSearchParams();
  body.set("text", comment);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    let message = `Trello API responded with status ${response.status}.`;

    try {
      const data = await response.json();
      message = data?.message || data?.error || message;
    } catch (error) {
      // Ignore JSON parse errors and fall back to the default message.
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  const supabase = createClient(req, res);

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      // Get user's Trello credentials from database
      const { key, token } = await getUserTrelloAuth(supabase, user.id);
      const memberId = await getTrelloMemberId(key, token);

      const baseUrl = getBaseUrl();
      const limit = getCardLimit();

      const cards = await fetchMemberCards(baseUrl, key, token, memberId, limit);

      const boardIdSet = new Set();
      for (const card of cards) {
        const boardId = typeof card?.idBoard === "string" ? card.idBoard.trim() : "";
        if (boardId) {
          boardIdSet.add(boardId);
        }
      }

      const boardListEntries = await Promise.all(
        Array.from(boardIdSet).map(async (boardId) => {
          try {
            const lists = await fetchBoardLists(baseUrl, key, token, boardId);
            return [boardId, lists];
          } catch (error) {
            console.error(`Failed to load Trello lists for board ${boardId}:`, error);
            return [boardId, []];
          }
        })
      );

      const boardLists = new Map(boardListEntries);
      const tasks = mapCardsToTasks(cards, boardLists);

      return res.status(200).json(tasks);
    } catch (error) {
      console.error("Trello API error:", error);

      const status = Number.isInteger(error.status) ? error.status : null;

      if (status === 401 || status === 403) {
        return res.status(503).json({
          error: "Trello integration authentication failed. Please reconnect your Trello account in Settings.",
        });
      }

      if (status && status >= 400 && status < 600) {
        return res.status(status).json({ error: error.message || "Failed to load Trello cards." });
      }

      return res.status(500).json({ error: error.message || "Failed to load Trello cards." });
    }
  }

  if (req.method === "POST") {
    try {
      const { key, token } = await getUserTrelloAuth(supabase, user.id);
      const baseUrl = getBaseUrl();

      const action = req.body?.action;

      if (action === "move") {
        const cardId = req.body?.cardId?.trim();
        const targetListId = req.body?.targetListId?.trim();

        if (!cardId || !targetListId) {
          return res.status(400).json({ error: "cardId and targetListId are required to move a Trello card." });
        }

        await moveCardToList(baseUrl, key, token, cardId, targetListId);
        return res.status(200).json({ success: true, cardId, targetListId });
      }

      if (action === "comment") {
        const cardId = req.body?.cardId?.trim();
        const comment = req.body?.comment?.trim();

        if (!cardId || !comment) {
          return res
            .status(400)
            .json({ error: "cardId and a non-empty comment are required to add a Trello comment." });
        }

        await addCommentToCard(baseUrl, key, token, cardId, comment);
        return res.status(200).json({ success: true, cardId });
      }

      return res.status(400).json({ error: "Unsupported Trello action." });
    } catch (error) {
      console.error("Trello API error:", error);

      const status = Number.isInteger(error.status) ? error.status : null;

      if (status && status >= 400 && status < 600) {
        return res.status(status).json({ error: error.message || "Failed to update Trello card." });
      }

      return res.status(500).json({ error: error.message || "Failed to update Trello card." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}

export {
  mapCardsToTasks,
  fetchMemberCards,
  ensureBaseUrl,
  buildUrl,
  fetchBoardLists,
  moveCardToList,
  addCommentToCard,
  mapListsToOptions,
};
