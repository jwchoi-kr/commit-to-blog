import { z } from "zod";

import { requireUserId, withRouteHandler } from "@/app/_lib/api";
import { createSummarizeStream } from "@/app/_lib/ai";
import { getCommitDiff } from "@/app/_lib/github";

const bodySchema = z.object({
  repoFullName: z.string().min(1),
  shas: z.array(z.string().min(7)).min(1).max(10),
});

export const POST = withRouteHandler(async (req) => {
  const userId = await requireUserId();
  const body = bodySchema.parse(await req.json());
  const [owner, repo] = body.repoFullName.split("/");

  const diffs = await Promise.all(
    body.shas.map((sha) => getCommitDiff({ userId, owner, repo, sha })),
  );

  const { stream, model } = await createSummarizeStream(diffs);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-AI-Model": model,
    },
  });
});
