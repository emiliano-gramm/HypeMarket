/**
 * k6 — edge-cached poll read path (GET /api/polls).
 * Mirrors SocialPanel polling every 2 seconds.
 *
 * Run: ./load-tests/scripts/run-smoke.sh poll-read
 */
import http from "k6/http";
import { check, sleep } from "k6";
import {
  BASE_URL,
  POLL_REFRESH_SECONDS,
  cloudDistribution,
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
  tags: { test: "poll-read", profile },
  ...(profile === "cloud"
    ? { cloud: { distribution: cloudDistribution, projectID: __ENV.K6_CLOUD_PROJECT_ID } }
    : {}),
};

export default function pollRead() {
  const res = http.get(`${BASE_URL}/api/polls`, {
    tags: { name: "GET /api/polls" },
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
    "has poll options": (r) => {
      try {
        const options = r.json("state.options");
        return Array.isArray(options) && options.length >= 2;
      } catch {
        return false;
      }
    },
    "edge cache headers": (r) => hasEdgeCacheHeaders(r),
  });

  sleep(POLL_REFRESH_SECONDS);
}
