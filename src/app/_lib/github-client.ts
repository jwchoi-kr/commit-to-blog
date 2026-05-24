import { z } from "zod";

export const repoSchema = z.object({
  id: z.number(),
  fullName: z.string(),
  defaultBranch: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
  updatedAt: z.string().nullable(),
  htmlUrl: z.string(),
});

export const branchSchema = z.object({
  name: z.string(),
  sha: z.string(),
  protected: z.boolean(),
});

export const commitSchema = z.object({
  sha: z.string(),
  message: z.string(),
  authorName: z.string().nullable(),
  authorLogin: z.string().nullable(),
  date: z.string().nullable(),
  htmlUrl: z.string(),
});

export type Repo = z.infer<typeof repoSchema>;
export type Branch = z.infer<typeof branchSchema>;
export type Commit = z.infer<typeof commitSchema>;

const errorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  retryAfterSec: z.number().optional(),
});

export class GitHubApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSec?: number;
  constructor(status: number, code: string, message: string, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

async function getJson<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, credentials: "same-origin" });
  if (!res.ok) {
    const body = errorBodySchema.safeParse(await res.json().catch(() => null));
    if (body.success) {
      throw new GitHubApiError(
        res.status,
        body.data.code,
        body.data.message,
        body.data.retryAfterSec,
      );
    }
    throw new GitHubApiError(res.status, "unknown", `Request failed (${res.status})`);
  }
  const json = await res.json();
  return schema.parse(json);
}

export function fetchRepos(q?: string, signal?: AbortSignal): Promise<Repo[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const qs = params.toString();
  return getJson(`/api/github/repos${qs ? `?${qs}` : ""}`, z.array(repoSchema), signal);
}

export function fetchBranches(
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<Branch[]> {
  const params = new URLSearchParams({ owner, repo });
  return getJson(`/api/github/branches?${params}`, z.array(branchSchema), signal);
}

export function fetchCommits(
  owner: string,
  repo: string,
  branch: string,
  signal?: AbortSignal,
): Promise<Commit[]> {
  const params = new URLSearchParams({ owner, repo, branch });
  return getJson(`/api/github/commits?${params}`, z.array(commitSchema), signal);
}
