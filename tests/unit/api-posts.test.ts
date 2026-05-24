import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/_lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/app/_lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth } from "@/app/_lib/auth";
import { prisma } from "@/app/_lib/prisma";

const mockedAuth = vi.mocked(auth);
const mockedFindMany = vi.mocked(prisma.post.findMany);
const mockedFindUnique = vi.mocked(prisma.post.findUnique);
const mockedDelete = vi.mocked(prisma.post.delete);

function setLoggedIn(userId = "u1") {
  mockedAuth.mockResolvedValue({ user: { id: userId } } as unknown as Awaited<
    ReturnType<typeof auth>
  >);
}

function setLoggedOut() {
  mockedAuth.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

beforeEach(() => {
  mockedAuth.mockReset();
  mockedFindMany.mockReset();
  mockedFindUnique.mockReset();
  mockedDelete.mockReset();
});

describe("GET /api/posts", () => {
  it("미인증 시 401 반환", async () => {
    setLoggedOut();
    const { GET } = await import("@/app/api/posts/route");
    const res = await GET(new Request("http://localhost/api/posts"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("unauthorized");
  });

  it("status 파라미터가 유효하지 않으면 400 반환", async () => {
    setLoggedIn();
    const { GET } = await import("@/app/api/posts/route");
    const res = await GET(new Request("http://localhost/api/posts?status=INVALID"));
    expect(res.status).toBe(400);
  });

  it("200 + 포스트 목록 반환 (기본 status=DRAFT)", async () => {
    setLoggedIn("u1");
    mockedFindMany.mockResolvedValue([
      {
        id: "p1",
        title: "Post 1",
        excerpt: null,
        repoFullName: "a/b",
        status: "DRAFT",
        updatedAt: new Date(),
      },
    ] as never);
    const { GET } = await import("@/app/api/posts/route");
    const res = await GET(new Request("http://localhost/api/posts"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body[0].id).toBe("p1");
  });
});

describe("DELETE /api/posts/:id", () => {
  it("미인증 시 401 반환", async () => {
    setLoggedOut();
    const { DELETE } = await import("@/app/api/posts/[id]/route");
    const res = await DELETE(new Request("http://localhost/api/posts/p1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(res.status).toBe(401);
  });

  it("존재하지 않는 포스트는 404 반환", async () => {
    setLoggedIn("u1");
    mockedFindUnique.mockResolvedValue(null as never);
    const { DELETE } = await import("@/app/api/posts/[id]/route");
    const res = await DELETE(new Request("http://localhost/api/posts/p1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(res.status).toBe(404);
  });

  it("타인 소유 포스트 삭제 시도 시 404 반환", async () => {
    setLoggedIn("u1");
    mockedFindUnique.mockResolvedValue({ authorId: "u2" } as never);
    const { DELETE } = await import("@/app/api/posts/[id]/route");
    const res = await DELETE(new Request("http://localhost/api/posts/p1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(res.status).toBe(404);
  });

  it("본인 포스트 삭제 시 204 반환", async () => {
    setLoggedIn("u1");
    mockedFindUnique.mockResolvedValue({ authorId: "u1" } as never);
    mockedDelete.mockResolvedValue(undefined as never);
    const { DELETE } = await import("@/app/api/posts/[id]/route");
    const res = await DELETE(new Request("http://localhost/api/posts/p1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(res.status).toBe(204);
  });
});
