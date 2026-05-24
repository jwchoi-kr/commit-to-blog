import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { JWT } from "next-auth/jwt";

import { prisma } from "@/app/_lib/prisma";
import authConfig from "@/app/_lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // PrismaAdapter expects a generic PrismaClient; ours comes from a custom
  // generator output (`src/generated/prisma`) so a cast is required.
  adapter: PrismaAdapter(prisma as never),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.githubLogin = (user as { githubLogin?: string }).githubLogin;
      }
      if (trigger === "update" && typeof token.id === "string") {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { githubLogin: true },
        });
        token.githubLogin = fresh?.githubLogin ?? token.githubLogin;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id;
      session.user.githubLogin =
        typeof token.githubLogin === "string" ? token.githubLogin : undefined;
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      if (
        isNewUser &&
        account?.provider === "github" &&
        typeof profile?.login === "string" &&
        user.id
      ) {
        await prisma.user.update({
          where: { id: user.id },
          data: { githubLogin: profile.login },
        });
      }
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      githubLogin?: string;
    } & DefaultSession["user"];
  }
  interface User {
    githubLogin?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    githubLogin?: string;
  }
}

// Re-export augmented JWT to make sure the module augmentation is loaded.
export type { JWT };
