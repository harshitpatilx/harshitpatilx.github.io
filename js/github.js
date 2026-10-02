import { CONFIG } from "./config.js";

const API = "https://api.github.com";
const TTL = CONFIG.cacheMinutes * 60 * 1000;
const CACHE_VERSION = "v1";

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function writeCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), data })); } catch (e) { /* ignore */ }
}

/**
 * Fresh cache -> use it. Otherwise ask GitHub. If GitHub fails, fall back to
 * any older cached copy so the page still shows something.
 * source: "live" | "cache" | "stale"
 */
async function cachedFetch(url, key, { force = false } = {}) {
  const cached = readCache(key);
  if (!force && cached && Date.now() - cached.t < TTL) {
    return { data: cached.data, t: cached.t, source: "cache" };
  }
  try {
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);
    const data = await res.json();
    writeCache(key, data);
    return { data, t: Date.now(), source: "live" };
  } catch (err) {
    if (cached) return { data: cached.data, t: cached.t, source: "stale" };
    throw err;
  }
}

export async function loadProfile(opts) {
  const user = CONFIG.username;
  const res = await cachedFetch(`${API}/users/${user}`, `gh:${CACHE_VERSION}:profile:${user}`, opts);
  return res;
}

export async function loadRepos(opts) {
  const user = CONFIG.username;
  const url = `${API}/users/${user}/repos?per_page=100&sort=pushed&type=owner`;
  const res = await cachedFetch(url, `gh:${CACHE_VERSION}:repos:${user}`, opts);
  const hidden = new Set(CONFIG.hiddenRepos.map((n) => n.toLowerCase()));

  const repos = res.data
    .filter((r) => !r.private && !hidden.has(r.name.toLowerCase()))
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

  return { ...res, data: repos };
}

export function filterRepos(repos, { query, language, sort, extended }) {
  const q = query.trim().toLowerCase();
  const out = repos.filter((r) => {
    if (!extended && (r.fork || r.archived)) return false;
    if (language !== "All" && r.language !== language) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q) ||
      (r.language || "").toLowerCase().includes(q) ||
      r.topics.some((t) => t.includes(q))
    );
  });

  const by = {
    updated: (a, b) => new Date(b.updated) - new Date(a.updated),
    created: (a, b) => new Date(b.created) - new Date(a.created),
    stars: (a, b) => b.stars - a.stars || new Date(b.updated) - new Date(a.updated),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return out.sort(by[sort] || by.updated);
}

export function languageStats(repos) {
  const counts = new Map();
  for (const r of repos) {
    if (r.language) counts.set(r.language, (counts.get(r.language) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, pct: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
