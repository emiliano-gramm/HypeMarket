/**
 * k6 — DSQL write path via guarded load-test vote endpoint.
 * Each VU uses a unique viewerExternalId (one vote per virtual user).
 *
 * Requires LOAD_TEST_SECRET on Vercel + matching env var locally.
 * Run: ./load-tests/scripts/run-smoke.sh poll-vote
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";
import {
  BASE_URL,
  LOAD_TEST_SECRET,
  cloudDistribution,
  randomOptionKey,
  uniqueViewerId,
  voteThresholds,
  pollVoteScenario,
} from "./lib/config.js";

const profile = __ENV.K6_PROFILE || "smoke";

const votesAccepted = new Counter("votes_accepted");
const voteSuccessRate = new Rate("vote_success_rate");

export const options = {
  scenarios: {
    poll_vote: pollVoteScenario(),
  },
  thresholds: {
    ...voteThresholds,
    vote_success_rate: ["rate>0.90"],
  },
  tags: { test: "poll-vote", profile },
  ...(profile === "cloud"
    ? { cloud: { distribution: cloudDistribution, projectID: __ENV.K6_CLOUD_PROJECT_ID } }
    : {}),
};

export function setup() {
  if (!LOAD_TEST_SECRET) {
    throw new Error(
      "LOAD_TEST_SECRET is required. Set it in the environment and on Vercel (LOAD_TEST_SECRET)."
    );
  }

  const probe = http.post(
    `${BASE_URL}/api/load-test/vote`,
    JSON.stringify({
      optionKey: "team-a",
      viewerExternalId: `k6-probe-${Date.now()}`,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "x-load-test-secret": LOAD_TEST_SECRET,
      },
    }
  );

  if (probe.status === 404) {
    throw new Error(
      "Load-test vote endpoint returned 404 — set LOAD_TEST_SECRET on Vercel and redeploy."
    );
  }
  if (probe.status === 403) {
    throw new Error("LOAD_TEST_SECRET mismatch between k6 and Vercel.");
  }
  if (probe.status !== 200) {
    throw new Error(
      `Load-test vote probe failed (status ${probe.status}): ${probe.body}`
    );
  }

  return { ready: true };
}

export default function pollVote() {
  const viewerId = uniqueViewerId();
  const optionKey = randomOptionKey();

  const res = http.post(
    `${BASE_URL}/api/load-test/vote`,
    JSON.stringify({ optionKey, viewerExternalId: viewerId }),
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

  sleep(0.2);
}
