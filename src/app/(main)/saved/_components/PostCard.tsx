"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, GitCommit } from "lucide-react";

import { Button } from "@/app/_components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/app/_components/ui/card";

type Props = {
  id: string;
  title: string;
  excerpt: string | null;
  repoFullName: string;
  status: "DRAFT" | "PUBLISHED";
  updatedAt: string;
};

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default function PostCard({ id, title, excerpt, repoFullName, status, updatedAt }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="line-clamp-2 text-sm leading-snug font-semibold">{title}</h2>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              status === "PUBLISHED"
                ? "bg-green-100 text-green-700"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {status === "PUBLISHED" ? "발행됨" : "초안"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-3">
        {excerpt && (
          <p className="text-muted-foreground mb-3 line-clamp-3 text-xs leading-relaxed">
            {excerpt}
          </p>
        )}
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <GitCommit className="h-3 w-3 shrink-0" />
          <span className="truncate">{repoFullName}</span>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-0">
        <span className="text-muted-foreground text-xs">{relativeDate(updatedAt)}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-400 hover:bg-red-50 hover:text-red-600"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="포스트 삭제"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}
