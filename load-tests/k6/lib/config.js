/**
 * Shared k6 configuration for HypeMarket load tests.
 * Override via environment variables (see load-tests/.env.example).
 */

const profile = __ENV.K6_PROFILE || "smoke";

/** Sustained operating-point knobs for K6_PROFILE=cloud-geo (override via env). */
const geoStakeRate = Number(__ENV.GEO_STAKE_RATE || "45");
const geoDuration = __ENV.GEO_DURATION || "5m";
/** k6 Cloud free/trial stacks often cap at 100 VUs — keep combined scenarios under budget. */
const geoVuBudget = Number(__ENV.GEO_VU_BUDGET || "100");
const geoReaderVus = Number(__ENV.GEO_READER_VUS || "25");
const geoStakeMaxVus = Number(
  __ENV.GEO_STAKE_MAX_VUS || String(Math.max(geoVuBudget - geoReaderVus, geoStakeRate))
);
const geoStakePreAllocated = Math.min(Math.max(geoStakeRate, 20), geoStakeMaxVus);

export const BASE_URL = (
  __ENV.BASE_URL || "https://hypemarket.vercel.app"
).replace(/\/$/, "");

export const LOAD_TEST_SECRET = __ENV.LOAD_TEST_SECRET || "";

export const POLL_REFRESH_SECONDS = Number(__ENV.POLL_REFRESH_SECONDS || "2");

/** Default stake chip amount — matches HypeMarket UI quick chips. */
export const DEFAULT_STAKE_AMOUNT = Number(__ENV.DEFAULT_STAKE_AMOUNT || "50");

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
  /** k6 Cloud — honest operating point from US/EU/AP (Phase 5 geo proof). */
  "cloud-geo": {
    pollRead: {
      executor: "constant-vus",
      vus: geoReaderVus,
      duration: geoDuration,
    },
    pollVote: {
      executor: "constant-arrival-rate",
      rate: geoStakeRate,
      timeUnit: "1s",
      duration: geoDuration,
      preAllocatedVUs: geoStakePreAllocated,
      maxVUs: geoStakeMaxVus,
    },
    combined: {
      pollReaders: {
        executor: "constant-vus",
        vus: geoReaderVus,
        duration: geoDuration,
      },
      pollVoters: {
        executor: "constant-arrival-rate",
        rate: geoStakeRate,
        timeUnit: "1s",
        duration: geoDuration,
        preAllocatedVUs: geoStakePreAllocated,
        maxVUs: geoStakeMaxVus,
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

/** Multi-region distribution (paid k6 Cloud plans — max 1 zone on Free Forever). */
export const cloudDistributionMulti = {
  "amazon:us:ashburn": { loadZone: "amazon:us:ashburn", percent: 34 },
  "amazon:ie:dublin": { loadZone: "amazon:ie:dublin", percent: 33 },
  "amazon:sg:singapore": { loadZone: "amazon:sg:singapore", percent: 33 },
};

/** @deprecated alias — use cloudDistributionMulti or resolveCloudDistribution() */
export const cloudDistribution = cloudDistributionMulti;

/** Pick load zones for k6 Cloud. Free Forever allows 1 zone; set GEO_MULTI_ZONE=true for 3. */
export function resolveCloudDistribution(env = __ENV) {
  const activeProfile = env.K6_PROFILE || "smoke";
  const explicitZone = env.GEO_LOAD_ZONE;
  if (explicitZone) {
    return { [explicitZone]: { loadZone: explicitZone, percent: 100 } };
  }
  if (env.GEO_MULTI_ZONE === "1" || env.GEO_MULTI_ZONE === "true") {
    return cloudDistributionMulti;
  }
  if (activeProfile === "cloud") {
    return cloudDistributionMulti;
  }
  const defaultZone = env.GEO_DEFAULT_ZONE || "amazon:us:ashburn";
  return { [defaultZone]: { loadZone: defaultZone, percent: 100 } };
}

/** True when the run should use k6 Cloud load zones (US/EU/AP). */
export function isK6CloudProfile(name = profile) {
  return name === "cloud" || name === "cloud-geo";
}

/** Spread options.cloud when profile is cloud or cloud-geo. */
export function buildK6CloudOptions(env = __ENV) {
  const activeProfile = env.K6_PROFILE || "smoke";
  if (!isK6CloudProfile(activeProfile)) {
    return {};
  }
  const cloud = { distribution: resolveCloudDistribution(env) };
  if (env.K6_CLOUD_PROJECT_ID) {
    cloud.projectID = env.K6_CLOUD_PROJECT_ID;
  }
  return { cloud };
}

export const defaultThresholds = {
  http_req_failed: ["rate<0.05"],
  http_req_duration: ["p(95)<2000", "p(99)<5000"],
  checks: ["rate>0.95"],
};

export const stakeThresholds = {
  ...defaultThresholds,
  stake_success_rate: ["rate>0.90"],
  http_req_duration: ["p(95)<3000", "p(99)<8000"],
};

/** @deprecated Use stakeThresholds — kept for script compatibility during Phase 4. */
export const voteThresholds = stakeThresholds;

/** Thresholds for cloud-geo — allows cross-region RTT; expects ~99% stake success. */
export const geoStakeThresholds = {
  http_req_failed: ["rate<0.05"],
  checks: ["rate>0.95"],
  stake_success_rate: ["rate>0.95"],
  http_req_duration: ["p(95)<5000", "p(99)<8000"],
};

export function combinedThresholds(name = profile) {
  if (name === "cloud-geo") {
    return { ...defaultThresholds, ...geoStakeThresholds };
  }
  return { ...defaultThresholds, ...stakeThresholds, stake_success_rate: ["rate>0.90"] };
}

export function stakeWriteThresholds(name = profile) {
  if (name === "cloud-geo") {
    return { ...geoStakeThresholds };
  }
  return { ...stakeThresholds, stake_success_rate: ["rate>0.90"] };
}

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
