import { z } from "zod";

import { parseQuery, requireUserId, withRouteHandler } from "@/app/_lib/api";
import { listBranches } from "@/app/_lib/github";

const querySchema = z.object({
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
});

export const GET = withRouteHandler(async (req) => {
  const userId = await requireUserId();
  const { owner, repo } = parseQuery(req, querySchema);
  const branches = await listBranches({ userId, owner, repo });
  return Response.json(branches);
});
