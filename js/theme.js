const root = document.documentElement;
const KEY = "theme";

function apply(theme, { save = false } = {}) {
  root.dataset.theme = theme;
  if (save) {
    try { localStorage.setItem(KEY, theme); } catch (e) { /* storage blocked */ }
  }
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.setAttribute("aria-pressed", String(theme === "dark"));
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

export function initTheme() {
  const btn = document.getElementById("theme-toggle");
  apply(root.dataset.theme || "light");

  btn.addEventListener("click", () => {
    apply(root.dataset.theme === "dark" ? "light" : "dark", { save: true });
  });

  // Follow the system setting until the visitor picks a theme themselves.
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", (e) => {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (err) {}
    if (!saved) apply(e.matches ? "dark" : "light");
  });
}
