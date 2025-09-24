const DEFAULT_BASE_URL = "https://fellow.app";
const DEFAULT_LIMIT = 100;

const MISSING_CREDENTIALS_ERROR = "MISSING_FELLOW_CREDENTIALS";

function getBaseUrl() {
  const rawBaseUrl =
    process.env.FELLOW_API_BASE_URL?.trim() ?? process.env.FELLOW_GRAPHQL_ENDPOINT?.trim();

  return ensureBaseUrl(rawBaseUrl);
}

function ensureBaseUrl(rawBaseUrl) {
  let normalizedBaseUrl = rawBaseUrl?.trim();

  if (!normalizedBaseUrl) {
    normalizedBaseUrl = DEFAULT_BASE_URL;
  }

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(normalizedBaseUrl)) {
    normalizedBaseUrl = `https://${normalizedBaseUrl}`;
  }

  try {
    const baseUrl = new URL(normalizedBaseUrl);

    baseUrl.search = "";
    baseUrl.hash = "";

    let pathname = baseUrl.pathname.replace(/\/+$/, "");

    if (!pathname) {
      pathname = "/";
    }

    baseUrl.pathname = pathname;

    return baseUrl.toString().replace(/\/+$/, "");
  } catch (error) {
    return normalizedBaseUrl.replace(/\/+$/, "");
  }
}

function buildUrl(baseUrl, path) {
  const normalizedBaseUrl = ensureBaseUrl(baseUrl);

  if (!path) {
    return normalizedBaseUrl;
  }

  try {
    const baseForUrl = normalizedBaseUrl.endsWith("/")
      ? normalizedBaseUrl
      : `${normalizedBaseUrl}/`;

    return new URL(path, baseForUrl).toString();
  } catch (error) {
    const trimmedBase = normalizedBaseUrl.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    return `${trimmedBase}${normalizedPath}`;
  }
}

function getLimit() {
  const rawLimit = process.env.FELLOW_ACTIONS_LIMIT;

  if (!rawLimit) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawLimit, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, 200);
}

function ensureConfiguredToken() {
  const token = process.env.FELLOW_API_TOKEN?.trim();

  if (!token) {
    const error = new Error(
      "Fellow integration is not configured. Please provide the FELLOW_API_TOKEN environment variable."
    );
    error.code = MISSING_CREDENTIALS_ERROR;
    throw error;
  }

  return token;
}

function collectNodes(collection) {
  if (!collection) {
    return [];
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  if (Array.isArray(collection.nodes)) {
    return collection.nodes;
  }

  if (Array.isArray(collection.edges)) {
    return collection.edges.map((edge) => edge?.node || edge).filter(Boolean);
  }

  if (Array.isArray(collection.items)) {
    return collection.items;
  }

  return [];
}

function stripHtml(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<\/?br\s*\/?>(\s|\n)*/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url) {
  if (!url || typeof url !== "string") {
    return "";
  }

  const trimmed = url.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const relativePath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  return buildUrl(getBaseUrl(), relativePath);
}

function resolveContext(action, wrapper) {
  const meeting = action?.meeting || wrapper?.meeting;
  const stream = action?.stream || wrapper?.stream;

  if (meeting?.title) {
    return { label: `Meeting: ${meeting.title}`, url: normalizeUrl(meeting.url) };
  }

  if (stream?.name) {
    return { label: `Stream: ${stream.name}`, url: normalizeUrl(stream.url) };
  }

  return { label: "Fellow", url: "" };
}

function mapActionItemsToTasks(data) {
  if (!data) {
    return [];
  }

  const containers = [];

  if (Array.isArray(data)) {
    containers.push(data);
  }

  const viewer = data.viewer || data.me || data.currentUser;

  if (viewer) {
    containers.push(
      viewer.assignedActionItems,
      viewer.actionItems,
      viewer.actionItemAssignments,
      viewer.assignedActionItemsConnection,
      viewer.actionItemsConnection,
      viewer.actionItemAssignmentsConnection,
      viewer.tasks,
      viewer.items
    );
  }

  containers.push(
    data.assignedActionItems,
    data.actionItems,
    data.actionItemAssignments,
    data.assignedActionItemsConnection,
    data.actionItemsConnection,
    data.actionItemAssignmentsConnection,
    data.action_items
  );

  const items = [];
  const seen = new Set();

  for (const container of containers) {
    const nodes = collectNodes(container);

    for (const node of nodes) {
      const action = node?.actionItem || node;

      if (!action?.id || seen.has(action.id)) {
        continue;
      }

      seen.add(action.id);
      items.push({ action, wrapper: node });
    }
  }

  return items.map(({ action, wrapper }) => {
    const context = resolveContext(action, wrapper);
    const title = action?.content?.trim() || action?.title?.trim() || "Untitled action item";
    const description =
      stripHtml(action?.htmlContent) ||
      stripHtml(wrapper?.htmlContent) ||
      action?.summary?.trim() ||
      action?.notes?.trim() ||
      action?.content?.trim() ||
      "";

    const dueDate = action?.dueDate || action?.due || wrapper?.dueDate || wrapper?.due || null;
    const status = action?.status || wrapper?.status || null;

    const candidateUrls = [action?.url, wrapper?.url, context.url];
    const normalizedUrl = candidateUrls.map(normalizeUrl).find(Boolean) || getBaseUrl();

    return {
      id: `fellow-${action.id}`,
      source: "Fellow",
      title,
      url: normalizedUrl,
      repo: context.label,
      description,
      dueDate,
      status,
    };
  });
}

const AUTH_HEADER_PREFIX_PATTERN = /^(Bearer|Token|Basic)\s/i;
const TOKEN_PLACEHOLDER_REGEX = /\{\{\s*token\s*\}\}/gi;

function buildAuthHeaderOptions(token) {
  const trimmedToken = token.trim();

  if (!trimmedToken) {
    return [];
  }

  if (AUTH_HEADER_PREFIX_PATTERN.test(trimmedToken)) {
    return dedupeHeaderOptions([{ Authorization: trimmedToken }]);
  }

  const candidates = [
    { Authorization: `Bearer ${trimmedToken}` },
    { Authorization: `Bearer "${trimmedToken}"` },
    { Authorization: trimmedToken },
    { Authorization: `Token ${trimmedToken}` },
    { Authorization: `Token token=${trimmedToken}` },
    { Authorization: `Token token="${trimmedToken}"` },
    { Authorization: `token ${trimmedToken}` },
    { Authorization: `token token=${trimmedToken}` },
    { Authorization: `Basic ${trimmedToken}` },
    { "X-API-KEY": trimmedToken },
    { "X-Api-Key": trimmedToken },
    { "X-Fellow-Token": trimmedToken },
    { "X-Fellow-Api-Key": trimmedToken },
    { "X-Auth-Token": trimmedToken },
    ...buildCustomAuthHeaders(trimmedToken),
  ];

  return dedupeHeaderOptions(candidates);
}

function buildCustomAuthHeaders(trimmedToken) {
  const rawHeaders = process.env.FELLOW_API_TOKEN_HEADERS?.trim();

  if (!rawHeaders) {
    return [];
  }

  const parsedHeaders = parseCustomAuthHeaders(rawHeaders);

  if (!parsedHeaders) {
    return [];
  }

  return parsedHeaders
    .map((headerSet) =>
      Object.entries(headerSet).reduce((acc, [key, value]) => {
        if (!key) {
          return acc;
        }

        const normalizedKey = String(key).trim();

        if (!normalizedKey) {
          return acc;
        }

        const resolvedValue = resolveHeaderValue(value, trimmedToken);

        if (resolvedValue === null) {
          return acc;
        }

        acc[normalizedKey] = resolvedValue;
        return acc;
      }, {})
    )
    .filter((headers) => Object.keys(headers).length > 0);
}

function resolveHeaderValue(value, token) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.replace(TOKEN_PLACEHOLDER_REGEX, token);
}

function parseCustomAuthHeaders(rawHeaders) {
  try {
    const parsed = JSON.parse(rawHeaders);

    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item === "object");
    }

    if (parsed && typeof parsed === "object") {
      return [parsed];
    }

    return null;
  } catch (error) {
    console.warn(
      "Failed to parse FELLOW_API_TOKEN_HEADERS. Expected a JSON object or array of objects.",
      error
    );
    return null;
  }
}

function dedupeHeaderOptions(options) {
  const seen = new Set();

  return options.filter((headers) => {
    if (!headers || typeof headers !== "object") {
      return false;
    }

    const key = Object.entries(headers)
      .filter(([headerKey, value]) => Boolean(headerKey) && value !== undefined && value !== null)
      .map(([headerKey, value]) => `${headerKey.toLowerCase()}:${String(value)}`)
      .sort()
      .join("|");

    if (!key) {
      return false;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function fetchAssignedActionItems(baseUrl, token, limit) {
  const authHeaderOptions = buildAuthHeaderOptions(token);

  if (authHeaderOptions.length === 0) {
    const error = new Error("Fellow API token is missing.");
    error.status = 401;
    throw error;
  }

  const endpoint = buildUrl(baseUrl, "/api/v1/action-items");
  const url = new URL(endpoint);

  url.searchParams.set("assigned_to", "me");

  if (limit) {
    url.searchParams.set("limit", String(limit));
  }

  let lastAuthError = null;

  for (const authHeaders of authHeaderOptions) {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...authHeaders,
      },
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = null;
      }
    }

    if (!response.ok) {
      const message =
        payload?.error || payload?.message || payload?.errors?.[0]?.message || payload?.title;
      const error = new Error(message || "Failed to load Fellow action items.");
      error.status = response.status;

      if ((response.status === 401 || response.status === 403) && authHeaderOptions.length > 1) {
        lastAuthError = error;
        continue;
      }

      throw error;
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Unexpected response from Fellow.");
    }

    return payload;
  }

  throw lastAuthError || new Error("Failed to authenticate with Fellow using the provided token.");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const token = ensureConfiguredToken();
    const baseUrl = getBaseUrl();
    const limit = getLimit();
    const data = await fetchAssignedActionItems(baseUrl, token, limit);
    const tasks = mapActionItemsToTasks(data);

    return res.status(200).json(tasks);
  } catch (error) {
    if (error.code === MISSING_CREDENTIALS_ERROR) {
      return res.status(503).json({ error: error.message });
    }

    const status = Number.isInteger(error.status) ? error.status : null;

    if (status === 401 || status === 403) {
      console.error("Fellow API authentication error:", error);
      return res.status(503).json({
        error:
          "Fellow integration authentication failed. Please verify the configured FELLOW_API_TOKEN.",
      });
    }

    if (status && status >= 400 && status < 600) {
      console.error("Fellow API error:", error);
      return res.status(status).json({ error: error.message || "Failed to load Fellow action items." });
    }

    console.error("Fellow API error:", error);
    return res.status(500).json({ error: error.message || "Failed to load Fellow action items." });
  }
}
