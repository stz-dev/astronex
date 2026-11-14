// ASTRONEX shared code (classic script: works when index.html is opened by double-click)
// Shared helpers: data loading, starfield, header.
const DATA_URL = "../data/exhibits.json";

async function loadData() {
  // exhibits.js (window.EXHIBITS_DATA) works from file://; fall back to fetching the JSON.
  if (window.EXHIBITS_DATA) return window.EXHIBITS_DATA;
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error("Cannot load exhibits.json");
  return res.json();
}

const hallName = (data, id) => data.halls.find(h => h.id === id)?.name ?? id;

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const initStars = initBackground;

// Dynamic background engine: nebula + parallax stars + hall scenery + dust + shooting stars.
// Optional photos: drop img/bg-moon.jpg, bg-mars.jpg, bg-deep.jpg, bg-space.jpg (NASA, public domain).
// If a photo exists for a hall it is crossfaded in (Ken Burns) and procedural scenery is skipped.

const PAL = {
  space: { neb: [[27, 42, 92], [59, 29, 90], [14, 58, 82]], ridge: null,  planet: false, dust: 0 },
  moon:  { neb: [[70, 60, 34], [28, 40, 78], [40, 40, 52]], ridge: [58, 58, 66],  planet: false, dust: 26 },
  mars:  { neb: [[96, 34, 16], [52, 20, 62], [70, 30, 20]], ridge: [92, 38, 22],  planet: false, dust: 34 },
  deep:  { neb: [[14, 70, 100], [36, 26, 96], [10, 40, 70]], ridge: null, planet: true,  dust: 0 }
};
const lerp = (a, b, k) => a + (b - a) * k;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

let cvs, ctx, W, H, DPR, stars = [], dust = [], shoot = null, nextShoot = 4;
let cur = JSON.parse(JSON.stringify(PAL.space));          // animated palette
let target = "space", ridgeK = 0, planetK = 0, dustK = 0;  // blend factors
let mx = 0, my = 0, smx = 0, smy = 0;
const hasImg = {};
let imgLayer;

function setBg(hall) {
  target = PAL[hall] ? hall : "space";
  document.documentElement.dataset.bg = target;
  if (imgLayer) imgLayer.querySelectorAll("[data-h]").forEach(el =>
    el.classList.toggle("on", el.dataset.h === target && hasImg[target]));
}

function initBackground() {
  cvs = document.getElementById("stars");
  if (!cvs) return;
  ctx = cvs.getContext("2d");

  // photo layers (optional files)
  imgLayer = document.createElement("div");
  imgLayer.id = "bg-imgs"; imgLayer.setAttribute("aria-hidden", "true");
  document.body.prepend(imgLayer);
  for (const h of Object.keys(PAL)) {
    const probe = new Image();
    probe.onload = () => {
      hasImg[h] = true;
      const d = document.createElement("div");
      d.dataset.h = h; d.style.backgroundImage = `url(img/bg-${h}.jpg)`;
      imgLayer.append(d); setBg(target);
    };
    probe.src = `img/bg-${h}.jpg`;
  }

  addEventListener("resize", resize);
  addEventListener("pointermove", e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !reduce) requestAnimationFrame(frame); });
  resize();
  setBg(document.body.dataset.hall || "space");
  requestAnimationFrame(frame);
}

function resize() {
  DPR = Math.min(devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight;
  cvs.width = W * DPR; cvs.height = H * DPR;
  cvs.style.width = W + "px"; cvs.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const n = Math.round(W * H / 5200);
  stars = Array.from({ length: n }, () => {
    const z = Math.random();                       // depth 0 (far) .. 1 (near)
    return { x: Math.random() * W, y: Math.random() * H, z, r: .25 + z * 1.2, a: .2 + Math.random() * .6, gold: Math.random() < .08, ph: Math.random() * 6.28 };
  });
  dust = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .6 + Math.random() * 1.6, v: .1 + Math.random() * .35, a: .06 + Math.random() * .16 }));
  if (reduce) frame(0);
}

function ridge(layer, t, sy, col, alpha) {
  // layer 0 far .. 2 near
  const base = H * (.70 + layer * .07);
  const amp = H * (.07 + layer * .04);
  const off = smx * (14 + layer * 22) - sy * (.02 + layer * .03) + t * (2 + layer * 3);
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 8; x += 8) {
    const u = (x + off) / 140;
    const y = base - (Math.sin(u * (.6 + layer * .3) + layer * 1.7) * .55 + Math.sin(u * 1.9 + layer * 3.1) * .3 + Math.sin(u * 4.3 + layer) * .15) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.closePath();
  const g = ctx.createLinearGradient(0, base - amp, 0, H);
  const k = .8 + layer * .3;
  g.addColorStop(0, `rgba(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0},${alpha})`);
  g.addColorStop(1, `rgba(5,7,13,${Math.min(1, alpha + .2)})`);
  ctx.fillStyle = g; ctx.fill();
}

function frame(ms) {
  const t = ms / 1000, sy = scrollY;
  const P = PAL[target], K = .035;
  smx = lerp(smx, mx, .05); smy = lerp(smy, my, .05);

  // palette easing
  for (let i = 0; i < 3; i++) for (let c = 0; c < 3; c++) cur.neb[i][c] = lerp(cur.neb[i][c], P.neb[i][c], K);
  const rcol = P.ridge || [60, 60, 70];
  cur.ridge = cur.ridge || rcol.slice();
  for (let c = 0; c < 3; c++) cur.ridge[c] = lerp(cur.ridge[c], rcol[c], K);
  const wantRidge = (P.ridge && !hasImg[target]) ? 1 : 0;
  ridgeK = lerp(ridgeK, wantRidge, K);
  planetK = lerp(planetK, (P.planet && !hasImg[target]) ? 1 : 0, K);
  dustK = lerp(dustK, P.dust / 40, K);

  ctx.clearRect(0, 0, W, H);

  // nebula
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const x = W * (.5 + .38 * Math.sin(t * .05 + i * 2.1)) + smx * -30 * (i + 1);
    const y = H * (.45 + .3 * Math.cos(t * .04 + i * 1.7)) + smy * -20 * (i + 1) - sy * .03 * (i + 1);
    const r = Math.max(W, H) * (.5 + i * .12);
    const c = cur.neb[i];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},.20)`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = "source-over";

  // gas giant limb (deep space) — a nod to Pioneer 10 at Jupiter
  if (planetK > .01) {
    const cx = W * .82 - smx * 18, cy = H * 1.18 - sy * .02 + smy * -10, r = Math.min(W, H) * .78;
    ctx.save(); ctx.globalAlpha = planetK * .9;
    const g = ctx.createRadialGradient(cx - r * .25, cy - r * .35, r * .1, cx, cy, r);
    g.addColorStop(0, "rgba(120,150,180,.55)"); g.addColorStop(.5, "rgba(30,50,90,.7)"); g.addColorStop(1, "rgba(5,7,13,1)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "rgba(94,226,255,.25)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, r + 2, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.restore();
  }

  // stars (3 parallax depths)
  for (const s of stars) {
    const px = s.x + smx * -16 * s.z, py = ((s.y - sy * .06 * s.z - t * 2 * s.z) % H + H) % H + smy * -10 * s.z;
    const tw = reduce ? 1 : .65 + .35 * Math.sin(t * (.8 + s.z) + s.ph);
    ctx.fillStyle = (s.gold ? "rgba(217,164,65," : "rgba(230,233,240,") + (s.a * tw).toFixed(3) + ")";
    ctx.beginPath(); ctx.arc(px, py, s.r, 0, 6.283); ctx.fill();
  }

  // shooting star
  if (!reduce) {
    nextShoot -= 1 / 60;
    if (nextShoot < 0 && !shoot) { shoot = { x: Math.random() * W * .8, y: Math.random() * H * .35, life: 0 }; nextShoot = 7 + Math.random() * 8; }
    if (shoot) {
      shoot.life += .018; shoot.x += 11; shoot.y += 4.5;
      const a = Math.sin(Math.min(1, shoot.life) * Math.PI);
      const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - 110, shoot.y - 44);
      g.addColorStop(0, `rgba(230,233,240,${a * .9})`); g.addColorStop(1, "rgba(230,233,240,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - 110, shoot.y - 44); ctx.stroke();
      if (shoot.life >= 1) shoot = null;
    }
  }

  // hall scenery: layered ridgelines
  if (ridgeK > .02) {
    const rc = cur.ridge.map(Math.round);
    for (let l = 0; l < 3; l++) ridge(l, reduce ? 0 : t, sy, rc, ridgeK * (.55 + l * .22));
  }

  // drifting dust
  if (dustK > .02) {
    for (const d of dust) {
      d.x += d.v * (reduce ? 0 : 1); d.y += Math.sin(d.x * .01) * .15;
      if (d.x > W + 5) { d.x = -5; d.y = H * (.55 + Math.random() * .45); }
      ctx.fillStyle = `rgba(${cur.ridge.map(Math.round).map(v => Math.min(255, v + 90)).join(",")},${d.a * dustK})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
    }
  }

  if (!reduce && !document.hidden) requestAnimationFrame(frame);
}

// 3D slot. If the .glb exists -> <model-viewer>; otherwise a placeholder.
// The 3D team only has to drop files into frontend/models/ (names are in exhibits.json).

const MV_URL = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
let mvPromise;

async function modelExists(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    const type = r.headers.get("content-type") || "";
    return r.ok && !type.includes("text/html");
  } catch { return false; }
}

async function mountViewer(stage, ex, { controls = true, rotate = true } = {}) {
  stage.dataset.hall = ex.hall;
  stage.innerHTML = `
    <div class="ring"></div><div class="ring r2"></div>
    <div class="scanline"></div>
    <div class="tag">${esc(ex.short)} · MODEL</div>`;

  const exists = await modelExists(ex.model);

  if (!exists) {
    stage.insertAdjacentHTML("beforeend", `
      <div class="slot" role="img" aria-label="3D model goes here: ${esc(ex.short)}">
        <div class="glyph">◇</div>
        <b>3D MODEL SLOT</b>
        <code>${esc(ex.model)}</code>
        <small>waiting for the 3D team’s file</small>
      </div>`);
    return;
  }

  stage.insertAdjacentHTML("beforeend", `<div class="loader">LOADING TELEMETRY…</div>`);
  mvPromise ??= import(MV_URL);
  await mvPromise;

  const mv = document.createElement("model-viewer");
  mv.setAttribute("src", ex.model);
  mv.setAttribute("alt", `3D model: ${ex.name}`);
  mv.setAttribute("camera-controls", "");
  if (rotate) mv.setAttribute("auto-rotate", "");
  mv.setAttribute("rotation-per-second", "14deg");
  mv.setAttribute("shadow-intensity", "1.2");
  mv.setAttribute("shadow-softness", ".6");
  mv.setAttribute("exposure", "1");
  mv.setAttribute("tone-mapping", "aces");
  mv.setAttribute("camera-orbit", "35deg 72deg auto");
  mv.setAttribute("interaction-prompt", "none");
  mv.addEventListener("load", () => stage.querySelector(".loader")?.classList.add("done"));
  stage.prepend(mv);

  if (controls) addControls(stage, mv);
}

function addControls(stage, mv) {
  const bar = document.createElement("div");
  bar.className = "controls";
  bar.innerHTML = `
    <button data-m="solid" aria-pressed="true">Solid</button>
    <button data-m="blueprint" aria-pressed="false">Blueprint</button>
    <button data-m="scan" aria-pressed="false">Scan</button>
    <button data-m="rotate" aria-pressed="true">Rotate</button>`;
  stage.after(bar);
  bar.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const m = b.dataset.m;
    if (m === "rotate") {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on);
      on ? mv.setAttribute("auto-rotate", "") : mv.removeAttribute("auto-rotate");
      return;
    }
    stage.classList.toggle("blueprint", m === "blueprint");
    stage.classList.toggle("scan", m === "scan" || m === "blueprint");
    bar.querySelectorAll("[data-m=solid],[data-m=blueprint],[data-m=scan]")
       .forEach(x => x.setAttribute("aria-pressed", x === b));
  });
}

