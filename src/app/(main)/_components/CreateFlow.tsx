"use client";

import { useReducer } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/_components/ui/card";
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

function toErrorMessage(fallback: string) {
  return (err: unknown) =>
    err instanceof GitHubApiError ? err.message : err instanceof Error ? err.message : fallback;
}

export function CreateFlow() {
  const [state, dispatch] = useReducer(createFlowReducer, initialState);
  const [owner, repo] = state.repo ? state.repo.fullName.split("/") : [null, null];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Repository</CardTitle>
          <CardDescription>Pick a repository to summarize.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {state.repo && owner && repo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Branch</CardTitle>
            <CardDescription>{state.repo.fullName}</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {state.repo &&
        state.branch &&
        owner &&
        repo &&
        (() => {
          const branchName = state.branch.name;
          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. Commits</CardTitle>
                <CardDescription>
                  {state.selectedShas.length} selected on {branchName}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
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
