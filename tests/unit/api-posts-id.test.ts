import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/_lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/app/_lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth } from "@/app/_lib/auth";
import { prisma } from "@/app/_lib/prisma";

const mockedAuth = vi.mocked(auth);
const mockedFindUnique = vi.mocked(prisma.post.findUnique);
const mockedUpdate = vi.mocked(prisma.post.update);

function setLoggedIn(userId = "u1") {
  mockedAuth.mockResolvedValue({ user: { id: userId } } as unknown as Awaited<
    ReturnType<typeof auth>
  >);
}

function setLoggedOut() {
  mockedAuth.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

const ctx = { params: Promise.resolve({ id: "p1" }) };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/posts/:id", () => {
  it("미인증 시 401 반환", async () => {
    setLoggedOut();
    const { GET } = await import("@/app/api/posts/[id]/route");
    const res = await GET(new Request("http://localhost/api/posts/p1"), ctx);
    expect(res.status).toBe(401);
  });

  it("타인 소유 포스트 → 404", async () => {
    setLoggedIn("u1");
    mockedFindUnique.mockResolvedValue({ id: "p1", authorId: "u2" } as never);
    const { GET } = await import("@/app/api/posts/[id]/route");
    const res = await GET(new Request("http://localhost/api/posts/p1"), ctx);
    expect(res.status).toBe(404);
  });

  it("본인 포스트 → 200 + post 반환", async () => {
    setLoggedIn("u1");
    mockedFindUnique.mockResolvedValue({ id: "p1", authorId: "u1", title: "Hello" } as never);
    const { GET } = await import("@/app/api/posts/[id]/route");
    const res = await GET(new Request("http://localhost/api/posts/p1"), ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("p1");
  });
});

describe("PATCH /api/posts/:id", () => {
  it("미인증 시 401 반환", async () => {
    setLoggedOut();
    const { PATCH } = await import("@/app/api/posts/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/posts/p1", {
        method: "PATCH",
        body: JSON.stringify({ title: "New" }),
      }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("타인 소유 포스트 → 404", async () => {
    setLoggedIn("u1");
    mockedFindUnique.mockResolvedValue({ id: "p1", authorId: "u2" } as never);
    const { PATCH } = await import("@/app/api/posts/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/posts/p1", {
        method: "PATCH",
        body: JSON.stringify({ title: "New" }),
      }),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it("contentMd 전달 시 헤더 제거 후 excerpt 자동 생성", async () => {
    setLoggedIn("u1");
    mockedFindUnique.mockResolvedValue({ id: "p1", authorId: "u1" } as never);
    mockedUpdate.mockResolvedValue({ id: "p1" } as never);

    const { PATCH } = await import("@/app/api/posts/[id]/route");
    await PATCH(
      new Request("http://localhost/api/posts/p1", {
        method: "PATCH",
        body: JSON.stringify({
          contentMd: "# 제목\n\n첫 번째 단락입니다.\n\n두 번째 단락입니다.",
        }),
      }),
      ctx,
    );

    const updateCall = mockedUpdate.mock.calls[0][0] as { data: { excerpt?: string } };
    expect(updateCall.data.excerpt).toBe("첫 번째 단락입니다.");
  });

  it("excerpt 직접 전달 시 자동 생성 override", async () => {
    setLoggedIn("u1");
    mockedFindUnique.mockResolvedValue({ id: "p1", authorId: "u1" } as never);
    mockedUpdate.mockResolvedValue({ id: "p1" } as never);

    const { PATCH } = await import("@/app/api/posts/[id]/route");
    await PATCH(
      new Request("http://localhost/api/posts/p1", {
        method: "PATCH",
        body: JSON.stringify({
          contentMd: "# 제목\n\n자동 단락",
          excerpt: "수동 요약",
        }),
      }),
      ctx,
    );

    const updateCall = mockedUpdate.mock.calls[0][0] as { data: { excerpt?: string } };
    expect(updateCall.data.excerpt).toBe("수동 요약");
  });

  it("excerpt 200자 초과 시 자동으로 잘림", async () => {
    setLoggedIn("u1");
    mockedFindUnique.mockResolvedValue({ id: "p1", authorId: "u1" } as never);
    mockedUpdate.mockResolvedValue({ id: "p1" } as never);

    const longParagraph = "a".repeat(300);
    const { PATCH } = await import("@/app/api/posts/[id]/route");
    await PATCH(
      new Request("http://localhost/api/posts/p1", {
        method: "PATCH",
        body: JSON.stringify({ contentMd: longParagraph }),
      }),
      ctx,
    );

    const updateCall = mockedUpdate.mock.calls[0][0] as { data: { excerpt?: string } };
    expect(updateCall.data.excerpt?.length).toBe(200);
  });
});
