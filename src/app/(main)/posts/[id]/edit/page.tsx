import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/_lib/auth";
import { prisma } from "@/app/_lib/prisma";
import Editor from "./_components/Editor";

type Props = { params: Promise<{ id: string }> };

export default async function EditPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      contentMd: true,
      repoFullName: true,
      branch: true,
      commitShas: true,
      authorId: true,
    },
  });

  if (!post || post.authorId !== session.user.id) notFound();

  return (
    <Editor
      id={post.id}
      initialTitle={post.title}
      initialContent={post.contentMd}
      meta={{
        repo: post.repoFullName,
        branch: post.branch,
        commitCount: post.commitShas.length,
      }}
    />
  );
}
