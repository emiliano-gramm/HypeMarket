import { NextResponse } from "next/server";
import { withDsqlClient } from "@/lib/dsql/client";
import { fetchPublicPollState, getDemoPollId } from "@/lib/polls/queries";

const CACHE_HEADERS = {
  // Browser: short TTL
  "Cache-Control": "public, max-age=1, stale-while-revalidate=5",
  // Vercel edge CDN (see vercel.com/kb/guide/set-cache-control-headers)
  "CDN-Cache-Control": "public, s-maxage=1, stale-while-revalidate=5",
  "Vercel-CDN-Cache-Control": "public, s-maxage=1, stale-while-revalidate=5",
};

export async function GET() {
  try {
    const pollId = getDemoPollId();
    const state = await withDsqlClient((client) =>
      fetchPublicPollState(client, pollId)
    );

    return NextResponse.json({ ok: true, state }, { headers: CACHE_HEADERS });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load poll totals";
    return NextResponse.json(
      { ok: false, message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
