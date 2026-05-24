import { z } from "zod";

import { parseQuery, requireUserId, withRouteHandler } from "@/app/_lib/api";
import { listCommits } from "@/app/_lib/github";

const querySchema = z.object({
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  per_page: z.coerce.number().int().min(1).max(50).optional(),
});

export const GET = withRouteHandler(async (req) => {
  const userId = await requireUserId();
  const { owner, repo, branch, per_page } = parseQuery(req, querySchema);
  const commits = await listCommits({
    userId,
    owner,
    repo,
    branch,
    perPage: per_page,
  });
  return Response.json(commits);
});
