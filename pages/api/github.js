// pages/api/github.js
import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  if (req.method === "GET") {
    try {
      // Get all open issues assigned to the authenticated user
      const { data } = await octokit.rest.issues.listForAuthenticatedUser({
        filter: "assigned",
        state: "open",
        per_page: 50, // adjust if you want more
      });

      const tasks = data.map(issue => ({
        id: issue.id,
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
}
