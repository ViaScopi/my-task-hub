// pages/api/github.js
import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    if (req.method === "GET") {
        try {
            // Fetch issues assigned to authenticated user
            const { data } = await octokit.request("GET /issues", {
                filter: "assigned",
                state: "open",
            });

            // Simplify response
            const tasks = data.map(issue => ({
                id: issue.id,
                source: "GitHub",
                title: issue.title,
                url: issue.html_url,
                repo: issue.repository.full_name,
                issue_number: issue.number,
            }));

            return res.status(200).json(tasks);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    if (req.method === "POST") {
        try {
            const { owner, repo, issue_number } = req.body;

            await octokit.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
                owner,
                repo,
                issue_number,
                state: "closed",
            });

            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
}
