import { redirect } from "next/navigation";
import { GitBranch } from "lucide-react";

import { auth, signOut } from "@/app/_lib/auth";
import { prisma } from "@/app/_lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/_components/ui/avatar";
import { Button } from "@/app/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_components/ui/card";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const [user, tokenStats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, image: true, githubLogin: true, createdAt: true },
    }),
    prisma.post.aggregate({
      where: { authorId: session.user.id },
      _sum: { promptTokens: true, outputTokens: true },
      _count: { id: true },
    }),
  ]);

  if (!user) redirect("/api/auth/signin");

  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();
  const totalTokens = (tokenStats._sum.promptTokens ?? 0) + (tokenStats._sum.outputTokens ?? 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">Settings</h1>

      <div className="flex flex-col gap-4">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">프로필</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
              <AvatarFallback className="text-lg">{initial}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              {user.name && <p className="font-medium">{user.name}</p>}
              {user.email && <p className="text-muted-foreground text-sm">{user.email}</p>}
              {user.githubLogin && (
                <a
                  href={`https://github.com/${user.githubLogin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground flex items-center gap-1 text-sm hover:underline"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  {user.githubLogin}
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI 사용량</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">생성된 포스트</span>
              <span className="font-medium">{tokenStats._count.id}개</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">입력 토큰</span>
              <span className="font-medium">
                {(tokenStats._sum.promptTokens ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">출력 토큰</span>
              <span className="font-medium">
                {(tokenStats._sum.outputTokens ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between font-medium">
                <span>합계</span>
                <span>{totalTokens.toLocaleString()} 토큰</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logout */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">계정</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="destructive" type="submit">
                로그아웃
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
