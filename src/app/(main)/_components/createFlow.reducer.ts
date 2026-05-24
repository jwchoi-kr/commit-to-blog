import type { Branch, Repo } from "@/app/_lib/github-client";

export type CreateFlowState = {
  repo: Repo | null;
  branch: Branch | null;
  selectedShas: string[];
};

export const initialState: CreateFlowState = {
  repo: null,
  branch: null,
  selectedShas: [],
};

export type CreateFlowAction =
  | { type: "SELECT_REPO"; repo: Repo | null }
  | { type: "SELECT_BRANCH"; branch: Branch | null }
  | { type: "TOGGLE_COMMIT"; sha: string }
  | { type: "CLEAR_COMMITS" }
  | { type: "RESET" };

export function createFlowReducer(
  state: CreateFlowState,
  action: CreateFlowAction,
): CreateFlowState {
  switch (action.type) {
    case "SELECT_REPO": {
      if (state.repo?.id === action.repo?.id) return state;
      return { repo: action.repo, branch: null, selectedShas: [] };
    }
    case "SELECT_BRANCH": {
      if (state.branch?.name === action.branch?.name) return state;
      return { ...state, branch: action.branch, selectedShas: [] };
    }
    case "TOGGLE_COMMIT": {
      const has = state.selectedShas.includes(action.sha);
      return {
        ...state,
        selectedShas: has
          ? state.selectedShas.filter((s) => s !== action.sha)
          : [...state.selectedShas, action.sha],
      };
    }
    case "CLEAR_COMMITS":
      if (state.selectedShas.length === 0) return state;
      return { ...state, selectedShas: [] };
    case "RESET":
      return initialState;
  }
}
