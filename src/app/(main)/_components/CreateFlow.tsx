"use client";

import { useReducer } from "react";

import { SearchableCombobox } from "@/app/_components/SearchableCombobox";
import {
  fetchBranches,
  fetchCommits,
  fetchRepos,
  GitHubApiError,
  type Branch,
  type Commit,
  type Repo,
} from "@/app/_lib/github-client";

import { createFlowReducer, initialState } from "./createFlow.reducer";
import { StepCard } from "./StepCard";

function toErrorMessage(fallback: string) {
  return (err: unknown) =>
    err instanceof GitHubApiError ? err.message : err instanceof Error ? err.message : fallback;
}

export function CreateFlow() {
  const [state, dispatch] = useReducer(createFlowReducer, initialState);
  const [owner, repo] = state.repo ? state.repo.fullName.split("/") : [null, null];

  return (
    <div className="flex flex-col gap-4">
      <StepCard step={1} title="Repository" description="Pick a repository to summarize.">
        <SearchableCombobox<Repo>
          cacheKey="repos"
          loadItems={(q, signal) => fetchRepos(q || undefined, signal)}
          getKey={(r) => String(r.id)}
          renderItem={(r) => (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{r.fullName}</span>
              {r.description && (
                <span className="text-muted-foreground line-clamp-1 text-xs">{r.description}</span>
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
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}
