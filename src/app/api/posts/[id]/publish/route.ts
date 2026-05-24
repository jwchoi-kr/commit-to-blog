import { NextResponse } from "next/server";
import slugify from "slugify";

import { requireUserId } from "@/app/_lib/api";
import { UnauthorizedError } from "@/app/_lib/errors";
import { prisma } from "@/app/_lib/prisma";

type RouteCtx = { params: Promise<{ id: string }> };

async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title, { lower: true, strict: true, locale: "ko" });
  const slug = base || "post";

  const existing = await prisma.post.findUnique({ where: { slug }, select: { id: true } });
  if (!existing) return slug;

  // append short hash suffix on collision
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${slug}-${suffix}`;
}

export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true, status: true, slug: true },
    });

    if (!post || post.authorId !== userId) {
      return NextResponse.json({ code: "not_found", message: "Post not found" }, { status: 404 });
    }

    // idempotent — already published
    if (post.status === "PUBLISHED") {
      const current = await prisma.post.findUnique({ where: { id } });
      return NextResponse.json(current);
    }

    const latestTitle = await prisma.post.findUnique({ where: { id }, select: { title: true } });
    const slug = await generateUniqueSlug(latestTitle!.title);

    const updated = await prisma.post.update({
      where: { id },
      data: { status: "PUBLISHED", slug, publishedAt: new Date() },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 401 });
    }
    console.error("[POST /api/posts/:id/publish]", err);
    return NextResponse.json(
      { code: "internal_error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
