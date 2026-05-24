import { redirect } from "next/navigation";

import { auth } from "@/app/_lib/auth";
import { prisma } from "@/app/_lib/prisma";
import PostCard from "./_components/PostCard";

export default async function SavedPostsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const posts = await prisma.post.findMany({
    where: { authorId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      excerpt: true,
      repoFullName: true,
      status: true,
      slug: true,
      updatedAt: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">Saved Posts</h1>
      {posts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          아직 저장된 포스트가 없습니다. 홈에서 AI 초안을 생성하고 저장해보세요.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              id={post.id}
              title={post.title}
              excerpt={post.excerpt ?? null}
              repoFullName={post.repoFullName}
              status={post.status}
              slug={post.slug ?? null}
              updatedAt={post.updatedAt.toISOString()}
            />
          ))}
        </div>
      )}
    </main>
  );
}
