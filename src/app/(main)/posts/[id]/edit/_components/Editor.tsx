"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GitBranch, GitCommit, Check, Loader2 } from "lucide-react";

import { cn } from "@/app/_lib/utils";
import { Input } from "@/app/_components/ui/input";
import { Textarea } from "@/app/_components/ui/textarea";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  id: string;
  initialTitle: string;
  initialContent: string;
  meta: { repo: string; branch: string; commitCount: number };
};

export default function Editor({ id, initialTitle, initialContent, meta }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ title, content });

  const save = useCallback(
    async (data: { title: string; content: string }) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/posts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: data.title, contentMd: data.content }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
      // reset to idle after 2s
      setTimeout(() => setSaveStatus((s) => (s !== "saving" ? "idle" : s)), 2000);
    },
    [id],
  );

  const scheduleSave = useCallback(
    (nextTitle: string, nextContent: string) => {
      latestRef.current = { title: nextTitle, content: nextContent };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        save(latestRef.current);
      }, 1500);
    },
    [save],
  );

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    scheduleSave(e.target.value, content);
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    scheduleSave(title, e.target.value);
  }

  // flush on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-8">
      {/* meta bar */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-1">
          <GitBranch className="h-3 w-3" />
          {meta.repo} / {meta.branch}
        </span>
        <span className="flex items-center gap-1">
          <GitCommit className="h-3 w-3" />
          {meta.commitCount}개 커밋
        </span>
        <SaveIndicator status={saveStatus} />
      </div>

      {/* title */}
      <Input
        value={title}
        onChange={handleTitleChange}
        placeholder="제목을 입력하세요"
        className="h-11 border-none px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
      />

      {/* tab bar */}
      <div className="flex gap-1 border-b">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 text-sm transition-colors",
              tab === t
                ? "border-b-2 border-current font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "write" ? "편집" : "미리보기"}
          </button>
        ))}
      </div>

      {/* editor / preview */}
      {tab === "write" ? (
        <Textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Markdown으로 작성하세요..."
          className="min-h-[60vh] flex-1 resize-none font-mono text-sm leading-relaxed"
        />
      ) : (
        <div className="prose prose-sm dark:prose-invert min-h-[60vh] max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  if (status === "saving")
    return (
      <span className="text-muted-foreground flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        저장 중…
      </span>
    );
  if (status === "saved")
    return (
      <span className="flex items-center gap-1 text-green-600">
        <Check className="h-3 w-3" />
        저장됨
      </span>
    );
  return <span className="text-red-500">저장 실패</span>;
}
