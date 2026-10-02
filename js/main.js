import { CONFIG } from "./config.js";
import { initTheme } from "./theme.js";
import { loadProfile, loadRepos, filterRepos, languageStats } from "./github.js";
import {
  renderProjects, renderSkeletons, renderError, renderLangChips,
  renderStats, renderLanguageBar, renderStatus,
} from "./render.js";
import { initTyping, initNav, initTilt, observeReveal } from "./animations.js";

const $ = (id) => document.getElementById(id);
const grid = $("repo-grid");
const profileUrl = `https://github.com/${CONFIG.username}`;

const state = { query: "", language: "All", sort: "updated", extended: false };
let allRepos = [];
let lastLoaded = 0;
let loading = false;

function pool() {
  return allRepos.filter((r) => state.extended || (!r.fork && !r.archived));
}

function refresh() {
  const base = pool();
  const langs = languageStats(base);
  if (state.language !== "All" && !langs.some((l) => l.name === state.language)) state.language = "All";

  renderLangChips($("lang-filters"), langs, state.language, (name) => { state.language = name; refresh(); });
  renderProjects(grid, filterRepos(allRepos, state), clearFilters);
}

function clearFilters() {
  state.query = ""; state.language = "All"; state.sort = "updated";
  $("repo-search").value = ""; $("repo-sort").value = "updated";
  refresh();
}

async function load({ force = false } = {}) {
  if (loading) return;
  loading = true;
  if (!allRepos.length) renderSkeletons(grid);

  try {
    const [repoRes, profileRes] = await Promise.all([
      loadRepos({ force }),
      loadProfile({ force }).catch(() => null),
    ]);
    allRepos = repoRes.data;
    lastLoaded = Date.now();

    const own = allRepos.filter((r) => !r.fork && !r.archived);
    const langs = languageStats(own);
    renderStats({
      repos: own.length,
      stars: own.reduce((sum, r) => sum + r.stars, 0),
      languages: langs.length,
      followers: profileRes ? profileRes.data.followers : null,
    });
    renderLanguageBar(langs);

    if (repoRes.rateLimited) {
      renderStatus($("repo-status"), "rate-limit", repoRes.t, repoRes.resetAt);
    } else {
      renderStatus($("repo-status"), repoRes.source, repoRes.t);
    }

    refresh();
  } catch (err) {
    console.error(err);
    $("repo-status").textContent = "";
    renderError(grid, () => load({ force: true }), profileUrl, err);
  } finally {
    loading = false;
  }
}

function bindControls() {
  $("repo-search").addEventListener("input", (e) => { state.query = e.target.value; refresh(); });
  $("repo-sort").addEventListener("change", (e) => { state.sort = e.target.value; refresh(); });
  $("repo-extended").addEventListener("change", (e) => { state.extended = e.target.checked; refresh(); });

  // Coming back to the tab after a while: check GitHub for new repositories.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && lastLoaded && Date.now() - lastLoaded > CONFIG.cacheMinutes * 60 * 1000) load();
  });
}

function startScene() {
  const canvas = $("scene");
  import("./three-scene.js")
    .then((m) => m.initScene(canvas))
    .catch(() => { canvas.hidden = true; }); // CDN blocked or offline: site still works
}

initTheme();
initNav();
initTyping($("typed"), CONFIG.roles);
observeReveal(document.querySelectorAll("[data-reveal]"));
initTilt(grid);
bindControls();
$("year").textContent = new Date().getFullYear();
startScene();
load();
