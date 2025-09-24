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

function buildGraphqlUrl(baseUrl) {
  return buildUrl(baseUrl, "/graphql");
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
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(stripHtml).filter(Boolean).join(" ").trim();
  }

  if (typeof value === "object") {
    const candidates = [
      value.html,
      value.text,
      value.value,
      value.content,
      value.description,
      value.summary,
    ];

    for (const candidate of candidates) {
      const normalized = stripHtml(candidate);

      if (normalized) {
        return normalized;
      }
    }

    return "";
  }

  if (typeof value !== "string") {
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

const CONTEXT_LABEL_FIELDS = ["title", "name", "summary", "label"]; 
const CONTEXT_URL_FIELDS = [
  "url",
  "htmlUrl",
  "html_url",
  "webUrl",
  "web_url",
  "viewUrl",
  "view_url",
  "browserUrl",
  "browser_url",
  "shareUrl",
  "share_url",
  "permalink",
  "permalink_url",
  "link",
  "href",
];

function resolveContext(action, wrapper) {
  const sources = [action, wrapper].filter(Boolean);

  const meeting = resolveContextEntity(
    [
      ...sources.map((source) => source?.meeting),
      ...sources.map((source) =>
        buildContextFallback(source, ["meeting", "meeting_info", "meetingDetails"], [
          "meetingTitle",
          "meeting_title",
          "meetingName",
          "meeting_name",
        ])
      ),
    ]
  );

  if (meeting) {
    return { label: `Meeting: ${meeting.label}`, url: normalizeUrl(meeting.url) };
  }

  const stream = resolveContextEntity(
    [
      ...sources.map((source) => source?.stream),
      ...sources.map((source) =>
        buildContextFallback(source, ["stream", "stream_info", "streamDetails"], [
          "streamTitle",
          "stream_title",
          "streamName",
          "stream_name",
        ])
      ),
    ]
  );

  if (stream) {
    return { label: `Stream: ${stream.label}`, url: normalizeUrl(stream.url) };
  }

  const note = resolveContextEntity(
    [
      ...sources.map((source) => source?.note),
      ...sources.map((source) =>
        buildContextFallback(source, ["note", "note_info", "noteDetails"], [
          "noteTitle",
          "note_title",
          "noteName",
          "note_name",
        ])
      ),
    ]
  );

  if (note) {
    return { label: `Note: ${note.label}`, url: normalizeUrl(note.url) };
  }

  return { label: "Fellow", url: "" };
}

function buildContextFallback(source, objectKeys, valueKeys) {
  if (!source || typeof source !== "object") {
    return null;
  }

  for (const objectKey of objectKeys) {
    const nested = source[objectKey];

    if (nested && typeof nested === "object") {
      return nested;
    }
  }

  const label = valueKeys
    .map((key) => source[key])
    .find((value) => typeof value === "string" && value.trim());

  const url = CONTEXT_URL_FIELDS.map((key) => source[key])
    .concat(extractLinks(source))
    .find((value) => typeof value === "string" && value.trim());

  if (!label && !url) {
    return null;
  }

  return { label, url };
}

function resolveContextEntity(candidates) {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const label = CONTEXT_LABEL_FIELDS
      .map((field) => candidate[field])
      .find((value) => typeof value === "string" && value.trim());

    const url = CONTEXT_URL_FIELDS.map((field) => candidate[field])
      .concat(extractLinks(candidate))
      .find((value) => typeof value === "string" && value.trim());

    if (label) {
      return { label: label.trim(), url: url || "" };
    }
  }

  return null;
}

function extractLinks(source) {
  if (!source || typeof source !== "object") {
    return [];
  }

  const links = source.links;

  if (!links || typeof links !== "object") {
    return [];
  }

  return Object.values(links).filter((value) => typeof value === "string");
}

const ITEM_URL_FIELDS = [
  "url",
  "webUrl",
  "web_url",
  "htmlUrl",
  "html_url",
  "viewUrl",
  "view_url",
  "browserUrl",
  "browser_url",
  "shareUrl",
  "share_url",
  "permalink",
  "permalink_url",
  "appUrl",
  "app_url",
  "link",
  "href",
];

function collectItemUrlCandidates(...sources) {
  const urls = [];

  for (const source of sources) {
    if (!source) {
      continue;
    }

    if (typeof source === "string") {
      urls.push(source);
      continue;
    }

    if (typeof source !== "object") {
      continue;
    }

    for (const field of ITEM_URL_FIELDS) {
      const value = source[field];

      if (typeof value === "string") {
        urls.push(value);
      }
    }

    urls.push(...extractLinks(source));
  }

  return urls;
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
    data.action_items,
    data.items,
    data.results
  );

  collectRestActionItemContainers(data, containers);

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
    const title =
      action?.content?.trim() ||
      action?.title?.trim() ||
      stripHtml(action?.summary) ||
      stripHtml(action?.description) ||
      "Untitled action item";
    const description =
      stripHtml(action?.htmlContent) ||
      stripHtml(action?.html_content) ||
      stripHtml(wrapper?.htmlContent) ||
      stripHtml(wrapper?.html_content) ||
      stripHtml(action?.description_html) ||
      stripHtml(wrapper?.description_html) ||
      stripHtml(action?.description) ||
      stripHtml(wrapper?.description) ||
      stripHtml(action?.summary_html) ||
      stripHtml(wrapper?.summary_html) ||
      stripHtml(action?.summary) ||
      stripHtml(wrapper?.summary) ||
      action?.summary?.trim() ||
      action?.notes?.trim() ||
      action?.content?.trim() ||
      "";

    const dueDate =
      action?.dueDate ||
      action?.due_date ||
      action?.due ||
      action?.due_on ||
      wrapper?.dueDate ||
      wrapper?.due_date ||
      wrapper?.due ||
      wrapper?.due_on ||
      null;
    const status = action?.status || wrapper?.status || null;

    const candidateUrls = [
      ...collectItemUrlCandidates(action, wrapper),
      context.url,
    ];

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

function collectRestActionItemContainers(data, containers) {
  const queue = [];
  const visited = new Set();

  if (data && typeof data === "object") {
    queue.push({ node: data, note: null });
  }

  while (queue.length > 0) {
    const { node: current, note: currentNote } = queue.shift();

    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }

    visited.add(current);
    const processedArrays = new Set();

    for (const key of ["notes", "action_items", "actionItems", "items", "results", "data"]) {
      if (!(key in current)) {
        continue;
      }

      const value = current[key];

      if (!value) {
        continue;
      }

      if (key === "notes") {
        const noteCandidates = Array.isArray(value) ? value : [value];

        for (const note of noteCandidates) {
          if (!note || typeof note !== "object") {
            continue;
          }

          queue.push({ node: note, note });
        }

        continue;
      }

      if (key === "action_items" || key === "actionItems") {
        if (Array.isArray(value)) {
          if (processedArrays.has(value)) {
            continue;
          }

          processedArrays.add(value);
          containers.push(value.map((item) => enrichActionItemWithNoteContext(item, currentNote)));
        } else if (typeof value === "object") {
          queue.push({ node: value, note: currentNote });
        }

        continue;
      }

      if (Array.isArray(value)) {
        if (processedArrays.has(value)) {
          continue;
        }

        processedArrays.add(value);
        containers.push(value.map((item) => enrichActionItemWithNoteContext(item, currentNote)));

        for (const item of value) {
          if (item && typeof item === "object") {
            queue.push({ node: item, note: currentNote });
          }
        }
      } else if (typeof value === "object") {
        queue.push({ node: value, note: currentNote });
      }
    }
  }
}

function enrichActionItemWithNoteContext(action, note) {
  if (!action || typeof action !== "object" || !note || typeof note !== "object") {
    return action;
  }

  const hasMeeting = Boolean(
    action.meeting ||
      action.meeting_info ||
      action.meetingDetails ||
      action.meetingTitle ||
      action.meeting_title
  );
  const hasStream = Boolean(
    action.stream ||
      action.stream_info ||
      action.streamDetails ||
      action.streamTitle ||
      action.stream_title
  );

  const noteContext = buildNoteContext(note);

  if (!noteContext && hasMeeting && hasStream) {
    return action;
  }

  const enriched = { ...action };

  if (noteContext && (!enriched.note || typeof enriched.note !== "object")) {
    enriched.note = noteContext;
  }

  if (!hasMeeting) {
    const meetingContext = buildContextFallback(
      note,
      ["meeting", "meeting_info", "meetingDetails"],
      ["meetingTitle", "meeting_title", "meetingName", "meeting_name"]
    );

    if (meetingContext) {
      enriched.meeting = meetingContext;
    }
  }

  if (!hasStream) {
    const streamContext = buildContextFallback(
      note,
      ["stream", "stream_info", "streamDetails"],
      ["streamTitle", "stream_title", "streamName", "stream_name"]
    );

    if (streamContext) {
      enriched.stream = streamContext;
    }
  }

  return enriched;
}

function buildNoteContext(note) {
  if (!note || typeof note !== "object") {
    return null;
  }

  const directContext = buildContextFallback(
    note,
    ["note", "note_info", "noteDetails"],
    ["noteTitle", "note_title", "noteName", "note_name", "title", "name"]
  );

  if (directContext) {
    const context = {};

    if (directContext.label) {
      context.title = directContext.label;
      context.label = directContext.label;
    }

    if (directContext.url) {
      context.url = directContext.url;
    }

    return context;
  }

  const labelCandidate = [
    note.title,
    note.name,
    note.subject,
    note.noteTitle,
    note.note_title,
    note.noteName,
    note.note_name,
  ].find((value) => typeof value === "string" && value.trim());

  const urlCandidate = CONTEXT_URL_FIELDS.map((field) => note[field])
    .concat([note.noteUrl, note.note_url])
    .find((value) => typeof value === "string" && value.trim());

  if (!labelCandidate && !urlCandidate) {
    return null;
  }

  const context = {};

  if (labelCandidate) {
    const trimmed = labelCandidate.trim();
    context.title = trimmed;
    context.label = trimmed;
  }

  if (urlCandidate) {
    context.url = urlCandidate;
  }

  return context;
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

function buildNotesBaseCandidates(baseUrl) {
  const candidates = [];
  const seen = new Set();

  function addCandidate(candidate) {
    if (!candidate) {
      return;
    }

    const normalizedCandidate = ensureBaseUrl(candidate);

    if (seen.has(normalizedCandidate)) {
      return;
    }

    seen.add(normalizedCandidate);
    candidates.push(normalizedCandidate);
  }

  const normalizedBaseUrl = ensureBaseUrl(baseUrl);
  addCandidate(normalizedBaseUrl);

  try {
    const parsed = new URL(normalizedBaseUrl);
    const protocol = parsed.protocol || "https:";
    const pathname = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    const port = parsed.port ? `:${parsed.port}` : "";
    const hostLower = parsed.hostname.toLowerCase();

    if (!hostLower.startsWith("api.")) {
      addCandidate(`${protocol}//api.${parsed.hostname}${port}${pathname}`);
    }

    if (hostLower === "fellow.app" || hostLower.endsWith(".fellow.app")) {
      addCandidate(`${protocol}//api.fellow.app${port}${pathname}`);
    }

    if (hostLower === "fellow.ai" || hostLower.endsWith(".fellow.ai")) {
      addCandidate(`${protocol}//api.fellow.ai${port}${pathname}`);
    }
  } catch (error) {
    // Ignore parsing failures and rely on the normalized base URL.
  }

  return candidates;
}

function buildNotesEndpointCandidates(baseUrl) {
  const baseCandidates = buildNotesBaseCandidates(baseUrl);
  const pathCandidates = [
    "/apps/api/v1/notes/list",
    "/api/v1/notes/list",
    "/apps/v1/notes/list",
    "/v1/notes/list",
  ];
  const endpoints = [];
  const seen = new Set();

  for (const baseCandidate of baseCandidates) {
    for (const pathCandidate of pathCandidates) {
      const endpoint = buildUrl(baseCandidate, pathCandidate);
      const key = endpoint.toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

function buildNotesRequestConfigs(baseUrl, limit) {
  const endpoints = buildNotesEndpointCandidates(baseUrl);
  const body = buildNotesRequestBody(limit);

  return endpoints.map((endpoint) => ({
    url: endpoint,
    body,
  }));
}

function buildNotesRequestBody(limit) {
  const payload = {
    include: {
      action_items: true,
    },
    filters: {
      note_filters: {
        action_item_assignee: "me",
        action_item_status: "open",
      },
    },
  };

  if (Number.isFinite(limit) && limit > 0) {
    payload.page_size = Math.min(Math.max(limit, 1), 200);
  }

  return JSON.stringify(payload);
}

const GRAPHQL_ACTION_ITEMS_QUERY = `
  query AssignedActionItems($first: Int) {
    viewer {
      assignedActionItems(first: $first) {
        edges {
          node {
            id
            content
            title
            description
            dueDate
            status
            url
            htmlUrl
            webUrl
            note {
              title
              url
            }
            stream {
              name
              url
            }
            meeting {
              title
              url
            }
          }
        }
      }
    }
  }
`;

async function fetchAssignedActionItemsViaGraphql(baseUrl, authHeaderOptions, limit) {
  const graphqlUrl = buildGraphqlUrl(baseUrl);
  const variables = {};

  if (Number.isFinite(limit) && limit > 0) {
    variables.first = limit;
  }

  const body = JSON.stringify({
    query: GRAPHQL_ACTION_ITEMS_QUERY,
    variables,
  });

  let lastAuthError = null;
  let lastError = null;

  for (const authHeaders of authHeaderOptions) {
    let response;

    try {
      response = await fetch(graphqlUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body,
      });
    } catch (error) {
      lastError = error;
      continue;
    }

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
        payload?.error ||
        payload?.message ||
        payload?.errors?.[0]?.message ||
        payload?.title ||
        "Failed to load Fellow action items.";
      const error = new Error(message);
      error.status = response.status;

      if ((response.status === 401 || response.status === 403) && authHeaderOptions.length > 1) {
        lastAuthError = error;
        continue;
      }

      throw error;
    }

    if (payload?.errors?.length) {
      const message = payload.errors.map((err) => err?.message).filter(Boolean).join("; ");
      const error = new Error(message || "Failed to load Fellow action items.");
      error.status = response.status || 400;
      throw error;
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Unexpected response from Fellow.");
    }

    const graphqlData = payload.data;

    if (graphqlData && typeof graphqlData === "object") {
      return graphqlData;
    }

    return payload;
  }

  if (lastAuthError) {
    throw lastAuthError;
  }

  if (lastError) {
    throw lastError;
  }

  const authError = new Error("Failed to authenticate with Fellow using the provided token.");
  authError.status = 401;
  throw authError;
}

async function requestNotes({ url, body }, authHeaderOptions) {
  let lastAuthError = null;

  for (const authHeaders of authHeaderOptions) {
    let response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body,
      });
    } catch (error) {
      return { error, shouldRetry: true };
    }

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = null;
      }
    }

    if (response.ok) {
      if (!payload || typeof payload !== "object") {
        return { error: new Error("Unexpected response from Fellow.") };
      }

      return { payload };
    }

    const message =
      payload?.error || payload?.message || payload?.errors?.[0]?.message || payload?.title;
    const error = new Error(message || "Failed to load Fellow action items.");
    error.status = response.status;

    if ((response.status === 401 || response.status === 403) && authHeaderOptions.length > 1) {
      lastAuthError = error;
      continue;
    }

    if (response.status === 404) {
      return { error, notFound: true };
    }

    return { error };
  }

  if (lastAuthError) {
    return { error: lastAuthError };
  }

  const authError = new Error("Failed to authenticate with Fellow using the provided token.");
  authError.status = 401;
  return { error: authError };
}

async function fetchAssignedActionItems(baseUrl, token, limit) {
  const authHeaderOptions = buildAuthHeaderOptions(token);

  if (authHeaderOptions.length === 0) {
    const error = new Error("Fellow API token is missing.");
    error.status = 401;
    throw error;
  }

  const requestConfigs = buildNotesRequestConfigs(baseUrl, limit);

  let notFoundError = null;
  let lastRetryableError = null;

  for (const requestConfig of requestConfigs) {
    const { payload, error, notFound, shouldRetry } = await requestNotes(
      requestConfig,
      authHeaderOptions
    );

    if (payload) {
      return payload;
    }

    if (notFound) {
      notFoundError = error;
      continue;
    }

    if (error) {
      if (shouldRetry) {
        lastRetryableError = error;
        continue;
      }
      throw error;
    }
  }

  if (notFoundError) {
    try {
      return await fetchAssignedActionItemsViaGraphql(baseUrl, authHeaderOptions, limit);
    } catch (graphqlError) {
      const enhancedError = new Error(
        "Fellow action items endpoint was not found and the GraphQL fallback also failed. Please verify the configured FELLOW_API_BASE_URL matches the REST or GraphQL API host (for example, https://api.fellow.app)."
      );
      enhancedError.status = graphqlError.status || notFoundError.status || 404;
      enhancedError.cause = graphqlError;
      throw enhancedError;
    }
  }

  if (lastRetryableError) {
    throw lastRetryableError;
  }

  throw new Error("Failed to load Fellow action items.");
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

export {
  mapActionItemsToTasks,
  resolveContext,
  stripHtml,
  normalizeUrl,
  fetchAssignedActionItems,
};
