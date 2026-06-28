import { NextResponse } from "next/server";
import { placeStake } from "@/app/actions/markets";
import type { StakeErrorCode } from "@/lib/markets/types";

export const dynamic = "force-dynamic";

const DEFAULT_STAKE_AMOUNT = 50;

function stakeHttpStatus(code: StakeErrorCode): number {
  switch (code) {
    case "insufficient_funds":
      return 402;
    case "market_locked":
    case "market_closed":
      return 409;
    case "error":
      return 500;
    default:
      return 400;
  }
}

/**
 * Guarded stake endpoint for k6 load tests (Phase 4).
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

  let body: { optionKey?: string; viewerExternalId?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { optionKey, viewerExternalId } = body;
  const amount =
    body.amount === undefined ? DEFAULT_STAKE_AMOUNT : Number(body.amount);

  if (!optionKey || !viewerExternalId) {
    return NextResponse.json(
      { ok: false, message: "optionKey and viewerExternalId are required" },
      { status: 400 }
    );
  }

  const result = await placeStake(optionKey, amount, viewerExternalId);
  const status = result.ok ? 200 : stakeHttpStatus(result.code);

  return NextResponse.json(result, { status });
}
