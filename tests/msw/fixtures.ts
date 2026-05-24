export const ghRepoRaw = {
  id: 12345,
  name: "commit-to-blog",
  full_name: "octocat/commit-to-blog",
  private: false,
  description: "Generate blog posts from commits",
  default_branch: "main",
  updated_at: "2026-05-20T10:00:00Z",
  html_url: "https://github.com/octocat/commit-to-blog",
};

export const ghBranchRaw = {
  name: "main",
  commit: { sha: "abc123def456", url: "https://api.github.com/" },
  protected: true,
};

export const ghCommitRaw = {
  sha: "feedfacecafe1234567890",
  html_url: "https://github.com/octocat/commit-to-blog/commit/feedface",
  commit: {
    message: "feat: ship the thing\n\nbody line",
    author: { name: "Octo Cat", email: "octo@cat.dev", date: "2026-05-19T09:00:00Z" },
  },
  author: { login: "octocat", id: 1 },
};
