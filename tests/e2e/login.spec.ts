import { expect, test } from "@playwright/test";

test("/login 페이지에 GitHub 로그인 버튼이 노출된다", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { level: 1, name: "Commit to Blog" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with GitHub/i })).toBeVisible();
});
