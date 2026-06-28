/**
 * k6 — edge-cached market read path (GET /api/markets).
 * Mirrors useMarket() polling every 2 seconds.
 *
 * Run: ./load-tests/scripts/run-smoke.sh poll-read
 */
import http from "k6/http";
import { check, sleep } from "k6";
import {
  BASE_URL,
  POLL_REFRESH_SECONDS,
  buildK6CloudOptions,
  defaultThresholds,
  hasEdgeCacheHeaders,
  pollReadScenario,
} from "./lib/config.js";

const profile = __ENV.K6_PROFILE || "smoke";

export const options = {
  scenarios: {
    poll_read: pollReadScenario(),
  },
  thresholds: defaultThresholds,
  tags: { test: "market-read", profile },
  ...buildK6CloudOptions(),
};

export default function pollRead() {
  const res = http.get(`${BASE_URL}/api/markets`, {
    tags: { name: "GET /api/markets" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response ok": (r) => {
      try {
        return r.json("ok") === true;
      } catch {
        return false;
      }
    },
    "has market outcomes": (r) => {
      try {
        const outcomes = r.json("state.outcomes");
        return Array.isArray(outcomes) && outcomes.length >= 2;
      } catch {
        return false;
      }
    },
    "edge cache headers": (r) => hasEdgeCacheHeaders(r),
  });

  sleep(POLL_REFRESH_SECONDS);
}
