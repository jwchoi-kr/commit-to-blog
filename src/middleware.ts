import NextAuth from "next-auth";
import authConfig from "@/app/_lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  // 보호 대상: (main)/** 라우트만. 공개 페이지(/blog)·API·정적 파일 제외
  matcher: ["/((?!api|blog|login|_next|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)).*)"],
};
