// Interactive Explore: planet picker -> fly-in -> site markers -> info panel with a 3D object.
import * as T from "three";
import { makePlanetCanvas } from "./texgen.js";
import { Preview } from "./preview.js";

const PLANETS = {
  moon: { id: "moon", name: "Moon", radius: 1.35, atmo: 0xaebbd6, atmoK: .38, atmoPow: 3.2, bump: .9,  tex: "textures/moon.jpg" },
  mars: { id: "mars", name: "Mars", radius: 1.8,  atmo: 0xe8793d, atmoK: .95, atmoPow: 2.5, bump: .55, tex: "textures/mars.jpg" }
};
const CAM_Z = 10, FOV = 40;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tick = () => new Promise(r => setTimeout(r, 16));

function llToVec(lat, lon, R) {      // matches THREE.SphereGeometry + equirectangular map (lon -180..180)
  const phi = (lon + 180) / 360 * Math.PI * 2, th = (90 - lat) * Math.PI / 180;
  return new T.Vector3(-R * Math.cos(phi) * Math.sin(th), R * Math.cos(th), R * Math.sin(phi) * Math.sin(th));
}
function graticule(R) {
  const pts = [], add = (a, b) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (let lat = -60; lat <= 60; lat += 30) for (let i = 0; i < 96; i++) add(llToVec(lat, -180 + i * 3.75, R), llToVec(lat, -180 + (i + 1) * 3.75, R));
  for (let lon = -180; lon < 180; lon += 30) for (let i = 0; i < 48; i++) add(llToVec(-90 + i * 3.75, lon, R), llToVec(-90 + (i + 1) * 3.75, lon, R));
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
  return new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x5ee2ff, transparent: true, opacity: .14, depthWrite: false }));
}
function atmosphere(R, color, k, pow) {
  return new T.Mesh(new T.SphereGeometry(R * 1.14, 64, 48), new T.ShaderMaterial({
    uniforms: { c: { value: new T.Color(color) }, k: { value: k }, p: { value: pow }, o: { value: 1 } },
    vertexShader: "varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
    fragmentShader: "varying vec3 vN;varying vec3 vV;uniform vec3 c;uniform float k;uniform float p;uniform float o;void main(){float f=pow(abs(dot(vN,vV)),p);gl_FragColor=vec4(c,f*k*o);}",
    transparent: true, blending: T.AdditiveBlending, side: T.BackSide, depthWrite: false
  }));
}

export function createExplore(data) {
  const exhibits = data.exhibits;
  const sites = [];                               // one entry per map marker
  for (const ex of exhibits) for (const m of ex.markers || []) sites.push({ ex, ...m });
  const hallOf = id => data.halls.find(h => h.id === id);

  // ---------- DOM ----------
  const root = document.createElement("div");
  root.id = "xp"; root.className = "xp"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Interactive Explore");
  root.innerHTML = `
    <canvas class="xp-canvas"></canvas>
    <div class="xp-top">
      <div class="xp-crumb"><span>Interactive Explore</span><b class="xp-crumb-p"></b></div>
      <div class="xp-btns"><button type="button" class="xp-back">← Planets</button><button type="button" class="xp-exit">Exit</button></div>
    </div>
    <div class="xp-title"><h2></h2><p></p></div>
    <div class="xp-labels"></div>
    <aside class="xp-list" aria-label="Sites"><h3></h3><ul></ul></aside>
    <div class="xp-markers"></div>
    <aside class="xp-panel" aria-live="polite">
      <button type="button" class="xp-close" aria-label="Close panel">×</button>
      <span class="eyebrow xp-eb"></span>
      <h2 class="xp-name"></h2>
      <span class="status xp-status"></span>
      <div class="xp-pv"><canvas></canvas><small class="xp-tag"></small></div>
      <dl class="telemetry xp-tele"></dl>
      <p class="xp-sum"></p>
      <p class="fact xp-fact"></p>
      <a class="btn xp-more">Open full exhibit page →</a>
    </aside>
    <div class="xp-hint"></div>`;
  document.body.append(root);
  const $ = s => root.querySelector(s);
  const canvas = $(".xp-canvas"), labelsEl = $(".xp-labels"), markersEl = $(".xp-markers"), listEl = $(".xp-list ul");

  // ---------- three ----------
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(FOV, 1, .1, 100); camera.position.set(0, 0, CAM_Z);
  scene.add(new T.AmbientLight(0x3a4a78, .9));
  const sun = new T.DirectionalLight(0xfff0dc, 3.4); sun.position.set(-6, 3, 7); scene.add(sun);
  const rim = new T.DirectionalLight(0x5ee2ff, 1.1); rim.position.set(7, 2, -5); scene.add(rim);

  const P = {};                                   // planet objects
  let prepared = null;
  function prepare() {
    return prepared ??= (async () => {
      for (const spec of Object.values(PLANETS)) {
        const tex = new T.CanvasTexture(await makePlanetCanvas(spec.id)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
        const mat = new T.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: spec.bump, roughness: 1, metalness: 0, transparent: true });
        const mesh = new T.Mesh(new T.SphereGeometry(spec.radius, 128, 80), mat);
        const spin = new T.Group(); spin.add(mesh); spin.add(graticule(spec.radius * 1.004));
        const atmo = atmosphere(spec.radius, spec.atmo, spec.atmoK, spec.atmoPow);
        const group = new T.Group(); group.add(spin); group.add(atmo); scene.add(group);
        P[spec.id] = { spec, group, spin, mesh, mat, atmo, hover: 0, op: 1, opT: 1,
          pos: new T.Vector3(), posT: new T.Vector3(), sc: 1, scT: 1,
          rx: .35, ry: spec.id === "mars" ? 1 : 2, rxT: .35, ryT: spec.id === "mars" ? 1 : 2 };
        spin.rotation.set(P[spec.id].rx, P[spec.id].ry, 0);
        // optional real NASA map: textures/<planet>.jpg (equirectangular, lon -180..180). Needs a local server.
        if (location.protocol !== "file:") fetch(spec.tex, { method: "HEAD" }).then(r => {
          if (r.ok && !(r.headers.get("content-type") || "").includes("text/html"))
            new T.TextureLoader().load(spec.tex, t => { t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; mat.map = t; mat.bumpMap = t; mat.bumpScale = spec.bump * .5; mat.needsUpdate = true; });
        }).catch(() => {});
      }
    })();
  }

  // ---------- state ----------
  let state = "select", chosen = null, activeSite = null, running = false, hover = null, aspect = 1, W = 1, H = 1, last = 0;
  const preview = new Preview($(".xp-pv canvas"), $(".xp-tag"));
  const markerEls = [];                           // { el, site, local }

  const worldW = z => 2 * (CAM_Z - z) * Math.tan(FOV / 2 * Math.PI / 180) * aspect;
  const narrow = () => innerWidth < 900;
  const panelPx = () => Math.min(460, innerWidth * .92);

  function layout() {
    const portrait = aspect < .9;
    for (const [id, p] of Object.entries(P)) {
      const other = chosen && id !== chosen;
      if (state === "select") {
        const xo = Math.min(3.6, worldW(0) * .25);
        if (portrait) { p.posT.set(0, id === "moon" ? 2.5 : -2.3, 0); p.scT = .72; }
        else { p.posT.set(id === "moon" ? -xo : xo, 0, 0); p.scT = 1; }
        p.opT = 1;
      } else if (other) {
        p.posT.set(id === "moon" ? -9 : 9, 0, -4); p.scT = .35; p.opT = 0;
      } else {
        const ds = 1.85 / p.spec.radius;
        if (state === "site") {
          if (narrow()) p.posT.set(0, 1.5, 2.4);
          else p.posT.set(-(panelPx() / 2) / innerWidth * worldW(3), -.2, 3);
          p.scT = narrow() ? ds * .7 : ds;
        } else { p.posT.set(0, narrow() ? -.3 : -.45, 3.0); p.scT = narrow() ? ds * .8 : ds * .9; }
        p.opT = 1;
      }
    }
  }
  function resize() {
    W = innerWidth; H = innerHeight; aspect = W / H;
    renderer.setSize(W, H, false); camera.aspect = aspect; camera.updateProjectionMatrix();
    layout(); preview.resize();
  }
  addEventListener("resize", () => running && resize());

  // ---------- UI helpers ----------
  const setTitle = (h, p) => { $(".xp-title h2").textContent = h; $(".xp-title p").textContent = p; };
  function buildLabels() {
    labelsEl.innerHTML = Object.values(PLANETS).map(s =>
      `<button type="button" class="xp-plabel" data-p="${s.id}" data-hall="${s.id}"><b>${s.name}</b><span>${sites.filter(x => x.planet === s.id).length} abandoned sites</span></button>`).join("");
    labelsEl.querySelectorAll(".xp-plabel").forEach(b => {
      b.addEventListener("click", () => choose(b.dataset.p));
      b.addEventListener("pointerenter", () => (hover = b.dataset.p));
      b.addEventListener("pointerleave", () => (hover = null));
    });
  }
  function buildMarkers(planetId) {
    markersEl.innerHTML = ""; markerEls.length = 0; listEl.innerHTML = "";
    const R = PLANETS[planetId].radius, list = sites.filter(s => s.planet === planetId);
    $(".xp-list h3").textContent = `Sites on ${PLANETS[planetId].name}`;
    list.forEach((s, i) => {
      const el = document.createElement("button");
      el.type = "button"; el.className = "xp-marker"; el.setAttribute("aria-label", s.label);
      el.innerHTML = `<i class="dot"></i><i class="ring"></i><span class="lbl">${esc(s.label)}</span>`;
      el.style.setProperty("--d", i * 110 + "ms");
      el.addEventListener("click", () => focusSite(s));
      markersEl.append(el);
      markerEls.push({ el, site: s, local: llToVec(s.lat, s.lon, R * 1.004) });
      const li = document.createElement("li");
      li.innerHTML = `<button type="button"><span>${esc(s.ex.short)}</span><small>${esc(s.label)}</small></button>`;
      li.firstChild.addEventListener("click", () => focusSite(s));
      li._site = s; listEl.append(li);
    });
    setTimeout(() => markerEls.forEach(m => m.el.classList.add("in")), 900);
  }
  function fillPanel(s) {
    const ex = s.ex;
    $(".xp-eb").textContent = `${PLANETS[s.planet].name} · ${s.label}`;
    $(".xp-name").textContent = ex.name;
    $(".xp-status").textContent = ex.status;
    $(".xp-tele").innerHTML = [["Last contact", ex.last_contact], ["Mission years", ex.years], ["Location", ex.location], ["Agency", ex.agency], ["Creators", ex.creators]]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    $(".xp-sum").textContent = ex.summary;
    $(".xp-fact").innerHTML = `<b class="mono" style="font-size:.7rem;letter-spacing:.14em;color:var(--accent)">FACT</b><br>${esc(ex.fact)}`;
    $(".xp-more").href = "exhibit.html?id=" + encodeURIComponent(ex.id);
    preview.show(ex);
  }
  function syncUI() {
    root.dataset.state = state;
    root.dataset.hall = chosen || "";
    $(".xp-crumb-p").textContent = chosen ? " / " + PLANETS[chosen].name + (activeSite ? " / " + activeSite.ex.short : "") : "";
    $(".xp-back").style.visibility = state === "select" ? "hidden" : "visible";
    $(".xp-hint").textContent = state === "select" ? "Click a planet to fly in" : state === "planet" ? "Drag to rotate · Click a marker to open a site" : "Drag the planet to rotate · Esc to go back";
    labelsEl.classList.toggle("on", state === "select");
    $(".xp-panel").classList.toggle("open", state === "site");
    $(".xp-list").classList.toggle("on", state === "planet");
    markersEl.classList.toggle("on", state !== "select");
    if (state === "select") setTitle("Choose a planet", "Select a world to visit the abandoned sites left on its surface.");
    else if (state === "planet") setTitle(PLANETS[chosen].name, `${sites.filter(s => s.planet === chosen).length} abandoned sites · ${hallOf(chosen)?.tagline ?? ""}`);
    $(".xp-title").classList.toggle("off", state === "site");
    markerEls.forEach(m => m.el.classList.toggle("active", m.site === activeSite));
  }

  // ---------- actions ----------
  function choose(id) {
    if (!P[id]) return;
    chosen = id; state = "planet"; activeSite = null; hover = null;
    P[id].rxT = .3; layout(); buildMarkers(id); syncUI();
  }
  function focusSite(s) {
    const p = P[s.planet]; if (!p) return;
    activeSite = s; state = "site";
    const v = llToVec(s.lat, s.lon, 1), rho = Math.hypot(v.x, v.z);
    let psi = Math.atan2(-v.x, v.z); psi += Math.PI * 2 * Math.round((p.ry - psi) / (Math.PI * 2));
    p.ryT = psi; p.rxT = Math.atan2(v.y, rho);
    layout(); fillPanel(s); syncUI(); preview.start();
  }
  function closeSite() { if (state !== "site") return; state = "planet"; activeSite = null; preview.stop(); layout(); syncUI(); }
  function backToSelect() {
    if (state === "site") { preview.stop(); }
    state = "select"; chosen = null; activeSite = null; markerEls.length = 0;
    markersEl.innerHTML = ""; layout(); syncUI();
  }
  function escape() {            // returns true if it handled the key
    if (state === "site") { closeSite(); return true; }
    if (state === "planet") { backToSelect(); return true; }
    return false;
  }
  $(".xp-close").addEventListener("click", closeSite);
  $(".xp-back").addEventListener("click", () => (state === "site" ? closeSite() : backToSelect()));
  $(".xp-exit").addEventListener("click", () => api.onExit && api.onExit());

  // ---------- pointer: hover / click / drag ----------
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  let down = null;
  function pick(e) {
    ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1); ray.setFromCamera(ndc, camera);
    const meshes = Object.values(P).filter(p => p.group.visible && p.op > .5).map(p => p.mesh);
    const hit = ray.intersectObjects(meshes)[0];
    return hit ? Object.values(P).find(p => p.mesh === hit.object).spec.id : null;
  }
  canvas.addEventListener("pointermove", e => {
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y; down.moved += Math.abs(dx) + Math.abs(dy); down.x = e.clientX; down.y = e.clientY;
      const p = P[chosen]; if (p && state !== "select") { p.ryT += dx * .006; p.rxT = Math.max(-1.4, Math.min(1.4, p.rxT + dy * .006)); p.ry = p.ryT; p.rx = p.rxT; }
      return;
    }
    if (state === "select") { hover = pick(e); canvas.style.cursor = hover ? "pointer" : "default"; }
    else canvas.style.cursor = "grab";
  });
  canvas.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); if (state !== "select") canvas.style.cursor = "grabbing"; });
  canvas.addEventListener("pointerup", e => {
    const wasClick = down && down.moved < 6; down = null; canvas.style.cursor = state === "select" ? (hover ? "pointer" : "default") : "grab";
    if (wasClick && state === "select") { const id = pick(e); if (id) choose(id); }
  });

  // ---------- frame ----------
  const v = new T.Vector3(), c = new T.Vector3(), n = new T.Vector3(), tc = new T.Vector3();
  function frame(ms) {
    if (!running) return;
    const dt = Math.min(.05, (ms - last) / 1000 || .016); last = ms;
    const kP = 1 - Math.exp(-dt * 3.2), kR = 1 - Math.exp(-dt * 3.6);
    for (const p of Object.values(P)) {
      if (state === "select") { p.ry += dt * .12; p.ryT = p.ry; }
      else if (state === "planet" && p.spec.id === chosen && !down) { p.ryT += dt * .07; p.ry += (p.ryT - p.ry) * kR; }
      else { p.ry += (p.ryT - p.ry) * kR; }
      p.rx += (p.rxT - p.rx) * kR;
      p.spin.rotation.set(p.rx, p.ry, 0);
      p.hover += ((hover === p.spec.id && state === "select" ? 1 : 0) - p.hover) * (1 - Math.exp(-dt * 8));
      p.pos.lerp(p.posT, kP); p.sc += (p.scT * (1 + p.hover * .06) - p.sc) * kP; p.op += (p.opT - p.op) * (1 - Math.exp(-dt * 4));
      p.group.position.copy(p.pos); p.group.scale.setScalar(p.sc);
      p.mat.opacity = p.op; p.atmo.material.uniforms.o.value = p.op * (1 + p.hover * .8);
      p.group.visible = p.op > .01;
    }
    // planet name labels (select stage)
    if (state === "select") labelsEl.querySelectorAll(".xp-plabel").forEach(b => {
      const p = P[b.dataset.p]; if (!p) return;
      tc.set(p.pos.x, p.pos.y - p.spec.radius * p.sc * 1.3, p.pos.z).project(camera);
      b.style.transform = `translate(${(tc.x * .5 + .5) * W}px,${(-tc.y * .5 + .5) * H}px) translate(-50%,0)`;
      b.classList.toggle("hov", hover === b.dataset.p);
    });
    // markers
    if (chosen && markerEls.length) {
      const p = P[chosen]; p.spin.updateWorldMatrix(true, false); c.setFromMatrixPosition(p.group.matrixWorld);
      for (const m of markerEls) {
        v.copy(m.local).applyMatrix4(p.spin.matrixWorld);
        n.copy(v).sub(c).normalize(); tc.copy(camera.position).sub(v).normalize();
        const face = n.dot(tc); v.project(camera);
        m.el.style.transform = `translate(${(v.x * .5 + .5) * W}px,${(-v.y * .5 + .5) * H}px)`;
        const vis = Math.max(0, Math.min(1, (face - .08) / .25));
        m.el.style.setProperty("--vis", vis.toFixed(2)); m.el.style.pointerEvents = vis > .4 ? "auto" : "none";
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  const api = {
    root, prepare, onExit: null,
    async show() {
      await prepare();
      state = "select"; chosen = null; activeSite = null; hover = null; markerEls.length = 0; markersEl.innerHTML = "";
      for (const p of Object.values(P)) { p.op = p.opT = 1; p.sc = p.scT = 1; p.rxT = p.rx = .35; }
      buildLabels(); root.classList.add("on"); running = true; resize();
      for (const p of Object.values(P)) { p.pos.copy(p.posT); }
      syncUI(); last = performance.now(); requestAnimationFrame(frame);
    },
    hide() { running = false; preview.stop(); root.classList.remove("on"); },
    escape
  };
  return api;
}
