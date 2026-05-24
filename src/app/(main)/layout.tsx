import Link from "next/link";

import { UserMenu } from "@/app/_components/UserMenu";
import { auth, signOut } from "@/app/_lib/auth";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const user = session?.user;

  return (
    <>
      <header className="border-b">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link href="/" className="font-semibold">
            Commit to Blog
          </Link>
          <Link href="/" className="text-sm">
            My Blog
          </Link>
          <Link href="/saved" className="text-sm">
            Saved Posts
          </Link>
          <Link href="/settings" className="text-sm">
            Settings
          </Link>
          {user && (
            <div className="ml-auto">
              <UserMenu
                user={{ name: user.name, image: user.image, email: user.email }}
                signOutAction={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              />
            </div>
          )}
        </nav>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
