import { Octokit } from "@octokit/rest";
import { google } from "googleapis";
import { createClient } from "../../lib/supabase/api";

async function getUserIntegration(supabase, userId, provider) {
  const { data, error } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (error || !data) {
    throw new Error(`${provider} not connected`);
  }

  return data;
}

async function addGitHubComment(task, comment, accessToken) {
  const octokit = new Octokit({ auth: accessToken });
  const [owner, repo] = task.repo.split("/");

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: task.issue_number,
    body: comment,
  });
}

async function addGoogleTaskNote(task, comment, accessToken, refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  // Get current notes
  const response = await tasksApi.tasks.get({
    tasklist: task.googleTaskListId,
    task: task.googleTaskId,
  });

  const currentNotes = response.data.notes || "";
  const timestamp = new Date().toLocaleString();
  const newNotes = currentNotes
    ? `${currentNotes}\n\n---\n${timestamp}:\n${comment}`
    : `${timestamp}:\n${comment}`;

  await tasksApi.tasks.update({
    tasklist: task.googleTaskListId,
    task: task.googleTaskId,
    requestBody: {
      id: task.googleTaskId,
      notes: newNotes,
    },
  });
}

async function addTrelloComment(task, comment, accessToken) {
  const response = await fetch(
    `https://api.trello.com/1/cards/${task.trelloCardId}/actions/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: comment,
        key: process.env.TRELLO_API_KEY,
        token: accessToken,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to add Trello comment");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = createClient(req, res);

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { task, comment } = req.body;

  if (!task || !comment?.trim()) {
    return res.status(400).json({ error: "Task and comment are required" });
  }

  try {
    const source = task.source;

    switch (source) {
      case "GitHub": {
        const { access_token } = await getUserIntegration(supabase, user.id, "github");
        await addGitHubComment(task, comment, access_token);
        break;
      }

      case "Google Tasks": {
        const { access_token, refresh_token } = await getUserIntegration(supabase, user.id, "google");
        await addGoogleTaskNote(task, comment, access_token, refresh_token);
        break;
      }

      case "Trello":
      case "Fellow": {
        const { access_token } = await getUserIntegration(supabase, user.id, "trello");
        await addTrelloComment(task, comment, access_token);
        break;
      }

      default:
        return res.status(400).json({ error: `Unsupported task source: ${source}` });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error adding comment:", error);
    return res.status(500).json({
      error: "Failed to add comment",
      details: error.message,
    });
  }
}
