import { describe, expect, it } from "vitest";

import type { Branch, Repo } from "@/app/_lib/github-client";

import { createFlowReducer, initialState, type CreateFlowState } from "./createFlow.reducer";

const repoA: Repo = {
  id: 1,
  fullName: "octo/a",
  defaultBranch: "main",
  description: null,
  private: false,
  updatedAt: null,
  htmlUrl: "https://github.com/octo/a",
};
const repoB: Repo = { ...repoA, id: 2, fullName: "octo/b" };

const branchMain: Branch = { name: "main", sha: "aaa", protected: false };
const branchDev: Branch = { name: "dev", sha: "bbb", protected: false };

describe("createFlowReducer", () => {
  it("선택한 레포가 바뀌면 브랜치와 커밋 선택을 초기화한다", () => {
    const start: CreateFlowState = {
      repo: repoA,
      branch: branchMain,
      selectedShas: ["sha1"],
    };
    const next = createFlowReducer(start, { type: "SELECT_REPO", repo: repoB });
    expect(next.repo).toBe(repoB);
    expect(next.branch).toBeNull();
    expect(next.selectedShas).toEqual([]);
  });

  it("같은 레포를 다시 선택하면 상태를 유지한다 (참조 동일)", () => {
    const start: CreateFlowState = {
      repo: repoA,
      branch: branchMain,
      selectedShas: ["sha1"],
    };
    const next = createFlowReducer(start, { type: "SELECT_REPO", repo: repoA });
    expect(next).toBe(start);
  });

  it("브랜치를 바꾸면 커밋 선택이 초기화된다", () => {
    const start: CreateFlowState = {
      repo: repoA,
      branch: branchMain,
      selectedShas: ["sha1", "sha2"],
    };
    const next = createFlowReducer(start, { type: "SELECT_BRANCH", branch: branchDev });
    expect(next.branch).toBe(branchDev);
    expect(next.selectedShas).toEqual([]);
  });

  it("TOGGLE_COMMIT은 추가/제거 토글로 동작한다", () => {
    const after1 = createFlowReducer(initialState, { type: "TOGGLE_COMMIT", sha: "s1" });
    expect(after1.selectedShas).toEqual(["s1"]);
    const after2 = createFlowReducer(after1, { type: "TOGGLE_COMMIT", sha: "s2" });
    expect(after2.selectedShas).toEqual(["s1", "s2"]);
    const after3 = createFlowReducer(after2, { type: "TOGGLE_COMMIT", sha: "s1" });
    expect(after3.selectedShas).toEqual(["s2"]);
  });

  it("RESET은 초기 상태로 돌아간다", () => {
    const start: CreateFlowState = {
      repo: repoA,
      branch: branchMain,
      selectedShas: ["s1"],
    };
    const next = createFlowReducer(start, { type: "RESET" });
    expect(next).toEqual(initialState);
  });
});
