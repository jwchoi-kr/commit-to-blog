import { NextResponse } from "next/server";
import { RequestError } from "octokit";
import { ZodError, type ZodType } from "zod";

import { auth } from "@/app/_lib/auth";
import { BadRequestError, ReauthRequiredError, UnauthorizedError } from "@/app/_lib/errors";

export { BadRequestError, ReauthRequiredError, UnauthorizedError };

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new UnauthorizedError();
  return userId;
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestError("Invalid query parameters", parsed.error.issues);
  }
  return parsed.data;
}

type GitHubErrorMapping = {
  status: number;
  code: string;
  message: string;
  retryAfterSec?: number;
};

export function mapGitHubError(err: unknown): GitHubErrorMapping | null {
  if (!(err instanceof RequestError)) return null;

  if (err.status === 401) {
    return { status: 401, code: "reauth_required", message: "GitHub token rejected" };
  }
  if (err.status === 403 || err.status === 429) {
    const retryAfter = Number(err.response?.headers?.["retry-after"]) || undefined;
    return {
      status: 429,
      code: "rate_limited",
      message: "GitHub rate limit reached",
      retryAfterSec: retryAfter,
    };
  }
  if (err.status === 404) {
    return { status: 404, code: "not_found", message: "GitHub resource not found" };
  }
  return { status: 502, code: "upstream_error", message: `GitHub error (${err.status})` };
}

type RouteFn = (req: Request) => Promise<Response> | Response;

export function withRouteHandler(fn: RouteFn): RouteFn {
  return async (req) => {
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ code: err.code, message: err.message }, { status: 401 });
      }
      if (err instanceof ReauthRequiredError) {
        return NextResponse.json({ code: err.code, message: err.message }, { status: 401 });
      }
      if (err instanceof BadRequestError) {
        return NextResponse.json(
          { code: err.code, message: err.message, issues: err.issues },
          { status: 400 },
        );
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { code: "bad_request", message: "Invalid input", issues: err.issues },
          { status: 400 },
        );
      }
      const gh = mapGitHubError(err);
      if (gh) {
        const { status, ...body } = gh;
        return NextResponse.json(body, { status });
      }
      console.error("[withRouteHandler] unhandled error", err);
      return NextResponse.json(
        { code: "internal_error", message: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
