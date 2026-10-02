/* Runs before first paint so the page never flashes the wrong theme. */
(function () {
  var root = document.documentElement;
  var theme = null;
  root.classList.add("js");
  try { theme = localStorage.getItem("theme"); } catch (e) {}
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  root.dataset.theme = theme;
})();
