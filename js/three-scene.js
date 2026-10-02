import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function initScene(canvas) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower = (navigator.hardwareConcurrency || 4) <= 2;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: "low-power" });
  } catch (err) {
    canvas.hidden = true; // no WebGL: the page works fine without the scene
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.z = 7;

  const group = new THREE.Group();
  scene.add(group);

  // Outer wireframe, inner accent shape, and a loose shell of points.
  const lineMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
  const accentMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.95 });
  const outer = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.9, 1)), lineMat);
  const inner = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.0, 0)), accentMat);

  const count = lowPower ? 250 : 700;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 2.6 + Math.random() * 1.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pointMat = new THREE.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.8, sizeAttenuation: true });
  const points = new THREE.Points(pointGeo, pointMat);

  group.add(outer, inner, points);

  const draw = () => renderer.render(scene, camera);

  function applyTheme() {
    lineMat.color.set(cssVar("--scene-line"));
    accentMat.color.set(cssVar("--scene-accent"));
    pointMat.color.set(cssVar("--scene-accent"));
    if (!running) draw();
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wide = w / h > 1.15;
    group.position.set(wide ? 2.4 : 1.1, wide ? 0 : 1.7, 0);
    group.scale.setScalar(wide ? 1 : 0.7);
    if (!running) draw();
  }

  // Pointer and scroll drive the rotation.
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    target.x = e.clientX / window.innerWidth - 0.5;
    target.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  let running = false, raf = 0, last = performance.now();

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    current.x += (target.x - current.x) * 0.05;
    current.y += (target.y - current.y) * 0.05;
    const scroll = Math.min(window.scrollY / window.innerHeight, 1);

    outer.rotation.y += dt * 0.12;
    outer.rotation.x += dt * 0.05;
    inner.rotation.y -= dt * 0.25;
    inner.rotation.z += dt * 0.1;
    points.rotation.y += dt * 0.02;
    group.rotation.y = current.x * 0.8 + scroll * 1.2;
    group.rotation.x = current.y * 0.5;

    draw();
    raf = requestAnimationFrame(frame);
  }

  let inView = true;
  function sync() {
    const shouldRun = inView && !document.hidden && !reduceMotion;
    if (shouldRun && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!shouldRun && running) { running = false; cancelAnimationFrame(raf); }
  }

  new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; sync(); }).observe(canvas);
  document.addEventListener("visibilitychange", sync);
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener("themechange", applyTheme);

  applyTheme();
  resize();
  draw();
  sync();
}
