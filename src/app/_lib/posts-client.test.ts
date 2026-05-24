import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { savePost } from "./posts-client";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("savePost()", () => {
  it("성공 시 { id } 반환", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "post-123" }), { status: 201 }),
    );
    const result = await savePost({
      title: "테스트 포스트",
      contentMd: "본문",
      excerpt: "요약",
      repoFullName: "owner/repo",
      branch: "main",
      commitShas: ["abc1234"],
      aiModel: "gpt-4o-mini",
    });
    expect(result.id).toBe("post-123");
  });

  it("API 오류 시 body.message로 Error throw", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "저장 실패 (500)" }), { status: 500 }),
    );
    await expect(
      savePost({
        title: "테스트",
        contentMd: "",
        excerpt: "",
        repoFullName: "a/b",
        branch: "main",
        commitShas: ["sha"],
        aiModel: "gpt-4o-mini",
      }),
    ).rejects.toThrow("저장 실패 (500)");
  });

  it("오류 응답에 message 필드 없으면 상태 코드 포함한 폴백 메시지로 throw", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("{}", { status: 403 }));
    await expect(
      savePost({
        title: "테스트",
        contentMd: "",
        excerpt: "",
        repoFullName: "a/b",
        branch: "main",
        commitShas: ["sha"],
        aiModel: "gpt-4o-mini",
      }),
    ).rejects.toThrow("저장 실패 (403)");
  });
});
