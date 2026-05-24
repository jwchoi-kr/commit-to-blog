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

const base: CreateFlowState = {
  ...initialState,
  repo: repoA,
  branch: branchMain,
  selectedShas: [],
};

describe("createFlowReducer", () => {
  it("선택한 레포가 바뀌면 브랜치와 커밋 선택을 초기화한다", () => {
    const start: CreateFlowState = { ...base, selectedShas: ["sha1"] };
    const next = createFlowReducer(start, { type: "SELECT_REPO", repo: repoB });
    expect(next.repo).toBe(repoB);
    expect(next.branch).toBeNull();
    expect(next.selectedShas).toEqual([]);
  });

  it("같은 레포를 다시 선택하면 상태를 유지한다 (참조 동일)", () => {
    const start: CreateFlowState = { ...base, selectedShas: ["sha1"] };
    const next = createFlowReducer(start, { type: "SELECT_REPO", repo: repoA });
    expect(next).toBe(start);
  });

  it("브랜치를 바꾸면 커밋 선택이 초기화된다", () => {
    const start: CreateFlowState = { ...base, selectedShas: ["sha1", "sha2"] };
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
    const start: CreateFlowState = { ...base, selectedShas: ["s1"] };
    const next = createFlowReducer(start, { type: "RESET" });
    expect(next).toEqual(initialState);
  });

  it("레포·브랜치·커밋 변경 시 생성 상태가 초기화된다", () => {
    const withDraft: CreateFlowState = {
      ...base,
      selectedShas: ["s1"],
      generating: false,
      streamText: "some text",
      draft: { title: "제목", contentMd: "내용", excerpt: "요약", aiModel: "gpt-4o-mini" },
    };
    const afterRepo = createFlowReducer(withDraft, { type: "SELECT_REPO", repo: repoB });
    expect(afterRepo.streamText).toBe("");
    expect(afterRepo.draft).toBeNull();

    const afterBranch = createFlowReducer(withDraft, { type: "SELECT_BRANCH", branch: branchDev });
    expect(afterBranch.streamText).toBe("");
    expect(afterBranch.draft).toBeNull();

    const afterToggle = createFlowReducer(withDraft, { type: "TOGGLE_COMMIT", sha: "s2" });
    expect(afterToggle.streamText).toBe("");
    expect(afterToggle.draft).toBeNull();
  });
});

describe("스트리밍 액션 + parseDraft", () => {
  const STREAM_MD = `# 검색 가능한 Combobox 컴포넌트 추가

> 저장소·브랜치·커밋 선택을 위한 범용 SearchableCombobox를 구현했습니다.

## 배경

기존 select로는 100개 이상의 항목을 다루기 어려워 검색 기능이 필요했습니다.`;

  function applyChunks(chunks: string[]): ReturnType<typeof createFlowReducer> {
    let state = createFlowReducer(initialState, { type: "GENERATE_START" });
    for (const delta of chunks) {
      state = createFlowReducer(state, { type: "STREAM_CHUNK", delta });
    }
    return state;
  }

  it("STREAM_CHUNK가 누적되어 streamText를 완성한다", () => {
    const state = applyChunks(["# 제", "목\n\n> 요약"]);
    expect(state.streamText).toBe("# 제목\n\n> 요약");
    expect(state.generating).toBe(true);
  });

  it("GENERATE_SUCCESS 시 streamText를 파싱해 draft를 생성한다", () => {
    const chunks = STREAM_MD.match(/.{1,20}/gs) ?? [];
    let state = applyChunks(chunks);
    state = createFlowReducer(state, { type: "GENERATE_SUCCESS", aiModel: "gpt-4o-mini" });

    expect(state.generating).toBe(false);
    expect(state.draft).not.toBeNull();
    expect(state.draft?.title).toBe("검색 가능한 Combobox 컴포넌트 추가");
    expect(state.draft?.excerpt).toContain("SearchableCombobox");
    expect(state.draft?.contentMd).toContain("## 배경");
    expect(state.draft?.aiModel).toBe("gpt-4o-mini");
  });

  it("parseDraft는 앞뒤 빈 줄을 허용한다", () => {
    const loose = `\n\n# 제목\n\n\n> 요약 한 줄\n\n본문 내용`;
    let state = createFlowReducer(initialState, { type: "GENERATE_START" });
    state = createFlowReducer(state, { type: "STREAM_CHUNK", delta: loose });
    state = createFlowReducer(state, { type: "GENERATE_SUCCESS", aiModel: "gpt-4o-mini" });

    expect(state.draft?.title).toBe("제목");
    expect(state.draft?.excerpt).toBe("요약 한 줄");
    expect(state.draft?.contentMd).toBe("본문 내용");
  });

  it("parseDraft — # 제목이 없으면 기본값으로 폴백한다", () => {
    let state = createFlowReducer(initialState, { type: "GENERATE_START" });
    state = createFlowReducer(state, { type: "STREAM_CHUNK", delta: "본문만 있는 텍스트" });
    state = createFlowReducer(state, { type: "GENERATE_SUCCESS", aiModel: "gpt-4o-mini" });

    expect(state.draft?.title).toBe("블로그 초안");
    expect(state.draft?.contentMd).toBe("본문만 있는 텍스트");
  });

  it("GENERATE_ERROR는 generating을 false로 바꾸고 에러 메시지를 저장한다", () => {
    let state = createFlowReducer(initialState, { type: "GENERATE_START" });
    state = createFlowReducer(state, { type: "GENERATE_ERROR", message: "API 오류" });

    expect(state.generating).toBe(false);
    expect(state.generateError).toBe("API 오류");
    expect(state.draft).toBeNull();
  });
});
