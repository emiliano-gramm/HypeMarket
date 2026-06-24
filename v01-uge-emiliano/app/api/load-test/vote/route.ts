import { NextResponse } from "next/server";
import { castVote } from "@/app/actions/polls";

export const dynamic = "force-dynamic";

/**
 * Guarded vote endpoint for k6 load tests (step 7).
 * Disabled unless LOAD_TEST_SECRET is set on the server.
 */
export async function POST(request: Request) {
  const secret = process.env.LOAD_TEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "Load test endpoint disabled" },
      { status: 404 }
    );
  }

  const provided = request.headers.get("x-load-test-secret");
  if (provided !== secret) {
    return NextResponse.json(
      { ok: false, message: "Forbidden" },
      { status: 403 }
    );
  }

  let body: { optionKey?: string; viewerExternalId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { optionKey, viewerExternalId } = body;
  if (!optionKey || !viewerExternalId) {
    return NextResponse.json(
      { ok: false, message: "optionKey and viewerExternalId are required" },
      { status: 400 }
    );
  }

  const result = await castVote(optionKey, viewerExternalId);
  const status = result.ok
    ? 200
    : result.code === "already_voted"
      ? 409
      : 400;

  return NextResponse.json(result, { status });
}
