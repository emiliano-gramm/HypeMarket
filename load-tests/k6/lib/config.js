/**
 * Shared k6 configuration for Ultimate Global Entertainment load tests.
 * Override via environment variables (see load-tests/.env.example).
 */

const profile = __ENV.K6_PROFILE || "smoke";

export const BASE_URL = (
  __ENV.BASE_URL || "https://ultimate-global-entertainment.vercel.app"
).replace(/\/$/, "");

export const LOAD_TEST_SECRET = __ENV.LOAD_TEST_SECRET || "";

export const POLL_REFRESH_SECONDS = Number(__ENV.POLL_REFRESH_SECONDS || "2");

const profiles = {
  smoke: {
    pollRead: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
    },
    pollVote: {
      executor: "constant-arrival-rate",
      rate: 2,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
    combined: {
      pollReaders: {
        executor: "constant-vus",
        vus: 10,
        duration: "1m",
      },
      pollVoters: {
        executor: "constant-arrival-rate",
        rate: 5,
        timeUnit: "1s",
        duration: "1m",
        preAllocatedVUs: 10,
        maxVUs: 50,
      },
    },
  },
  stress: {
    pollRead: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "3m", target: 500 },
        { duration: "1m", target: 0 },
      ],
    },
    pollVote: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      stages: [
        { duration: "1m", target: 50 },
        { duration: "3m", target: 200 },
        { duration: "1m", target: 0 },
      ],
      preAllocatedVUs: 50,
      maxVUs: 500,
    },
    combined: {
      pollReaders: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
          { duration: "1m", target: 200 },
          { duration: "3m", target: 800 },
          { duration: "1m", target: 0 },
        ],
      },
      pollVoters: {
        executor: "ramping-arrival-rate",
        startRate: 20,
        timeUnit: "1s",
        stages: [
          { duration: "1m", target: 80 },
          { duration: "3m", target: 300 },
          { duration: "1m", target: 0 },
        ],
        preAllocatedVUs: 100,
        maxVUs: 400,
      },
    },
  },
  cloud: {
    pollRead: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 1000 },
        { duration: "5m", target: 5000 },
        { duration: "2m", target: 0 },
      ],
    },
    pollVote: {
      executor: "ramping-arrival-rate",
      startRate: 50,
      timeUnit: "1s",
      stages: [
        { duration: "2m", target: 500 },
        { duration: "5m", target: 2000 },
        { duration: "2m", target: 0 },
      ],
      preAllocatedVUs: 500,
      maxVUs: 5000,
    },
    combined: {
      pollReaders: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
          { duration: "2m", target: 2000 },
          { duration: "5m", target: 10000 },
          { duration: "2m", target: 0 },
        ],
      },
      pollVoters: {
        executor: "ramping-arrival-rate",
        startRate: 100,
        timeUnit: "1s",
        stages: [
          { duration: "2m", target: 800 },
          { duration: "5m", target: 3000 },
          { duration: "2m", target: 0 },
        ],
        preAllocatedVUs: 800,
        maxVUs: 5000,
      },
    },
  },
};

const active = profiles[profile] || profiles.smoke;

export function pollReadScenario() {
  return active.pollRead;
}

export function pollVoteScenario() {
  return active.pollVote;
}

export function combinedScenarios() {
  return {
    poll_readers: {
      exec: "pollReaders",
      ...active.combined.pollReaders,
    },
    poll_voters: {
      exec: "pollVoters",
      ...active.combined.pollVoters,
    },
  };
}

/** Geographic distribution for Grafana k6 Cloud (step 7 global load). */
export const cloudDistribution = {
  "amazon:us:ashburn": { loadZone: "amazon:us:ashburn", percent: 34 },
  "amazon:ie:dublin": { loadZone: "amazon:ie:dublin", percent: 33 },
  "amazon:ap:singapore": { loadZone: "amazon:ap:singapore", percent: 33 },
};

export const defaultThresholds = {
  http_req_failed: ["rate<0.05"],
  http_req_duration: ["p(95)<2000", "p(99)<5000"],
  checks: ["rate>0.95"],
};

export const voteThresholds = {
  ...defaultThresholds,
  vote_success_rate: ["rate>0.90"],
  http_req_duration: ["p(95)<3000", "p(99)<8000"],
};

export function uniqueViewerId() {
  return `k6-${__VU}-${__ITER}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function randomOptionKey() {
  return Math.random() < 0.5 ? "team-a" : "team-b";
}

/** k6 header key casing varies by version; match case-insensitively. */
export function getResponseHeader(res, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(res.headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return "";
}

/**
 * True when Vercel/CDN edge caching is configured for this response.
 * Accepts s-maxage in any cache header, or x-vercel-cache (MISS/HIT/STALE on first requests).
 */
export function hasEdgeCacheHeaders(res) {
  const cacheControl = getResponseHeader(res, "cache-control").toLowerCase();
  const vercelCdn = getResponseHeader(res, "vercel-cdn-cache-control").toLowerCase();
  const cdnCache = getResponseHeader(res, "cdn-cache-control").toLowerCase();
  const vercelCache = getResponseHeader(res, "x-vercel-cache");

  if (cacheControl.includes("no-store") || cacheControl.includes("no-cache")) {
    return false;
  }

  const combined = `${cacheControl} ${vercelCdn} ${cdnCache}`;
  return (
    combined.includes("s-maxage") ||
    combined.includes("stale-while-revalidate") ||
    (vercelCache.length > 0 &&
      ["MISS", "HIT", "STALE", "REVALIDATED"].includes(vercelCache.toUpperCase()))
  );
}
