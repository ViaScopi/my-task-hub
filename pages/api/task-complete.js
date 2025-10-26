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

async function completeGitHubTask(task, note, accessToken) {
  const octokit = new Octokit({ auth: accessToken });
  const [owner, repo] = task.repo.split("/");

  // Add completion comment
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: task.issue_number,
    body: note || "Completed via My Task Hub",
  });

  // Close the issue
  await octokit.issues.update({
    owner,
    repo,
    issue_number: task.issue_number,
    state: "closed",
  });
}

async function completeGoogleTask(task, note, accessToken, refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  // Add completion note if provided
  if (note) {
    const response = await tasksApi.tasks.get({
      tasklist: task.googleTaskListId,
      task: task.googleTaskId,
    });

    const currentNotes = response.data.notes || "";
    const timestamp = new Date().toLocaleString();
    const newNotes = currentNotes
      ? `${currentNotes}\n\n---\nCompleted ${timestamp}:\n${note}`
      : `Completed ${timestamp}:\n${note}`;

    await tasksApi.tasks.update({
      tasklist: task.googleTaskListId,
      task: task.googleTaskId,
      requestBody: {
        id: task.googleTaskId,
        notes: newNotes,
      },
    });
  }

  // Mark as completed
  await tasksApi.tasks.update({
    tasklist: task.googleTaskListId,
    task: task.googleTaskId,
    requestBody: {
      id: task.googleTaskId,
      status: "completed",
    },
  });
}

async function completeTrelloTask(task, note, accessToken) {
  // Add comment if provided
  if (note) {
    await fetch(`https://api.trello.com/1/cards/${task.trelloCardId}/actions/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Completed: ${note}`,
        key: process.env.TRELLO_API_KEY,
        token: accessToken,
      }),
    });
  }

  // Archive the card
  await fetch(`https://api.trello.com/1/cards/${task.trelloCardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      closed: true,
      key: process.env.TRELLO_API_KEY,
      token: accessToken,
    }),
  });
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

  const { task, note } = req.body;

  if (!task) {
    return res.status(400).json({ error: "Task is required" });
  }

  try {
    const source = task.source;

    // Complete the task in the source system
    switch (source) {
      case "GitHub": {
        const { access_token } = await getUserIntegration(supabase, user.id, "github");
        await completeGitHubTask(task, note, access_token);
        break;
      }

      case "Google Tasks": {
        const { access_token, refresh_token } = await getUserIntegration(supabase, user.id, "google");
        await completeGoogleTask(task, note, access_token, refresh_token);
        break;
      }

      case "Trello":
      case "Fellow": {
        const { access_token } = await getUserIntegration(supabase, user.id, "trello");
        await completeTrelloTask(task, note, access_token);
        break;
      }

      default:
        return res.status(400).json({ error: `Unsupported task source: ${source}` });
    }

    // Task is now completed at the source
    // It will remain visible in the Done column until user archives it
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error completing task:", error);
    return res.status(500).json({
      error: "Failed to complete task",
      details: error.message,
    });
  }
}
