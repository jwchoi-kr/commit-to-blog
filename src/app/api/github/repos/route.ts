import { z } from "zod";

import { parseQuery, requireUserId, withRouteHandler } from "@/app/_lib/api";
import { listMyRepos } from "@/app/_lib/github";

const querySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
});

export const GET = withRouteHandler(async (req) => {
  const userId = await requireUserId();
  const { q } = parseQuery(req, querySchema);
  const repos = await listMyRepos({ userId, q });
  return Response.json(repos);
});
