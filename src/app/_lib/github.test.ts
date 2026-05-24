import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../../../tests/msw/server";
import { ghBranchRaw, ghCommitRaw, ghRepoRaw } from "../../../tests/msw/fixtures";

vi.mock("@/app/_lib/prisma", () => ({
  prisma: { account: { findFirst: vi.fn() } },
}));

import { prisma } from "@/app/_lib/prisma";
import { listBranches, listCommits, listMyRepos } from "@/app/_lib/github";
import { ReauthRequiredError } from "@/app/_lib/errors";

const mockedFindFirst = vi.mocked(prisma.account.findFirst);

beforeEach(() => {
  mockedFindFirst.mockReset();
  mockedFindFirst.mockResolvedValue({ access_token: "gho_test_token" } as never);
});

describe("listMyRepos", () => {
  it("maps GitHub raw response to slim RepoDTO", async () => {
    const repos = await listMyRepos({ userId: "u1" });
    expect(repos).toEqual([
      {
        id: ghRepoRaw.id,
        fullName: ghRepoRaw.full_name,
        defaultBranch: ghRepoRaw.default_branch,
        description: ghRepoRaw.description,
        private: ghRepoRaw.private,
        updatedAt: ghRepoRaw.updated_at,
        htmlUrl: ghRepoRaw.html_url,
      },
    ]);
  });

  it("filters by q against fullName/description (case-insensitive)", async () => {
    server.use(
      http.get("https://api.github.com/user/repos", () =>
        HttpResponse.json([
          ghRepoRaw,
          { ...ghRepoRaw, id: 2, full_name: "octocat/other-repo", description: "unrelated" },
        ]),
      ),
    );
    const repos = await listMyRepos({ userId: "u1", q: "COMMIT" });
    expect(repos).toHaveLength(1);
    expect(repos[0].fullName).toBe("octocat/commit-to-blog");
  });

  it("throws ReauthRequiredError when access_token is missing", async () => {
    mockedFindFirst.mockResolvedValue(null);
    await expect(listMyRepos({ userId: "u1" })).rejects.toBeInstanceOf(ReauthRequiredError);
  });
});

describe("listBranches", () => {
  it("maps GitHub raw branch to BranchDTO", async () => {
    const branches = await listBranches({ userId: "u1", owner: "octocat", repo: "commit-to-blog" });
    expect(branches).toEqual([
      { name: ghBranchRaw.name, sha: ghBranchRaw.commit.sha, protected: ghBranchRaw.protected },
    ]);
  });
});

describe("listCommits", () => {
  it("maps GitHub raw commit to CommitDTO, taking only first message line", async () => {
    const commits = await listCommits({
      userId: "u1",
      owner: "octocat",
      repo: "commit-to-blog",
      branch: "main",
    });
    expect(commits).toEqual([
      {
        sha: ghCommitRaw.sha,
        message: "feat: ship the thing",
        authorName: ghCommitRaw.commit.author.name,
        authorLogin: ghCommitRaw.author.login,
        date: ghCommitRaw.commit.author.date,
        htmlUrl: ghCommitRaw.html_url,
      },
    ]);
  });

  it("handles commit with null author (deleted GitHub account)", async () => {
    server.use(
      http.get("https://api.github.com/repos/:owner/:repo/commits", () =>
        HttpResponse.json([{ ...ghCommitRaw, author: null }]),
      ),
    );
    const [c] = await listCommits({
      userId: "u1",
      owner: "octocat",
      repo: "commit-to-blog",
      branch: "main",
    });
    expect(c.authorLogin).toBeNull();
    expect(c.authorName).toBe(ghCommitRaw.commit.author.name);
  });
});
