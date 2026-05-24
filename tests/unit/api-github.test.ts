import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../msw/server";

vi.mock("@/app/_lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/app/_lib/prisma", () => ({
  prisma: { account: { findFirst: vi.fn() } },
}));

import { auth } from "@/app/_lib/auth";
import { prisma } from "@/app/_lib/prisma";

const mockedAuth = vi.mocked(auth);
const mockedFindFirst = vi.mocked(prisma.account.findFirst);

function setLoggedIn(userId = "u1") {
  mockedAuth.mockResolvedValue({ user: { id: userId } } as unknown as Awaited<
    ReturnType<typeof auth>
  >);
  mockedFindFirst.mockResolvedValue({ access_token: "gho_test" } as never);
}

function setLoggedOut() {
  mockedAuth.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

beforeEach(() => {
  mockedAuth.mockReset();
  mockedFindFirst.mockReset();
});

describe("GET /api/github/repos", () => {
  it("returns 401 when not authenticated", async () => {
    setLoggedOut();
    const { GET } = await import("@/app/api/github/repos/route");
    const res = await GET(new Request("http://localhost/api/github/repos"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("unauthorized");
  });

  it("returns 400 when q is empty string", async () => {
    setLoggedIn();
    const { GET } = await import("@/app/api/github/repos/route");
    const res = await GET(new Request("http://localhost/api/github/repos?q="));
    expect(res.status).toBe(400);
  });

  it("returns 200 + slim RepoDTO[] on success", async () => {
    setLoggedIn();
    const { GET } = await import("@/app/api/github/repos/route");
    const res = await GET(new Request("http://localhost/api/github/repos"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ fullName: string }>;
    expect(body[0].fullName).toBe("octocat/commit-to-blog");
  });

  it("maps GitHub 403 to 429 rate_limited", async () => {
    setLoggedIn();
    server.use(
      http.get("https://api.github.com/user/repos", () =>
        HttpResponse.json(
          { message: "API rate limit exceeded" },
          { status: 403, headers: { "retry-after": "60" } },
        ),
      ),
    );
    const { GET } = await import("@/app/api/github/repos/route");
    const res = await GET(new Request("http://localhost/api/github/repos"));
    expect(res.status).toBe(429);
    const body = (await res.json()) as { code: string; retryAfterSec?: number };
    expect(body.code).toBe("rate_limited");
    expect(body.retryAfterSec).toBe(60);
  });
});

describe("GET /api/github/branches", () => {
  it("returns 400 when owner missing", async () => {
    setLoggedIn();
    const { GET } = await import("@/app/api/github/branches/route");
    const res = await GET(new Request("http://localhost/api/github/branches?repo=foo"));
    expect(res.status).toBe(400);
  });

  it("returns 200 + BranchDTO[] on success", async () => {
    setLoggedIn();
    const { GET } = await import("@/app/api/github/branches/route");
    const res = await GET(
      new Request("http://localhost/api/github/branches?owner=octocat&repo=commit-to-blog"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ name: string; sha: string }>;
    expect(body[0]).toEqual({ name: "main", sha: "abc123def456", protected: true });
  });
});

describe("GET /api/github/commits", () => {
  it("returns 400 when per_page > 50", async () => {
    setLoggedIn();
    const { GET } = await import("@/app/api/github/commits/route");
    const res = await GET(
      new Request("http://localhost/api/github/commits?owner=o&repo=r&branch=main&per_page=999"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 + CommitDTO[] on success", async () => {
    setLoggedIn();
    const { GET } = await import("@/app/api/github/commits/route");
    const res = await GET(
      new Request(
        "http://localhost/api/github/commits?owner=octocat&repo=commit-to-blog&branch=main",
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ message: string }>;
    expect(body[0].message).toBe("feat: ship the thing");
  });
});

describe("reauth required", () => {
  it("returns 401 reauth_required when access_token missing", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "u1" } } as unknown as Awaited<
      ReturnType<typeof auth>
    >);
    mockedFindFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/github/repos/route");
    const res = await GET(new Request("http://localhost/api/github/repos"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("reauth_required");
  });
});
