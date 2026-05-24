"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, Pencil, Globe, Trash2, GitCommit } from "lucide-react";

import { Badge } from "@/app/_components/ui/badge";
import { Button } from "@/app/_components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/app/_components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/_components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/_components/ui/alert-dialog";

type Props = {
  id: string;
  title: string;
  excerpt: string | null;
  repoFullName: string;
  status: "DRAFT" | "PUBLISHED";
  slug: string | null;
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

export default function PostCard({
  id,
  title,
  excerpt,
  repoFullName,
  status,
  slug,
  updatedAt,
}: Props) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handlePublish() {
    setBusy(true);
    await fetch(`/api/posts/${id}/publish`, { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  async function handleDelete() {
    setBusy(true);
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    router.refresh();
    setBusy(false);
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 text-sm leading-snug font-semibold">{title}</h2>
            <Badge variant={status === "PUBLISHED" ? "default" : "secondary"} className="shrink-0">
              {status === "PUBLISHED" ? "발행됨" : "초안"}
            </Badge>
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
          {status === "PUBLISHED" && slug && (
            <Link
              href={`/blog/${slug}`}
              className="mt-2 block truncate text-xs text-blue-500 hover:underline"
            >
              /blog/{slug}
            </Link>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between pt-0">
          <span className="text-muted-foreground text-xs">{relativeDate(updatedAt)}</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy}>
                <MoreHorizontal className="h-3.5 w-3.5" />
                <span className="sr-only">메뉴 열기</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/posts/${id}/edit`} className="flex items-center gap-2">
                  <Pencil className="h-3.5 w-3.5" />
                  편집
                </Link>
              </DropdownMenuItem>
              {status === "DRAFT" && (
                <DropdownMenuItem onClick={handlePublish} className="gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  발행
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="gap-2 text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>포스트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>삭제하면 복구할 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
