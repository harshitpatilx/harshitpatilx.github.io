const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canObserve = "IntersectionObserver" in window;
const fmt = (n) => new Intl.NumberFormat("en").format(n);

/* ---------- scroll reveal ---------- */
let revealIO;
export function observeReveal(nodes) {
  const list = [...nodes];
  if (reduceMotion || !canObserve) {
    list.forEach((n) => n.classList.add("is-visible"));
    return;
  }
  revealIO ||= new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("is-visible");
      revealIO.unobserve(e.target);
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
  list.forEach((n) => revealIO.observe(n));
}

/* ---------- animated counters ---------- */
function countUp(el, to) {
  if (reduceMotion) { el.textContent = fmt(to); return; }
  const start = performance.now();
  const duration = 1000;
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function setCounter(el, value) {
  if (!el) return;
  if (value == null || Number.isNaN(value)) { el.textContent = "–"; return; }
  if (reduceMotion || !canObserve) { el.textContent = fmt(value); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { io.disconnect(); countUp(el, value); }
  }, { threshold: 0.6 });
  io.observe(el);
}

/* ---------- typing effect ---------- */
export function initTyping(el, roles) {
  if (!el || !roles.length) return;
  if (reduceMotion || roles.length < 2) { el.textContent = roles[0]; return; }
  let role = 0, chars = 0, deleting = false;
  el.textContent = "";
  const step = () => {
    const word = roles[role];
    chars += deleting ? -1 : 1;
    el.textContent = word.slice(0, chars);
    let wait = deleting ? 35 : 75;
    if (!deleting && chars === word.length) { deleting = true; wait = 1700; }
    else if (deleting && chars === 0) { deleting = false; role = (role + 1) % roles.length; wait = 350; }
    setTimeout(step, wait);
  };
  setTimeout(step, 900);
}

/* ---------- card tilt (mouse only) ---------- */
export function initTilt(grid) {
  if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
  const max = 6;
  grid.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".repo");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty("--ry", `${(x * max).toFixed(2)}deg`);
    card.style.setProperty("--rx", `${(-y * max).toFixed(2)}deg`);
  });
  grid.addEventListener("pointerout", (e) => {
    const card = e.target.closest(".repo");
    if (!card) return;
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
}

/* ---------- navigation ---------- */
export function initNav() {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("nav-toggle");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  nav.querySelectorAll(".nav__menu a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
}
