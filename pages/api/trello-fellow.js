import {
  mapCardsToTasks,
  filterCardsByBoard,
  fetchMemberCards,
  fetchBoardLists,
  getConfiguredFellowBoardIds,
  getExcludedBoardIds,
  getCardLimit,
  getBaseUrl,
  ensureConfiguredAuth,
  ensureConfiguredMemberId,
} from "./trello";

const MISSING_CREDENTIALS_ERROR = "MISSING_TRELLO_CREDENTIALS";

export async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const fellowBoardIds = getConfiguredFellowBoardIds();

    if (fellowBoardIds.length === 0) {
      return res.status(200).json([]);
    }

    const { key, token } = ensureConfiguredAuth();
    const memberId = ensureConfiguredMemberId();
    const baseUrl = getBaseUrl();
    const limit = getCardLimit();
    const excludedBoardIds = getExcludedBoardIds();

    const cards = await fetchMemberCards(baseUrl, key, token, memberId, limit);
    const filteredCards = filterCardsByBoard(cards, fellowBoardIds, excludedBoardIds);

    const boardIdSet = new Set();
    for (const card of filteredCards) {
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
    const tasks = mapCardsToTasks(filteredCards, boardLists).map((task) => ({
      ...task,
      source: "Fellow",
    }));

    return res.status(200).json(tasks);
  } catch (error) {
    if (error.code === MISSING_CREDENTIALS_ERROR) {
      return res.status(503).json({ error: error.message });
    }

    const status = Number.isInteger(error.status) ? error.status : null;

    if (status === 401 || status === 403) {
      console.error("Trello API authentication error:", error);
      return res.status(503).json({
        error:
          "Trello integration authentication failed. Please verify the configured TRELLO_API_KEY, TRELLO_TOKEN, and TRELLO_MEMBER_ID.",
      });
    }

    if (status && status >= 400 && status < 600) {
      console.error("Trello API error:", error);
      return res.status(status).json({ error: error.message || "Failed to load Trello cards." });
    }

    console.error("Trello API error:", error);
    return res.status(500).json({ error: error.message || "Failed to load Trello cards." });
  }
}

export default handler;
