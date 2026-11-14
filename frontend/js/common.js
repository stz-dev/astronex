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

// Dynamic background: tinted indigo sky, twinkling stars and sparkles (3 parallax depths), drifting flat "sticker" planets
// with a pink crescent, rare shooting stars. The dotted grid is CSS (body::before in app.css).
// setBg(hall) tints the sky: space | moon | mars | deep.

const PAL = {
  space: { bg: [26, 14, 79],  doodle: [198, 243, 90] },
  moon:  { bg: [26, 14, 79],  doodle: [246, 236, 211] },
  mars:  { bg: [58, 14, 72],  doodle: [255, 138, 92] },
  deep:  { bg: [10, 26, 92],  doodle: [111, 216, 255] }
};
const COLORS = [[246, 236, 211], [198, 243, 90], [236, 81, 144], [111, 216, 255]];
const INK = "#12072e", PINK = "#ec5190";
const lerp = (a, b, k) => a + (b - a) * k;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

let cvs, ctx, W, H, DPR, stars = [], doodles = [], shoot = null, nextShoot = 5;
let target = "space", mx = 0, my = 0, smx = 0, smy = 0;
const cur = { bg: PAL.space.bg.slice(), doodle: PAL.space.doodle.slice() };

function setBg(hall) {
  target = PAL[hall] ? hall : "space";
  document.documentElement.dataset.bg = target;
}

function initBackground() {
  cvs = document.getElementById("stars");
  if (!cvs) return;
  ctx = cvs.getContext("2d");
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
  const n = Math.round(W * H / 14000);
  stars = Array.from({ length: n }, () => {
    const z = Math.random();                       // depth 0 (far) .. 1 (near)
    const w = Math.random();
    return { x: Math.random() * W, y: Math.random() * H, z, r: 1.2 + z * 2.2, a: .5 + Math.random() * .5, spark: Math.random() < .28,
      col: w < .55 ? COLORS[0] : w < .72 ? COLORS[1] : w < .86 ? COLORS[2] : COLORS[3], ph: Math.random() * 6.28 };
  });
  const nd = Math.max(3, Math.min(6, Math.round(W / 300)));
  doodles = Array.from({ length: nd }, (_, i) => ({
    x: Math.random() * W, y: Math.random() * H, r: 14 + Math.random() * 30, z: .25 + Math.random() * .6, v: (.08 + Math.random() * .16) * (Math.random() < .5 ? -1 : 1),
    col: i === 0 ? null : COLORS[i % 4], ring: Math.random() < .4, ph: Math.random() * 6.28, rot: (Math.random() - .5) * .8
  }));
  if (reduce) frame(0);
}

function doodle(d, t, sy) {
  const col = d.col || cur.doodle, r = d.r;
  const x = ((d.x + t * 12 * d.v - smx * 26 * d.z) % (W + 200) + W + 200) % (W + 200) - 100;
  const y = ((d.y - sy * .1 * d.z) % (H + 200) + H + 200) % (H + 200) - 100 + Math.sin(t * .5 + d.ph) * 10 - smy * 18 * d.z;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = .32; ctx.lineWidth = Math.max(3, r * .09); ctx.strokeStyle = INK;
  // pink crescent: a second disc, offset down-right, behind the planet
  ctx.fillStyle = PINK; ctx.beginPath(); ctx.arc(r * .2, r * .2, r, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle = `rgb(${col.map(Math.round).join(",")})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); ctx.stroke();
  // little highlight
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(-r * .35, -r * .35, r * .22, 0, 6.283); ctx.fill();
  if (d.ring) {                                   // orbit ring (back half hidden by the disc, front half drawn)
    ctx.rotate(d.rot + .5); ctx.strokeStyle = "#f6ecd3"; ctx.lineWidth = Math.max(2.5, r * .06);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r * .45, 0, 0, Math.PI); ctx.stroke();
  }
  ctx.restore();
}

function sparkle(x, y, r, col, a) {
  ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
  ctx.beginPath(); ctx.moveTo(x, y - r * 2.4);
  ctx.quadraticCurveTo(x, y, x + r * 2.4, y); ctx.quadraticCurveTo(x, y, x, y + r * 2.4);
  ctx.quadraticCurveTo(x, y, x - r * 2.4, y); ctx.quadraticCurveTo(x, y, x, y - r * 2.4); ctx.fill();
}

function frame(ms) {
  const t = ms / 1000, sy = scrollY, P = PAL[target], K = .04;
  smx = lerp(smx, mx, .05); smy = lerp(smy, my, .05);
  for (let c = 0; c < 3; c++) { cur.bg[c] = lerp(cur.bg[c], P.bg[c], K); cur.doodle[c] = lerp(cur.doodle[c], P.doodle[c], K); }

  ctx.fillStyle = `rgb(${cur.bg.map(Math.round).join(",")})`; ctx.fillRect(0, 0, W, H);

  for (const d of doodles) doodle(d, reduce ? 0 : t, sy);

  // stars: round dots and 4-point sparkles
  for (const s of stars) {
    const px = s.x + smx * -22 * s.z, py = ((s.y - sy * .08 * s.z - t * 3 * s.z) % H + H) % H + smy * -14 * s.z;
    const tw = reduce ? 1 : .55 + .45 * Math.sin(t * (1 + s.z * 1.4) + s.ph);
    if (s.spark) sparkle(px, py, s.r * tw * .9, s.col, s.a);
    else { ctx.fillStyle = `rgba(${s.col[0]},${s.col[1]},${s.col[2]},${(s.a * tw).toFixed(3)})`; ctx.beginPath(); ctx.arc(px, py, s.r * .75, 0, 6.283); ctx.fill(); }
  }

  // shooting star
  if (!reduce) {
    nextShoot -= 1 / 60;
    if (nextShoot < 0 && !shoot) { shoot = { x: Math.random() * W * .7, y: Math.random() * H * .4, life: 0 }; nextShoot = 6 + Math.random() * 7; }
    if (shoot) {
      shoot.life += .017; shoot.x += 13; shoot.y += 5.5;
      const a = Math.sin(Math.min(1, shoot.life) * Math.PI);
      ctx.save(); ctx.globalAlpha = a; ctx.lineCap = "round";
      ctx.strokeStyle = PINK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - 120, shoot.y - 50); ctx.stroke();
      ctx.strokeStyle = "#f6ecd3"; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - 96, shoot.y - 40); ctx.stroke();
      ctx.restore();
      if (shoot.life >= 1) shoot = null;
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

