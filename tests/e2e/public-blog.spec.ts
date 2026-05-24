import { expect, test } from "@playwright/test";

test("/blog/* 경로는 미인증 상태에서 /login으로 리다이렉트되지 않는다", async ({ page }) => {
  // 존재하지 않는 slug → Next.js 404. 중요한 것은 /login 리다이렉트가 없는 것.
  const res = await page.goto("/blog/nonexistent-slug-e2e-test");

  expect(new URL(page.url()).pathname).not.toBe("/login");
  // 미들웨어 리다이렉트가 없으므로 응답은 404 또는 200 (Not Found 페이지)
  expect(res?.status()).not.toBe(302);
  expect(res?.status()).not.toBe(307);
});

test("미인증 사용자가 / 에 접속하면 여전히 /login으로 리다이렉트된다 (미들웨어 회귀)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForURL((url) => url.pathname === "/login");
  expect(new URL(page.url()).pathname).toBe("/login");
});
