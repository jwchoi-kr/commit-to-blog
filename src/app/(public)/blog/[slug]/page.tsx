import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GitBranch, CalendarDays } from "lucide-react";

import { prisma } from "@/app/_lib/prisma";
import Markdown from "@/app/_components/Markdown";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true, excerpt: true },
  });
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: { title: post.title, description: post.excerpt ?? undefined },
  };
}

export default async function PublicPostPage({ params }: Props) {
  const { slug } = await params;

  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      title: true,
      contentMd: true,
      excerpt: true,
      repoFullName: true,
      branch: true,
      publishedAt: true,
      author: { select: { name: true } },
    },
  });

  if (!post) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-4 text-3xl leading-tight font-bold">{post.title}</h1>

      <div className="text-muted-foreground mb-8 flex flex-wrap items-center gap-4 text-sm">
        {post.author?.name && <span>{post.author.name}</span>}
        {post.publishedAt && (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(post.publishedAt).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        )}
        <span className="flex items-center gap-1">
          <GitBranch className="h-3.5 w-3.5" />
          {post.repoFullName} / {post.branch}
        </span>
      </div>

      <Markdown>{post.contentMd}</Markdown>
    </main>
  );
}
