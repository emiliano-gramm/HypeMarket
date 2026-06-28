/**
 * k6 — DSQL write path via guarded load-test stake endpoint.
 * Each iteration uses a unique viewerExternalId (cold wallet auto-provision).
 *
 * Requires LOAD_TEST_SECRET on Vercel + matching env var locally.
 * Run: ./load-tests/scripts/run-smoke.sh poll-vote
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";
import {
  BASE_URL,
  DEFAULT_STAKE_AMOUNT,
  LOAD_TEST_SECRET,
  buildK6CloudOptions,
  pollVoteScenario,
  randomOptionKey,
  stakeWriteThresholds,
  uniqueViewerId,
} from "./lib/config.js";

const profile = __ENV.K6_PROFILE || "smoke";

const stakesAccepted = new Counter("stakes_accepted");
const stakeSuccessRate = new Rate("stake_success_rate");
const stakeOccRetries = new Counter("stake_occ_retries");
const stakeRollbacks = new Counter("stake_rollbacks");

export const options = {
  scenarios: {
    poll_vote: pollVoteScenario(),
  },
  thresholds: stakeWriteThresholds(profile),
  tags: { test: "stake-write", profile },
  ...buildK6CloudOptions(),
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
      amount: DEFAULT_STAKE_AMOUNT,
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
      "Load-test stake endpoint returned 404 — set LOAD_TEST_SECRET on Vercel and redeploy."
    );
  }
  if (probe.status === 403) {
    throw new Error("LOAD_TEST_SECRET mismatch between k6 and Vercel.");
  }
  if (probe.status !== 200) {
    throw new Error(
      `Load-test stake probe failed (status ${probe.status}): ${probe.body}`
    );
  }

  return { ready: true };
}

function parseStakeBody(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}

export default function pollVote() {
  const viewerId = uniqueViewerId();
  const optionKey = randomOptionKey();

  const res = http.post(
    `${BASE_URL}/api/load-test/vote`,
    JSON.stringify({
      optionKey,
      viewerExternalId: viewerId,
      amount: DEFAULT_STAKE_AMOUNT,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "x-load-test-secret": LOAD_TEST_SECRET,
      },
      tags: { name: "POST /api/load-test/vote" },
    }
  );

  const body = parseStakeBody(res);
  const accepted = check(res, {
    "stake status 200": (r) => r.status === 200,
    "stake ok": () => body?.ok === true,
  });

  stakeSuccessRate.add(accepted);
  if (accepted) {
    stakesAccepted.add(1);
    const retries = body?.occRetries;
    if (typeof retries === "number" && retries > 0) {
      stakeOccRetries.add(retries);
    }
  } else if (body?.code === "error") {
    stakeRollbacks.add(1);
  }

  sleep(0.2);
}
