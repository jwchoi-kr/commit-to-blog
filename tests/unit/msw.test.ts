import { expect, test } from "vitest";

// Smoke test for the MSW wiring. Delete or rewrite once real unit tests exist.
test("MSW intercepts GitHub repos request", async () => {
  const res = await fetch("https://api.github.com/user/repos");
  expect(res.status).toBe(200);
  const body = (await res.json()) as unknown[];
  expect(Array.isArray(body)).toBe(true);
});

test("MSW intercepts OpenAI chat completion", async () => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const body = await res.json();
  expect(body.choices[0].message.content).toBe("mock summary");
});
