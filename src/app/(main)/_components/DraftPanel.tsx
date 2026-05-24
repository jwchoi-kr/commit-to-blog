"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/app/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_components/ui/card";

import type { CreateFlowAction, CreateFlowState } from "./createFlow.reducer";

type Props = {
  state: CreateFlowState;
  dispatch: React.Dispatch<CreateFlowAction>;
  onSave: () => void;
};

export function DraftPanel({ state, dispatch, onSave }: Props) {
  const streamRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [state.streamText]);

  if (!state.generating && !state.streamText && !state.draft) {
    return (
      <div className="text-muted-foreground flex min-h-72 items-center justify-center rounded-md border border-dashed text-sm lg:sticky lg:top-8 lg:self-start">
        커밋을 선택하고 초안을 생성해보세요.
      </div>
    );
  }

  if (state.generating || (state.streamText && !state.draft)) {
    return (
      <Card className="lg:sticky lg:top-8 lg:self-start">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="relative flex h-2 w-2">
              <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
            </span>
            초안 생성 중…
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre
            ref={streamRef}
            className="text-muted-foreground max-h-[600px] overflow-y-auto font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
          >
            {state.streamText}
            {state.generating && <span className="animate-pulse">▋</span>}
          </pre>
        </CardContent>
      </Card>
    );
  }

  if (state.draft) {
    return (
      <Card className="lg:sticky lg:top-8 lg:self-start">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">초안 편집</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="draft-title" className="text-sm font-medium">
              제목
            </label>
            <input
              id="draft-title"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={state.draft.title}
              onChange={(e) => dispatch({ type: "SET_TITLE", title: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="draft-content" className="text-sm font-medium">
              본문 (Markdown)
            </label>
            <textarea
              id="draft-content"
              rows={22}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-xs leading-relaxed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={state.draft.contentMd}
              onChange={(e) => dispatch({ type: "SET_CONTENT", contentMd: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3">
            {state.savedPostId ? (
              <p className="text-sm text-green-600">저장되었습니다.</p>
            ) : (
              <Button onClick={onSave}>임시 저장</Button>
            )}
            <span className="text-muted-foreground text-xs">{state.draft.aiModel}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
