"use client";

import { useReducer } from "react";

import { SearchableCombobox } from "@/app/_components/SearchableCombobox";
import { Button } from "@/app/_components/ui/button";
import {
  fetchBranches,
  fetchCommits,
  fetchRepos,
  GitHubApiError,
  type Branch,
  type Commit,
  type Repo,
} from "@/app/_lib/github-client";
import { savePost } from "@/app/_lib/posts-client";

import { useGenerateDraft } from "../_hooks/useGenerateDraft";
import { createFlowReducer, initialState } from "./createFlow.reducer";
import { DraftPanel } from "./DraftPanel";
import { StepCard } from "./StepCard";

function toErrorMessage(fallback: string) {
  return (err: unknown) =>
    err instanceof GitHubApiError ? err.message : err instanceof Error ? err.message : fallback;
}

export function CreateFlow() {
  const [state, dispatch] = useReducer(createFlowReducer, initialState);
  const [owner, repo] = state.repo ? state.repo.fullName.split("/") : [null, null];
  const generateDraft = useGenerateDraft(dispatch);

  async function handleGenerate() {
    if (!state.repo || state.selectedShas.length === 0) return;
    await generateDraft(state.repo.fullName, state.selectedShas);
  }

  async function handleSave() {
    if (!state.draft || !state.repo || !state.branch) return;
    try {
      const post = await savePost({
        title: state.draft.title,
        contentMd: state.draft.contentMd,
        excerpt: state.draft.excerpt,
        repoFullName: state.repo.fullName,
        branch: state.branch.name,
        commitShas: state.selectedShas,
        aiModel: state.draft.aiModel,
      });
      dispatch({ type: "SAVE_SUCCESS", postId: post.id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <section aria-label="Create flow" className="flex flex-col gap-4">
        <StepCard step={1} title="Repository" description="Pick a repository to summarize.">
          <SearchableCombobox<Repo>
            cacheKey="repos"
            loadItems={(q, signal) => fetchRepos(q || undefined, signal)}
            getKey={(r) => String(r.id)}
            renderItem={(r) => (
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{r.fullName}</span>
                {r.description && (
                  <span className="text-muted-foreground line-clamp-1 text-xs">
                    {r.description}
                  </span>
                )}
              </div>
            )}
            triggerLabel={
              state.repo ? (
                state.repo.fullName
              ) : (
                <span className="text-muted-foreground">Select a repository…</span>
              )
            }
            searchPlaceholder="Search repositories…"
            emptyMessage="No repositories found."
            selectedKey={state.repo ? String(state.repo.id) : null}
            onSelect={(r) => dispatch({ type: "SELECT_REPO", repo: r })}
            toErrorMessage={toErrorMessage("Failed to load repositories")}
          />
        </StepCard>

        {state.repo && owner && repo && (
          <StepCard step={2} title="Branch" description={state.repo.fullName}>
            <SearchableCombobox<Branch>
              cacheKey={`branches-${owner}-${repo}`}
              filter="local"
              loadItems={(_q, signal) => fetchBranches(owner, repo, signal)}
              getKey={(b) => b.name}
              getSearchText={(b) => b.name}
              renderItem={(b) => <span className="text-sm">{b.name}</span>}
              triggerLabel={
                state.branch ? (
                  state.branch.name
                ) : (
                  <span className="text-muted-foreground">Select a branch…</span>
                )
              }
              searchPlaceholder="Search branches…"
              emptyMessage="No branches found."
              selectedKey={state.branch?.name ?? null}
              onSelect={(b) => dispatch({ type: "SELECT_BRANCH", branch: b })}
              toErrorMessage={toErrorMessage("Failed to load branches")}
            />
          </StepCard>
        )}

        {state.repo &&
          state.branch &&
          owner &&
          repo &&
          (() => {
            const branchName = state.branch.name;
            return (
              <StepCard
                step={3}
                title="Commits"
                description={`${state.selectedShas.length} selected on ${branchName}`}
              >
                <SearchableCombobox<Commit>
                  mode="multiple"
                  cacheKey={`commits-${owner}-${repo}-${branchName}`}
                  filter="local"
                  loadItems={(_q, signal) => fetchCommits(owner, repo, branchName, signal)}
                  getKey={(c) => c.sha}
                  getSearchText={(c) => `${c.message} ${c.sha} ${c.authorLogin ?? ""}`}
                  renderItem={(c) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="line-clamp-1 text-sm font-medium">{c.message}</span>
                      <span className="text-muted-foreground text-xs">
                        {c.sha.slice(0, 7)}
                        {c.authorLogin ? ` · ${c.authorLogin}` : ""}
                        {c.date ? ` · ${formatDate(c.date)}` : ""}
                      </span>
                    </div>
                  )}
                  triggerLabel={
                    state.selectedShas.length === 0 ? (
                      <span className="text-muted-foreground">Select commits…</span>
                    ) : (
                      `${state.selectedShas.length} commit${state.selectedShas.length === 1 ? "" : "s"} selected`
                    )
                  }
                  searchPlaceholder="Search commits by message or SHA…"
                  emptyMessage="No commits match."
                  selectedKeys={state.selectedShas}
                  onToggle={(c) => dispatch({ type: "TOGGLE_COMMIT", sha: c.sha })}
                  toErrorMessage={toErrorMessage("Failed to load commits")}
                />
              </StepCard>
            );
          })()}

        {state.selectedShas.length > 0 && (
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleGenerate}
              disabled={state.generating}
              className="w-full sm:w-auto"
            >
              {state.generating ? "초안 생성 중…" : "블로그 초안 생성"}
            </Button>
            {state.generateError && (
              <p className="text-destructive text-sm">{state.generateError}</p>
            )}
          </div>
        )}
      </section>

      <section aria-label="Draft preview">
        <DraftPanel state={state} dispatch={dispatch} onSave={handleSave} />
      </section>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}
