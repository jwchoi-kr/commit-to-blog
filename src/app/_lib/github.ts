import { Octokit } from "octokit";

import { prisma } from "@/app/_lib/prisma";
import { ReauthRequiredError } from "@/app/_lib/errors";

export type RepoDTO = {
  id: number;
  fullName: string;
  defaultBranch: string;
  description: string | null;
  private: boolean;
  updatedAt: string | null;
  htmlUrl: string;
};

export type BranchDTO = {
  name: string;
  sha: string;
  protected: boolean;
};

export type CommitDTO = {
  sha: string;
  message: string;
  authorName: string | null;
  authorLogin: string | null;
  date: string | null;
  htmlUrl: string;
};

export async function getOctokitForUser(userId: string): Promise<Octokit> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
    select: { access_token: true },
  });
  const token = account?.access_token;
  if (!token) throw new ReauthRequiredError();
  return new Octokit({ auth: token });
}

export async function listMyRepos({
  userId,
  q,
}: {
  userId: string;
  q?: string;
}): Promise<RepoDTO[]> {
  const octokit = await getOctokitForUser(userId);
  const raw = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    affiliation: "owner",
    sort: "updated",
    direction: "desc",
    per_page: 100,
  });

  const repos = raw.map(toRepoDTO);
  if (!q) return repos;
  const needle = q.toLowerCase();
  return repos.filter(
    (r) =>
      r.fullName.toLowerCase().includes(needle) ||
      (r.description?.toLowerCase().includes(needle) ?? false),
  );
}

export async function listBranches({
  userId,
  owner,
  repo,
}: {
  userId: string;
  owner: string;
  repo: string;
}): Promise<BranchDTO[]> {
  const octokit = await getOctokitForUser(userId);
  const raw = await octokit.paginate(octokit.rest.repos.listBranches, {
    owner,
    repo,
    per_page: 100,
  });
  return raw.map(toBranchDTO);
}

export async function listCommits({
  userId,
  owner,
  repo,
  branch,
  perPage = 20,
}: {
  userId: string;
  owner: string;
  repo: string;
  branch: string;
  perPage?: number;
}): Promise<CommitDTO[]> {
  const octokit = await getOctokitForUser(userId);
  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    sha: branch,
    per_page: perPage,
  });
  return data.map(toCommitDTO);
}

type RawRepo = {
  id: number;
  full_name: string;
  default_branch: string;
  description: string | null;
  private: boolean;
  updated_at: string | null;
  html_url: string;
};

function toRepoDTO(r: RawRepo): RepoDTO {
  return {
    id: r.id,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    description: r.description,
    private: r.private,
    updatedAt: r.updated_at,
    htmlUrl: r.html_url,
  };
}

type RawBranch = {
  name: string;
  commit: { sha: string };
  protected: boolean;
};

function toBranchDTO(b: RawBranch): BranchDTO {
  return {
    name: b.name,
    sha: b.commit.sha,
    protected: b.protected,
  };
}

type RawCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name?: string | null; date?: string | null } | null;
  };
  // octokit's response type for `author` includes `Record<string, never>` for
  // commits whose GitHub account was deleted, so `login` must be optional here.
  author: { login: string } | Record<string, never> | null;
};

function toCommitDTO(c: RawCommit): CommitDTO {
  const login = c.author && "login" in c.author ? c.author.login : null;
  return {
    sha: c.sha,
    message: c.commit.message.split("\n", 1)[0] ?? "",
    authorName: c.commit.author?.name ?? null,
    authorLogin: login,
    date: c.commit.author?.date ?? null,
    htmlUrl: c.html_url,
  };
}
