import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/_lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/app/_lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
const publishReq = new Request("http://localhost/api/posts/p1/publish", { method: "POST" });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/posts/:id/publish", () => {
  it("미인증 시 401 반환", async () => {
    setLoggedOut();
    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    const res = await POST(publishReq, ctx);
    expect(res.status).toBe(401);
  });

  it("타인 소유 포스트 → 404", async () => {
    setLoggedIn("u1");
    mockedFindUnique.mockResolvedValue({ authorId: "u2", status: "DRAFT", slug: null } as never);
    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    const res = await POST(publishReq, ctx);
    expect(res.status).toBe(404);
  });

  it("이미 PUBLISHED이면 update 없이 현재 post 반환 (idempotent)", async () => {
    setLoggedIn("u1");
    const published = { id: "p1", authorId: "u1", status: "PUBLISHED", slug: "my-post" };
    // first findUnique (ownership check), second (full post for idempotent return)
    mockedFindUnique
      .mockResolvedValueOnce({ authorId: "u1", status: "PUBLISHED", slug: "my-post" } as never)
      .mockResolvedValueOnce(published as never);

    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    const res = await POST(publishReq, ctx);

    expect(res.status).toBe(200);
    expect(mockedUpdate).not.toHaveBeenCalled();
    const body = (await res.json()) as { slug: string };
    expect(body.slug).toBe("my-post");
  });

  it("DRAFT → PUBLISHED 성공: slug 생성 + update 호출", async () => {
    setLoggedIn("u1");
    mockedFindUnique
      .mockResolvedValueOnce({ authorId: "u1", status: "DRAFT", slug: null } as never) // 1. ownership
      .mockResolvedValueOnce({ title: "내 첫 포스트" } as never) // 2. get title
      .mockResolvedValueOnce(null as never); // 3. slug collision (없음)

    mockedUpdate.mockResolvedValue({
      id: "p1",
      status: "PUBLISHED",
      slug: "nae-cheot-poseuteu",
    } as never);

    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    const res = await POST(publishReq, ctx);

    expect(res.status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledOnce();
    const updateArg = mockedUpdate.mock.calls[0][0] as {
      data: { status: string; slug: string; publishedAt: Date };
    };
    expect(updateArg.data.status).toBe("PUBLISHED");
    expect(typeof updateArg.data.slug).toBe("string");
    expect(updateArg.data.publishedAt).toBeInstanceOf(Date);
  });

  it("slug 충돌 시 suffix 추가된 slug 사용", async () => {
    setLoggedIn("u1");
    mockedFindUnique
      .mockResolvedValueOnce({ authorId: "u1", status: "DRAFT", slug: null } as never) // 1. ownership
      .mockResolvedValueOnce({ title: "My Post" } as never) // 2. get title
      .mockResolvedValueOnce({ id: "other-post" } as never); // 3. slug collision

    mockedUpdate.mockResolvedValue({ id: "p1", status: "PUBLISHED" } as never);

    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    await POST(publishReq, ctx);

    const updateArg = mockedUpdate.mock.calls[0][0] as { data: { slug: string } };
    // suffix 붙으면 base slug보다 길어야 함
    expect(updateArg.data.slug.length).toBeGreaterThan("my-post".length);
    expect(updateArg.data.slug.startsWith("my-post-")).toBe(true);
  });
});
