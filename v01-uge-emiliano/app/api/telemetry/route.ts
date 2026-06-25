import { NextResponse } from "next/server";
import { fetchRecentTelemetryEvents } from "@/lib/telemetry/dynamodb";
import { MATCH_ID } from "@/lib/telemetry/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId") ?? MATCH_ID;
    const limit = Number(searchParams.get("limit") ?? "120");

    const events = await fetchRecentTelemetryEvents(matchId, limit);

    return NextResponse.json(
      { ok: true as const, events, hydratedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load telemetry snapshot";
    return NextResponse.json(
      { ok: false as const, message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
