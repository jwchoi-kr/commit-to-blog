import type { Branch, Repo } from "@/app/_lib/github-client";

export type DraftData = {
  title: string;
  contentMd: string;
  excerpt: string;
  aiModel: string;
};

export type CreateFlowState = {
  repo: Repo | null;
  branch: Branch | null;
  selectedShas: string[];
  generating: boolean;
  generateError: string | null;
  streamText: string;
  draft: DraftData | null;
  savedPostId: string | null;
};

export const initialState: CreateFlowState = {
  repo: null,
  branch: null,
  selectedShas: [],
  generating: false,
  generateError: null,
  streamText: "",
  draft: null,
  savedPostId: null,
};

export type CreateFlowAction =
  | { type: "SELECT_REPO"; repo: Repo | null }
  | { type: "SELECT_BRANCH"; branch: Branch | null }
  | { type: "TOGGLE_COMMIT"; sha: string }
  | { type: "CLEAR_COMMITS" }
  | { type: "GENERATE_START" }
  | { type: "STREAM_CHUNK"; delta: string }
  | { type: "GENERATE_SUCCESS"; aiModel: string }
  | { type: "GENERATE_ERROR"; message: string }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_CONTENT"; contentMd: string }
  | { type: "SAVE_SUCCESS"; postId: string }
  | { type: "RESET" };

const resetGenerate = {
  generating: false,
  generateError: null,
  streamText: "",
  draft: null,
  savedPostId: null,
};

export function createFlowReducer(
  state: CreateFlowState,
  action: CreateFlowAction,
): CreateFlowState {
  switch (action.type) {
    case "SELECT_REPO": {
      if (state.repo?.id === action.repo?.id) return state;
      return { repo: action.repo, branch: null, selectedShas: [], ...resetGenerate };
    }
    case "SELECT_BRANCH": {
      if (state.branch?.name === action.branch?.name) return state;
      return { ...state, branch: action.branch, selectedShas: [], ...resetGenerate };
    }
    case "TOGGLE_COMMIT": {
      const has = state.selectedShas.includes(action.sha);
      return {
        ...state,
        selectedShas: has
          ? state.selectedShas.filter((s) => s !== action.sha)
          : [...state.selectedShas, action.sha],
        ...resetGenerate,
      };
    }
    case "CLEAR_COMMITS":
      if (state.selectedShas.length === 0) return state;
      return { ...state, selectedShas: [], ...resetGenerate };
    case "GENERATE_START":
      return {
        ...state,
        generating: true,
        generateError: null,
        streamText: "",
        draft: null,
        savedPostId: null,
      };
    case "STREAM_CHUNK":
      return { ...state, streamText: state.streamText + action.delta };
    case "GENERATE_SUCCESS":
      return {
        ...state,
        generating: false,
        draft: parseDraft(state.streamText, action.aiModel),
      };
    case "GENERATE_ERROR":
      return { ...state, generating: false, generateError: action.message };
    case "SET_TITLE":
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, title: action.title } };
    case "SET_CONTENT":
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, contentMd: action.contentMd } };
    case "SAVE_SUCCESS":
      return { ...state, savedPostId: action.postId };
    case "RESET":
      return initialState;
  }
}

function parseDraft(streamText: string, aiModel: string): DraftData {
  const lines = streamText.split("\n");
  let title = "블로그 초안";
  let excerpt = "";
  let i = 0;

  while (i < lines.length && !lines[i]?.trim()) i++;

  if (lines[i]?.startsWith("# ")) {
    title = lines[i].slice(2).trim();
    i++;
  }

  while (i < lines.length && !lines[i]?.trim()) i++;

  if (lines[i]?.startsWith("> ")) {
    excerpt = lines[i].slice(2).trim();
    i++;
  }

  while (i < lines.length && !lines[i]?.trim()) i++;

  const contentMd = lines.slice(i).join("\n").trimEnd();

  return { title, contentMd, excerpt, aiModel };
}
