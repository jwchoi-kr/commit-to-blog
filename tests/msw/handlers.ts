import { http, HttpResponse } from "msw";

import { ghBranchRaw, ghCommitRaw, ghRepoRaw } from "./fixtures";

// Default happy-path handlers. Override per-test with server.use(...).
export const handlers = [
  http.get("https://api.github.com/user/repos", () => HttpResponse.json([ghRepoRaw])),

  http.get("https://api.github.com/repos/:owner/:repo/branches", () =>
    HttpResponse.json([ghBranchRaw]),
  ),

  http.get("https://api.github.com/repos/:owner/:repo/commits", () =>
    HttpResponse.json([ghCommitRaw]),
  ),

  http.post("https://api.openai.com/v1/chat/completions", () =>
    HttpResponse.json({
      id: "chatcmpl-test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "mock summary" },
          finish_reason: "stop",
        },
      ],
    }),
  ),
];
