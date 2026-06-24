/**
 * k6 — realistic mixed workload: poll readers + concurrent voters.
 * Simulates live match traffic (SocialPanel 2s polling + vote spikes).
 *
 * Run: ./load-tests/scripts/run-stress.sh combined
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";
import {
  BASE_URL,
  LOAD_TEST_SECRET,
  POLL_REFRESH_SECONDS,
  cloudDistribution,
  combinedScenarios,
  defaultThresholds,
  randomOptionKey,
  uniqueViewerId,
} from "./lib/config.js";

const profile = __ENV.K6_PROFILE || "smoke";

const votesAccepted = new Counter("votes_accepted");
const voteSuccessRate = new Rate("vote_success_rate");

export const options = {
  scenarios: combinedScenarios(),
  thresholds: {
    ...defaultThresholds,
    vote_success_rate: ["rate>0.90"],
  },
  tags: { test: "combined", profile },
  ...(profile === "cloud"
    ? { cloud: { distribution: cloudDistribution, projectID: __ENV.K6_CLOUD_PROJECT_ID } }
    : {}),
};

export function setup() {
  if (!LOAD_TEST_SECRET) {
    throw new Error("LOAD_TEST_SECRET is required for the vote scenario.");
  }
  return { ready: true };
}

export function pollReaders() {
  const res = http.get(`${BASE_URL}/api/polls`, {
    tags: { name: "GET /api/polls" },
  });

  check(res, {
    "read status 200": (r) => r.status === 200,
    "read ok": (r) => {
      try {
        return r.json("ok") === true;
      } catch {
        return false;
      }
    },
  });

  sleep(POLL_REFRESH_SECONDS);
}

export function pollVoters() {
  const res = http.post(
    `${BASE_URL}/api/load-test/vote`,
    JSON.stringify({
      optionKey: randomOptionKey(),
      viewerExternalId: uniqueViewerId(),
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "x-load-test-secret": LOAD_TEST_SECRET,
      },
      tags: { name: "POST /api/load-test/vote" },
    }
  );

  const accepted = check(res, {
    "vote status 200": (r) => r.status === 200,
    "vote ok": (r) => {
      try {
        return r.json("ok") === true;
      } catch {
        return false;
      }
    },
  });

  voteSuccessRate.add(accepted);
  if (accepted) {
    votesAccepted.add(1);
  }

  sleep(0.5);
}
