import { expect, test } from "@playwright/test";

const isLoginPath = (url: URL) => url.pathname === "/login";

test("미인증 사용자가 보호된 경로에 접속하면 /login으로 리다이렉트된다", async ({ page }) => {
  await page.goto("/");

  await page.waitForURL(isLoginPath);
  expect(new URL(page.url()).pathname).toBe("/login");
});

test("미인증으로 /saved 접속도 /login으로 리다이렉트된다", async ({ page }) => {
  await page.goto("/saved");

  await page.waitForURL(isLoginPath);
  expect(new URL(page.url()).pathname).toBe("/login");
});
