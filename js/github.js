import { CONFIG } from "./config.js";

const API = "https://api.github.com";
const TTL = CONFIG.cacheMinutes * 60 * 1000;
const CACHE_VERSION = "v1";

// TEST MODE
const SIMULATE_RATE_LIMIT = false;

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ t: Date.now(), data })
    );
  } catch (e) {
    /* ignore */
  }
}

class GitHubRateLimitError extends Error {
  constructor(resetAt = null) {
    super("GitHub API rate limit reached.");
    this.name = "GitHubRateLimitError";
    this.isRateLimit = true;
    this.resetAt = resetAt;
  }
}

function getRateLimitReset(res) {
  const value = res.headers.get("x-ratelimit-reset");

  if (!value) return null;

  const timestamp = Number(value) * 1000;

  return Number.isFinite(timestamp) ? timestamp : null;
}

async function cachedFetch(url, key, { force = false } = {}) {
  const cached = readCache(key);

  if (!force && cached && Date.now() - cached.t < TTL) {
    return {
      data: cached.data,
      t: cached.t,
      source: "cache",
    };
  }

  /*
   * ============================================================
   * TEST RATE LIMIT
   * ============================================================
   */

  if (SIMULATE_RATE_LIMIT) {
    const resetAt = Date.now() + 60 * 60 * 1000;

    const error = new GitHubRateLimitError(resetAt);

    if (cached) {
      return {
        data: cached.data,
        t: cached.t,
        source: "stale",
        rateLimited: true,
        resetAt: error.resetAt,
      };
    }

    throw error;
  }

  /*
   * ============================================================
   * REAL GITHUB REQUEST
   * ============================================================
   */

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    const remaining = res.headers.get("x-ratelimit-remaining");

    const isRateLimited =
      res.status === 429 ||
      (res.status === 403 && remaining === "0");

    if (isRateLimited) {
      const error = new GitHubRateLimitError(
        getRateLimitReset(res)
      );

      if (cached) {
        return {
          data: cached.data,
          t: cached.t,
          source: "stale",
          rateLimited: true,
          resetAt: error.resetAt,
        };
      }

      throw error;
    }

    if (!res.ok) {
      throw new Error(
        `GitHub responded with ${res.status}`
      );
    }

    const data = await res.json();

    writeCache(key, data);

    return {
      data,
      t: Date.now(),
      source: "live",
      rateLimited: false,
    };

  } catch (err) {

    if (err.isRateLimit) {
      throw err;
    }

    if (cached) {
      return {
        data: cached.data,
        t: cached.t,
        source: "stale",
      };
    }

    throw err;
  }
}

export async function loadProfile(opts) {
  const user = CONFIG.username;

  const res = await cachedFetch(
    `${API}/users/${user}`,
    `gh:${CACHE_VERSION}:profile:${user}`,
    opts
  );

  return res;
}

export async function loadRepos(opts) {
  const user = CONFIG.username;

  const url =
    `${API}/users/${user}/repos` +
    `?per_page=100&sort=pushed&type=owner`;

  const res = await cachedFetch(
    url,
    `gh:${CACHE_VERSION}:repos:${user}`,
    opts
  );

  const hidden = new Set(
    CONFIG.hiddenRepos.map((n) => n.toLowerCase())
  );

  const repos = res.data
    .filter(
      (r) =>
        !r.private &&
        !hidden.has(r.name.toLowerCase())
    )
    .map((r) => ({
      name: r.name,
      description: r.description,
      url: r.html_url,
      homepage: r.homepage,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      topics: r.topics || [],
      created: r.created_at,
      updated: r.pushed_at || r.updated_at,
      fork: r.fork,
      archived: r.archived,
    }));

  return {
    ...res,
    data: repos,
  };
}

export function filterRepos(
  repos,
  { query, language, sort, extended }
) {
  const q = query.trim().toLowerCase();

  const out = repos.filter((r) => {
    if (!extended && (r.fork || r.archived))
      return false;

    if (
      language !== "All" &&
      r.language !== language
    )
      return false;

    if (!q) return true;

    return (
      r.name.toLowerCase().includes(q) ||
      (r.description || "")
        .toLowerCase()
        .includes(q) ||
      (r.language || "")
        .toLowerCase()
        .includes(q) ||
      r.topics.some((t) =>
        t.includes(q)
      )
    );
  });

  const by = {
    updated: (a, b) =>
      new Date(b.updated) -
      new Date(a.updated),

    created: (a, b) =>
      new Date(b.created) -
      new Date(a.created),

    stars: (a, b) =>
      b.stars - a.stars ||
      new Date(b.updated) -
        new Date(a.updated),

    name: (a, b) =>
      a.name.localeCompare(b.name),
  };

  return out.sort(by[sort] || by.updated);
}

export function languageStats(repos) {
  const counts = new Map();

  for (const r of repos) {
    if (r.language) {
      counts.set(
        r.language,
        (counts.get(r.language) || 0) + 1
      );
    }
  }

  const total =
    [...counts.values()].reduce(
      (a, b) => a + b,
      0
    ) || 1;

  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      pct: (count / total) * 100,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.name.localeCompare(b.name)
    );
}