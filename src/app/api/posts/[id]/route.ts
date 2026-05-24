import { NextResponse } from "next/server";

import { requireUserId } from "@/app/_lib/api";
import { UnauthorizedError } from "@/app/_lib/errors";
import { prisma } from "@/app/_lib/prisma";

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
