const DEFAULT_ENDPOINT = "https://fellow.app/graphql";
const DEFAULT_LIMIT = 100;

const MISSING_CREDENTIALS_ERROR = "MISSING_FELLOW_CREDENTIALS";

function getEndpoint() {
  return process.env.FELLOW_GRAPHQL_ENDPOINT?.trim() || DEFAULT_ENDPOINT;
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

const DEFAULT_QUERY = /* GraphQL */ `
  query AssignedActionItems($first: Int!) {
    viewer {
      id
      actionItems: assignedActionItems(first: $first) {
        nodes {
          id
          content
          htmlContent
          url
          dueDate
          status
          meeting {
            id
            title
            url
          }
          stream {
            id
            name
            url
          }
        }
      }
    }
  }
`;

const FALLBACK_QUERIES = [
  /* GraphQL */ `
    query AssignedActionItems($first: Int!) {
      viewer {
        id
        actionItems: assignedActionItems(first: $first) {
          nodes {
            id
            content
            htmlContent
            url
            dueDate
            status
            meeting {
              id
              title
              url
            }
            stream {
              id
              name
              url
            }
          }
        }
      }
    }
  `,
  /* GraphQL */ `
    query AssignedActionItems($first: Int!) {
      viewer {
        id
        actionItemAssignments(first: $first) {
          nodes {
            id
            url
            dueDate
            status
            meeting {
              id
              title
              url
            }
            stream {
              id
              name
              url
            }
            actionItem {
              id
              content
              htmlContent
              url
              dueDate
              status
              meeting {
                id
                title
                url
              }
              stream {
                id
                name
                url
              }
            }
          }
        }
      }
    }
  `,
  /* GraphQL */ `
    query AssignedActionItems($first: Int!) {
      viewer {
        id
        actionItems(first: $first) {
          nodes {
            id
            content
            htmlContent
            url
            dueDate
            status
            meeting {
              id
              title
              url
            }
            stream {
              id
              name
              url
            }
          }
        }
      }
    }
  `,
];

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

  return `https://fellow.app${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
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

  const viewer = data.viewer || data.me || data.currentUser;

  if (viewer) {
    containers.push(
      viewer.assignedActionItems,
      viewer.actionItems,
      viewer.actionItemAssignments,
      viewer.tasks,
      viewer.items
    );
  }

  containers.push(data.assignedActionItems, data.actionItems, data.actionItemAssignments);

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
    const normalizedUrl = candidateUrls.map(normalizeUrl).find(Boolean) || "https://fellow.app";

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

function buildAuthHeaderOptions(token) {
  const trimmedToken = token.trim();

  if (!trimmedToken) {
    return [];
  }

  if (AUTH_HEADER_PREFIX_PATTERN.test(trimmedToken)) {
    return [{ Authorization: trimmedToken }];
  }

  const candidates = [
    { Authorization: `Bearer ${trimmedToken}` },
    { Authorization: trimmedToken },
    { Authorization: `Token token=${trimmedToken}` },
    { "X-Api-Key": trimmedToken },
  ];

  const seen = new Set();

  return candidates.filter((headers) => {
    const key = Object.entries(headers)
      .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
      .map(([headerKey, value]) => `${headerKey.toLowerCase()}:${value}`)
      .join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function validateGraphQLPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected response from Fellow.");
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const [firstError] = payload.errors;
    const message = firstError?.message || "Failed to load Fellow action items.";
    throw new Error(message);
  }

  return payload.data;
}

async function executeQuery(endpoint, token, query, variables) {
  const authHeaderOptions = buildAuthHeaderOptions(token);

  if (authHeaderOptions.length === 0) {
    const error = new Error("Fellow API token is missing.");
    error.status = 401;
    throw error;
  }

  let lastAuthError = null;

  for (const authHeaders of authHeaderOptions) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload?.error || payload?.message || payload?.errors?.[0]?.message;
      const error = new Error(message || "Failed to load Fellow action items.");
      error.status = response.status;

      if ((response.status === 401 || response.status === 403) && authHeaderOptions.length > 1) {
        lastAuthError = error;
        continue;
      }

      throw error;
    }

    return validateGraphQLPayload(payload);
  }

  throw lastAuthError || new Error("Failed to authenticate with Fellow using the provided token.");
}

function queryUsesVariable(query, variableName) {
  const regex = new RegExp(`\\$${variableName}\\b`);
  return regex.test(query);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const token = ensureConfiguredToken();
    const endpoint = getEndpoint();
    const limit = getLimit();
    const assigneeId = process.env.FELLOW_ASSIGNEE_ID?.trim();

    const customQuery = process.env.FELLOW_ACTIONS_QUERY?.trim();
    const queries = customQuery ? [customQuery] : [DEFAULT_QUERY, ...FALLBACK_QUERIES];

    let lastError;
    let emptyResult = null;


    for (const query of queries) {
      try {
        const variables = { first: limit };

        if (queryUsesVariable(query, "assigneeId")) {
          variables.assigneeId = assigneeId || null;
        }

        const data = await executeQuery(endpoint, token, query, variables);
        const tasks = mapActionItemsToTasks(data);

        if (tasks.length) {
          return res.status(200).json(tasks);
        }

        if (emptyResult === null) {
          emptyResult = tasks;
        }

        if (customQuery) {

          return res.status(200).json(tasks);
        }

        lastError = new Error("No action items were returned from Fellow.");
      } catch (error) {
        lastError = error;

        if (customQuery) {
          break;
        }

        if (process.env.NODE_ENV !== "production") {
          console.warn("Fellow query attempt failed:", error.message);
        }
      }
    }

    if (emptyResult !== null) {
      return res.status(200).json(emptyResult);
    }

    throw lastError || new Error("Failed to load Fellow action items.");
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
