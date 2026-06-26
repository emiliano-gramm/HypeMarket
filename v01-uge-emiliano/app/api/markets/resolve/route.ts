import { NextResponse } from "next/server";
import { lockMarket, resolveMarket } from "@/app/actions/markets";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Admin endpoint for Phase 3 lock / resolve / settlement (Updated Idea).
 * Guarded by ADMIN_SECRET — disabled with 404 when the secret is unset.
 *
 * Examples:
 *   curl -X POST $URL/api/markets/resolve \
 *     -H "x-admin-secret: $ADMIN_SECRET" \
 *     -H "content-type: application/json" \
 *     -d '{"action":"lock"}'
 *
 *   curl -X POST $URL/api/markets/resolve \
 *     -H "x-admin-secret: $ADMIN_SECRET" \
 *     -H "content-type: application/json" \
 *     -d '{"winningOptionKey":"team-a"}'
 */
export async function POST(request: Request) {
  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json(
      { ok: false, message: "Admin endpoint disabled" },
      { status: 404, headers: NO_STORE }
    );
  }

  const secret =
    request.headers.get("x-admin-secret") ??
    new URL(request.url).searchParams.get("secret") ??
    "";

  let body: { action?: string; winningOptionKey?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400, headers: NO_STORE }
    );
  }

  if (body.action === "lock") {
    const result = await lockMarket(secret);
    const status = result.ok ? 200 : result.code === "unauthorized" ? 403 : 400;
    return NextResponse.json(result, { status, headers: NO_STORE });
  }

  const { winningOptionKey } = body;
  if (!winningOptionKey) {
    return NextResponse.json(
      { ok: false, message: "winningOptionKey (or action: 'lock') is required" },
      { status: 400, headers: NO_STORE }
    );
  }

  const result = await resolveMarket(winningOptionKey, secret);
  const status = result.ok ? 200 : result.code === "unauthorized" ? 403 : 400;
  return NextResponse.json(result, { status, headers: NO_STORE });
}
