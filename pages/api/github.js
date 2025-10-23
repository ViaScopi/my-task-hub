// pages/api/github.js
import { Octokit } from "@octokit/rest";
import { createClient } from "../../lib/supabase/api";

async function getUserGitHubToken(supabase, userId) {
  const { data, error } = await supabase
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", userId)
    .eq("provider", "github")
    .single();

  if (error || !data) {
    throw new Error("GitHub not connected. Please connect your GitHub account in Settings.");
  }

  return data.access_token;
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

  try {
    // Get user's GitHub token from database
    const githubToken = await getUserGitHubToken(supabase, user.id);
    const octokit = new Octokit({ auth: githubToken });

    if (req.method === "GET") {
      try {
        // Get all open issues assigned to the authenticated user
        const { data } = await octokit.rest.issues.listForAuthenticatedUser({
          filter: "assigned",
          state: "open",
          per_page: 50,
        });

        const tasks = data.map((issue) => ({
          id: `github-${issue.id}`,
          source: "GitHub",
          title: issue.title,
          url: issue.html_url,
          repo: issue.repository.full_name,
          issue_number: issue.number,
          description: issue.body || "",
        }));

        return res.status(200).json(tasks);
      } catch (err) {
        console.error("GitHub API error:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    if (req.method === "POST") {
      try {
        const { owner, repo, issue_number, comment } = req.body;

        const trimmedComment = comment?.trim();

        if (trimmedComment) {
          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number,
            body: trimmedComment,
          });
        }

        await octokit.rest.issues.update({
          owner,
          repo,
          issue_number,
          state: "closed",
        });

        return res.status(200).json({ success: true });
      } catch (err) {
        console.error("Error closing issue:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error("GitHub integration error:", error);
    return res.status(503).json({ error: error.message });
  }
}
