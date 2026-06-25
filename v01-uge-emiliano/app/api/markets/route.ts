import { NextResponse } from "next/server";
import { withDsqlClient } from "@/lib/dsql/client";
import { fetchMarketState, getDemoMarketId } from "@/lib/markets/queries";

const CACHE_HEADERS = {
  // Browser: short TTL
  "Cache-Control": "public, max-age=1, stale-while-revalidate=5",
  // Vercel edge CDN (see vercel.com/kb/guide/set-cache-control-headers)
  "CDN-Cache-Control": "public, s-maxage=1, stale-while-revalidate=5",
  "Vercel-CDN-Cache-Control": "public, s-maxage=1, stale-while-revalidate=5",
};

export async function GET() {
  try {
    const marketId = getDemoMarketId();
    const state = await withDsqlClient((client) =>
      fetchMarketState(client, marketId)
    );

    return NextResponse.json({ ok: true, state }, { headers: CACHE_HEADERS });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load market state";
    return NextResponse.json(
      { ok: false, message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
