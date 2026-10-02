import { observeReveal, setCounter } from "./animations.js";

/* ---------- tiny DOM helper (uses textContent, so repo text is never parsed as HTML) ---------- */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", HTML: "#e34c26",
  CSS: "#7a5cc7", C: "#6e6e6e", "C++": "#f34b7d", Java: "#b07219", Shell: "#89e051",
  PHP: "#7a86b8", EJS: "#a91e50", "Jupyter Notebook": "#DA5B0B", Go: "#00ADD8", Rust: "#dea584",
};

export function languageColor(name) {
  if (LANG_COLORS[name]) return LANG_COLORS[name];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${hash} 55% 55%)`;
}

const STAR = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 1.5l1.9 4.1 4.5.5-3.3 3 .9 4.4L8 11.3 4 13.5l.9-4.4-3.3-3 4.5-.5z"/></svg>';

function starIcon() {
  const s = document.createElement("span");
  s.className = "icon";
  s.innerHTML = STAR; // constant markup, no user data
  return s;
}

export function timeAgo(date) {
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "just now";
}

const isHttp = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

/* ---------- repo cards ---------- */
function card(r) {
  const isNew = Date.now() - new Date(r.created).getTime() < 30 * 86400000;
  return h("article", { class: "repo" },
    h("div", { class: "repo__top" },
      h("h3", { class: "repo__name" },
        h("a", { href: r.url, target: "_blank", rel: "noopener" }, r.name)),
      isNew && h("span", { class: "badge", text: "New" }),
      r.fork && h("span", { class: "badge badge--muted", text: "Fork" }),
      r.archived && h("span", { class: "badge badge--muted", text: "Archived" }),
    ),
    h("p", { class: "repo__desc", text: r.description || "No description yet." }),
    r.topics.length > 0 && h("ul", { class: "repo__topics" }, r.topics.slice(0, 4).map((t) => h("li", { text: t }))),
    h("div", { class: "repo__meta" },
      r.language && h("span", { class: "meta" },
        h("i", { class: "dot", style: `background:${languageColor(r.language)}` }), r.language),
      r.stars > 0 && h("span", { class: "meta", title: "Stars" }, starIcon(), String(r.stars)),
      h("span", { class: "meta meta--end", text: `Updated ${timeAgo(r.updated)}` }),
    ),
    isHttp(r.homepage) && h("a", { class: "repo__demo", href: r.homepage, target: "_blank", rel: "noopener", text: "Live site" }),
  );
}

export function renderProjects(grid, list, onClear) {
  grid.replaceChildren();
  if (!list.length) {
    grid.append(h("li", { class: "empty" },
      h("p", { text: "No repositories match these filters." }),
      h("button", { class: "btn btn--ghost", type: "button", onclick: onClear, text: "Clear filters" }),
    ));
    return;
  }
  list.forEach((r, i) => {
    grid.append(h("li", { dataset: { reveal: "" }, style: `--d:${Math.min(i, 8) * 50}ms` }, card(r)));
  });
  observeReveal(grid.querySelectorAll("[data-reveal]"));
}

export function renderSkeletons(grid, n = 6) {
  grid.replaceChildren(...Array.from({ length: n }, () =>
    h("li", {}, h("div", { class: "repo repo--skeleton", "aria-hidden": "true" },
      h("div", { class: "bar" }), h("div", { class: "bar" }), h("div", { class: "bar" })))));
}

export function renderError(grid, onRetry, profileUrl, error) {
  const isRateLimited = error?.isRateLimit;
  const resetText = error?.resetAt
    ? ` It should reset around ${new Date(error.resetAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
    : "";

  grid.replaceChildren(h("li", { class: "empty" },
    h("p", {
      text: isRateLimited
        ? `GitHub API rate limit reached.${resetText}`
        : "Couldn't load repositories from GitHub. This usually clears up in a few minutes."
    }),
    h("div", { style: "display:flex;gap:.75rem;flex-wrap:wrap;justify-content:center" },
      h("button", { class: "btn btn--primary", type: "button", onclick: onRetry, text: "Try again" }),
      h("a", { class: "btn btn--ghost", href: profileUrl, target: "_blank", rel: "noopener", text: "View on GitHub" }),
    ),
  ));
}

/* ---------- filters, stats, languages, status ---------- */
export function renderLangChips(container, languages, active, onPick) {
  const names = ["All", ...languages.map((l) => l.name)];
  container.replaceChildren(...names.map((name) =>
    h("button", { class: "filter", type: "button", "aria-pressed": String(name === active), onclick: () => onPick(name), text: name })));
}

export function renderStats({ repos, stars, languages, followers }) {
  setCounter(document.getElementById("stat-repos"), repos);
  setCounter(document.getElementById("stat-stars"), stars);
  setCounter(document.getElementById("stat-langs"), languages);
  setCounter(document.getElementById("stat-followers"), followers);
}

export function renderLanguageBar(stats) {
  const track = document.getElementById("lang-bar");
  const legend = document.getElementById("lang-legend");
  track.replaceChildren(...stats.map((s) =>
    h("span", { class: "langbar__seg", title: `${s.name}: ${s.count}`, style: `width:${s.pct}%;background:${languageColor(s.name)}` })));
  legend.replaceChildren(...stats.map((s) =>
    h("li", {}, h("i", { class: "dot", style: `background:${languageColor(s.name)}` }), `${s.name} ${Math.round(s.pct)}%`)));
  track.setAttribute("aria-label", "Language breakdown: " + stats.map((s) => `${s.name} ${Math.round(s.pct)}%`).join(", "));
}

export function renderStatus(el, source, t, resetAt = null) {
  const resetText = resetAt
    ? ` It should reset around ${new Date(resetAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
    : "";

  const messages = {
    live: "Synced with GitHub just now.",
    cache: `Synced with GitHub ${timeAgo(t)}.`,
    stale: `GitHub didn't respond, so this is the copy saved ${timeAgo(t)}.`,
    "rate-limit": `GitHub API rate limit reached. Showing the last saved copy.${resetText}`,
  };
  el.textContent = messages[source] || "";
  el.setAttribute("data-status", source || "");
}
