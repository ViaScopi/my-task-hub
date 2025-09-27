const TASKS_BASE_URL = "https://tasks.googleapis.com/tasks/v1";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const MISSING_CREDENTIALS_ERROR = "MISSING_GOOGLE_TASKS_CREDENTIALS";

function getConfiguredListIds() {
  const raw = process.env.GOOGLE_TASKS_LIST_IDS;

  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    const error = new Error(
      "Google Tasks integration is not configured. Please provide GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables."
    );
    error.code = MISSING_CREDENTIALS_ERROR;
    throw error;
  }

  return { clientId, clientSecret, refreshToken };
}

async function getAccessToken() {
  const { clientId, clientSecret, refreshToken } = getOAuthConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.error_description || data?.error || "Failed to refresh Google access token.";
    throw new Error(message);
  }

  const data = await response.json();
  const accessToken = data?.access_token;

  if (!accessToken) {
    throw new Error("Google access token response did not include an access_token.");
  }

  return accessToken;
}

async function fetchTaskLists(accessToken) {
  const configuredIds = getConfiguredListIds();
  const lists = [];
  let pageToken;

  do {
    const url = new URL(`${TASKS_BASE_URL}/users/@me/lists`);
    url.searchParams.set("maxResults", "100");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = data?.error?.message || "Failed to retrieve Google Task lists.";
      throw new Error(message);
    }

    const data = await response.json();
    if (Array.isArray(data.items)) {
      lists.push(...data.items);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  if (!configuredIds.length) {
    return lists;
  }

  const listMap = new Map(lists.map((list) => [list.id, list]));
  const filteredLists = configuredIds.map((id) => listMap.get(id)).filter(Boolean);

  return filteredLists;
}

async function fetchTasksForList(accessToken, listId) {
  const tasks = [];
  let pageToken;

  do {
    const url = new URL(`${TASKS_BASE_URL}/lists/${encodeURIComponent(listId)}/tasks`);
    url.searchParams.set("maxResults", "100");
    url.searchParams.set("showCompleted", "false");
    url.searchParams.set("showDeleted", "false");
    url.searchParams.set("showHidden", "false");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = data?.error?.message || `Failed to retrieve tasks for Google Task list ${listId}.`;
      throw new Error(message);
    }

    const data = await response.json();
    if (Array.isArray(data.items)) {
      tasks.push(...data.items);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return tasks;
}

function mapTaskToResponse(task, list, pipelineOptions) {
  return {
    id: `google-${task.id}`,
    source: "Google Tasks",
    title: task.title || "Untitled task",
    url: `https://tasks.google.com/embed/list/${encodeURIComponent(list.id)}?task=${encodeURIComponent(task.id)}`,
    repo: list.title,
    description: task.notes || "",
    pipelineId: list.id,
    pipelineName: list.title,
    pipelineOptions,
    googleTaskId: task.id,
    googleTaskListId: list.id,
    status: task.status,
    due: task.due || null,
  };
}

function buildInsertPayload(task) {
  const payload = {
    title: task.title || "Untitled task",
  };

  if (task.notes) {
    payload.notes = task.notes;
  }

  if (task.due) {
    payload.due = task.due;
  }

  if (task.status) {
    payload.status = task.status;
  }

  if (Array.isArray(task.links) && task.links.length) {
    payload.links = task.links.map((link) => ({
      description: link.description,
      link: link.link,
      type: link.type,
    }));
  }

  return payload;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const accessToken = await getAccessToken();
      const lists = await fetchTaskLists(accessToken);

      if (!lists.length) {
        return res.status(200).json([]);
      }

      const pipelineOptions = lists.map((list) => ({ id: list.id, name: list.title }));

      const tasksByList = await Promise.all(
        lists.map(async (list) => {
          const listTitle = typeof list?.title === "string" ? list.title.trim() : "";

          if (listTitle.toLowerCase() === "completed tasks") {
            return [];
          }

          try {
            const tasks = await fetchTasksForList(accessToken, list.id);
            return tasks.map((task) => mapTaskToResponse(task, list, pipelineOptions));
          } catch (error) {
            console.error(`Failed to load Google Tasks for list ${list.id}:`, error);
            return [];
          }
        })
      );

      const tasks = tasksByList.flat();

      return res.status(200).json(tasks);
    } catch (error) {
      if (error.code === MISSING_CREDENTIALS_ERROR) {
        return res.status(503).json({ error: error.message });
      }

      console.error("Google Tasks API error:", error);
      return res.status(500).json({ error: error.message || "Failed to load Google Tasks." });
    }
  }

  if (req.method === "POST") {
    try {
      const { taskId, currentListId, targetListId } = req.body || {};

      if (!taskId || !currentListId || !targetListId) {
        return res.status(400).json({ error: "taskId, currentListId, and targetListId are required." });
      }

      if (targetListId === currentListId) {
        return res.status(200).json({
          success: true,
          task: { id: taskId, tasklist: currentListId },
        });
      }

      const accessToken = await getAccessToken();

      const currentTaskResponse = await fetch(
        `${TASKS_BASE_URL}/lists/${encodeURIComponent(currentListId)}/tasks/${encodeURIComponent(taskId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!currentTaskResponse.ok) {
        const data = await currentTaskResponse.json().catch(() => null);
        const message = data?.error?.message || "Unable to retrieve the Google Task to update.";
        throw new Error(message);
      }

      const currentTask = await currentTaskResponse.json();
      const insertPayload = buildInsertPayload(currentTask);

      const insertResponse = await fetch(
        `${TASKS_BASE_URL}/lists/${encodeURIComponent(targetListId)}/tasks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(insertPayload),
        }
      );

      if (!insertResponse.ok) {
        const data = await insertResponse.json().catch(() => null);
        const message = data?.error?.message || "Failed to move the Google Task to the selected pipeline.";
        throw new Error(message);
      }

      const insertedTask = await insertResponse.json();

      const deleteResponse = await fetch(
        `${TASKS_BASE_URL}/lists/${encodeURIComponent(currentListId)}/tasks/${encodeURIComponent(taskId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!deleteResponse.ok) {
        const data = await deleteResponse.json().catch(() => null);
        const message = data?.error?.message || "The Google Task was moved but removing the original entry failed.";
        throw new Error(message);
      }

      return res.status(200).json({
        success: true,
        task: {
          id: insertedTask.id,
          tasklist: targetListId,
          status: insertedTask.status,
        },
      });
    } catch (error) {
      if (error.code === MISSING_CREDENTIALS_ERROR) {
        return res.status(503).json({ error: error.message });
      }

      console.error("Error updating Google Task pipeline:", error);
      return res.status(500).json({ error: error.message || "Failed to update Google Task." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
