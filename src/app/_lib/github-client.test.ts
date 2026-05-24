import { describe, expect, it } from "vitest";

import { branchSchema, commitSchema, repoSchema } from "./github-client";

describe("github-client schemas", () => {
  it("RepoDTO 형태를 검증한다 (description nullable)", () => {
    expect(() =>
      repoSchema.parse({
        id: 1,
        fullName: "a/b",
        defaultBranch: "main",
        description: null,
        private: false,
        updatedAt: null,
        htmlUrl: "https://x",
      }),
    ).not.toThrow();
  });

  it("RepoDTO에 필수 필드가 빠지면 실패한다", () => {
    expect(() =>
      repoSchema.parse({
        id: 1,
        fullName: "a/b",
        // defaultBranch 누락
        description: null,
        private: false,
        updatedAt: null,
        htmlUrl: "https://x",
      }),
    ).toThrow();
  });

  it("BranchDTO 형태를 검증한다", () => {
    expect(() => branchSchema.parse({ name: "main", sha: "abc", protected: true })).not.toThrow();
  });

  it("CommitDTO 형태를 검증한다 (author 정보는 nullable)", () => {
    expect(() =>
      commitSchema.parse({
        sha: "deadbeef",
        message: "feat: x",
        authorName: null,
        authorLogin: null,
        date: null,
        htmlUrl: "https://x",
      }),
    ).not.toThrow();
  });
});
