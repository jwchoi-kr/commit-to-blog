"use client";

import { useCallback, type Dispatch } from "react";

import type { CreateFlowAction } from "../_components/createFlow.reducer";

export function useGenerateDraft(dispatch: Dispatch<CreateFlowAction>) {
  return useCallback(
    async (repoFullName: string, shas: string[]) => {
      dispatch({ type: "GENERATE_START" });
      try {
        const res = await fetch("/api/ai/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoFullName, shas }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? `요청 실패 (${res.status})`);
        }
        const aiModel = res.headers.get("X-AI-Model") ?? "gpt-4o-mini";
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          dispatch({ type: "STREAM_CHUNK", delta: decoder.decode(value, { stream: true }) });
        }
        dispatch({ type: "GENERATE_SUCCESS", aiModel });
      } catch (err) {
        dispatch({
          type: "GENERATE_ERROR",
          message: err instanceof Error ? err.message : "알 수 없는 오류",
        });
      }
    },
    [dispatch],
  );
}
