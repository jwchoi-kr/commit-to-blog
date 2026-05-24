import { z } from "zod";

import { requireUserId, withRouteHandler } from "@/app/_lib/api";
import { prisma } from "@/app/_lib/prisma";

const createBodySchema = z.object({
  title: z.string().min(1).max(300),
  contentMd: z.string(),
  excerpt: z.string().optional(),
  repoFullName: z.string().min(1),
  branch: z.string().min(1),
  commitShas: z.array(z.string()).min(1),
  aiModel: z.string().optional(),
  promptTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
});

export const POST = withRouteHandler(async (req) => {
  const userId = await requireUserId();
  const body = createBodySchema.parse(await req.json());
  const post = await prisma.post.create({
    data: {
      title: body.title,
      contentMd: body.contentMd,
      excerpt: body.excerpt,
      repoFullName: body.repoFullName,
      branch: body.branch,
      commitShas: body.commitShas,
      aiModel: body.aiModel,
      promptTokens: body.promptTokens,
      outputTokens: body.outputTokens,
      authorId: userId,
      status: "DRAFT",
    },
    select: { id: true, title: true, status: true, createdAt: true },
  });
  return Response.json(post, { status: 201 });
});
