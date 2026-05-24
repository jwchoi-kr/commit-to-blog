import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/app/_lib/api";
import { UnauthorizedError } from "@/app/_lib/errors";
import { prisma } from "@/app/_lib/prisma";

type RouteCtx = { params: Promise<{ id: string }> };

async function getOwnedPost(id: string, userId: string) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || post.authorId !== userId) return null;
  return post;
}

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const post = await getOwnedPost(id, userId);
    if (!post) {
      return NextResponse.json({ code: "not_found", message: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { code: "internal_error", message: "Internal server error" },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  contentMd: z.string().optional(),
  excerpt: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: RouteCtx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const post = await getOwnedPost(id, userId);
    if (!post) {
      return NextResponse.json({ code: "not_found", message: "Post not found" }, { status: 404 });
    }

    const body = patchSchema.parse(await req.json());

    // auto-generate excerpt from first paragraph if contentMd changed and excerpt not supplied
    let excerpt = body.excerpt;
    if (body.contentMd !== undefined && excerpt === undefined) {
      const firstPara = body.contentMd
        .replace(/^#+\s.*$/m, "")
        .trim()
        .split("\n\n")[0]
        ?.replace(/[#*`_[\]]/g, "")
        .trim();
      excerpt = firstPara ? firstPara.slice(0, 200) : null;
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { ...body, ...(excerpt !== undefined ? { excerpt } : {}) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { code: "internal_error", message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post || post.authorId !== userId) {
      return NextResponse.json({ code: "not_found", message: "Post not found" }, { status: 404 });
    }

    await prisma.post.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: 401 });
    }
    console.error("[DELETE /api/posts/:id]", err);
    return NextResponse.json(
      { code: "internal_error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
