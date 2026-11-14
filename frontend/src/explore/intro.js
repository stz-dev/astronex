// Вступление: запуск ракеты в стиле сайта («стикеры»: индиго, лаймовые и розовые акценты, толстый тёмный контур, мультяшный дым).
// Одна непрерывная сцена ~7.5 с на Canvas 2D (без WebGL и постобработки — лёгкая и плавная).
// Время — единственный источник правды: updateTimeline(t) вычисляет положение ракеты, пламени, камеры; частицы дыма считаются шагами симуляции.
//
// API (то же, что раньше):
//   const intro = createIntro({ container, onAnimationEnd, title, subtitle, duration });
//   intro.play() / replay() / skip() / seek(sec) / capture() / frame(dt) / dispose() / hide()

/* ----------------------------- палитра сайта ----------------------------- */
const C = { ink: "#12072e", indigo: "#1a0e4f", indigo3: "#321b86", cream: "#f6ecd3", lime: "#c6f35a", pink: "#ec5190", cyan: "#6fd8ff", lav: "#d8cdf7", orange: "#ff9a3c", gold: "#ffd23f", space: "#03050c", veil: "#07021a" };

/* ------------------------------- таймлайн ------------------------------- */
// ракета уже летит: появляется снизу, разгоняется и уходит вверх; в момент fade сайт переключает фон на космос Explore
const TL = { total: 3.7, fade: 1.2, exit: 2.7, titleAt: 2.4 };

/* --------------------------- вспомогательные функции --------------------------- */
const clamp01 = x => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const easeOutQuad = x => 1 - (1 - x) * (1 - x);
const easeInOutCubic = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBack = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const mulberry = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* ------------------------------ ракета (контуры) ------------------------------ */
// Ракета-носитель в условных единицах: ось x=0, нос сверху (y=-330), срез сопел внизу (y=152).
// Стиль сайта сохранён (тёмный контур, фирменные розовый/лаймовый), но формы и детали взрослые: обтекатель,
// ступени, технологические швы и заклёпки, юбка двигателей, три сопла, стабилизаторы, мягкая светотень.
const BODY = (() => {
  const p = new Path2D();
  p.moveTo(0, -330); p.bezierCurveTo(23, -302, 38, -262, 40, -205);
  p.lineTo(40, 112); p.lineTo(53, 134); p.lineTo(-53, 134); p.lineTo(-40, 112);
  p.lineTo(-40, -205); p.bezierCurveTo(-38, -262, -23, -302, 0, -330); p.closePath(); return p;
})();
const FIN_R = (() => { const p = new Path2D(); p.moveTo(38, 14); p.lineTo(100, 126); p.quadraticCurveTo(106, 146, 90, 148); p.lineTo(52, 136); p.lineTo(38, 112); p.closePath(); return p; })();
const FIN_L = (() => { const p = new Path2D(); p.addPath(FIN_R, new DOMMatrix([-1, 0, 0, 1, 0, 0])); return p; })();
const bell = (cx, top, bot, wt, wb, tilt = 0) => { const p = new Path2D(); p.moveTo(cx - wt, top); p.lineTo(cx + wt, top); p.lineTo(cx + wb + tilt, bot); p.lineTo(cx - wb + tilt, bot); p.closePath(); return p; };
const BELL_C = bell(0, 126, 156, 15, 25), BELL_L = bell(-35, 128, 152, 9, 16, -4), BELL_R = bell(35, 128, 152, 9, 16, 4);
const ROCKET_H = 490;                                  // высота от носа до среза сопел (ед.)

function drawRocket(ctx, s, lw) {
  ctx.save(); ctx.scale(s, s); ctx.lineJoin = "round"; ctx.lineCap = "round"; const L = lw / s;
  ctx.strokeStyle = C.ink; ctx.lineWidth = L;

  // сопла (позади юбки): сталь + тёмное кольцо на срезе
  const steel = ctx.createLinearGradient(-26, 0, 26, 0);
  steel.addColorStop(0, "#9a8fc4"); steel.addColorStop(.45, "#5c4f93"); steel.addColorStop(1, "#2a1a66");
  for (const b of [BELL_L, BELL_R, BELL_C]) { ctx.fillStyle = steel; ctx.fill(b); ctx.stroke(b); }
  ctx.fillStyle = "rgba(18,7,46,.55)";
  for (const [cx, y, w] of [[0, 150, 24], [-35, 147, 15], [35, 147, 15]]) ctx.fillRect(cx - w, y, w * 2, 5);

  // стабилизаторы
  for (const f of [FIN_R, FIN_L]) {
    ctx.fillStyle = C.pink; ctx.fill(f); ctx.stroke(f);
    ctx.save(); ctx.clip(f); ctx.fillStyle = "rgba(18,7,46,.28)"; ctx.fillRect(-120, 0, 240, 200); ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.beginPath(); ctx.moveTo(f === FIN_R ? 42 : -42, 20); ctx.lineTo(f === FIN_R ? 96 : -96, 124); ctx.lineWidth = 5; ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.stroke(); ctx.restore();
  }

  // корпус: градиент по ширине (светлая левая сторона → тень справа)
  const g = ctx.createLinearGradient(-44, 0, 44, 0);
  g.addColorStop(0, "#fffaf0"); g.addColorStop(.3, "#f6ecd3"); g.addColorStop(.7, "#d9ccae"); g.addColorStop(1, "#8f84ac");
  ctx.fillStyle = g; ctx.fill(BODY);
  ctx.save(); ctx.clip(BODY);
  // носовой колпак и «юбка»
  ctx.fillStyle = C.pink; ctx.fillRect(-60, -340, 120, 52);
  ctx.fillStyle = C.indigo3; ctx.fillRect(-60, 92, 120, 60);
  // ступени: тёмные кольца-разъёмы
  ctx.fillStyle = C.ink;
  ctx.fillRect(-60, -209, 120, 8); ctx.fillRect(-60, -89, 120, 8); ctx.fillRect(-60, 86, 120, 6);
  // верхняя ступень: чёрные «качающиеся» сектора (как у ракет-ветеранов)
  ctx.fillStyle = C.ink;
  for (let i = 0; i < 4; i++) ctx.fillRect(-40 + i * 20, -198, 10, 40);
  // лаймовая и розовая полосы
  ctx.fillStyle = C.lime; ctx.fillRect(-60, -144, 120, 7);
  ctx.fillStyle = C.pink; ctx.fillRect(-60, 66, 120, 12);
  // швы и заклёпки
  ctx.strokeStyle = "rgba(18,7,46,.35)"; ctx.lineWidth = 1.6;
  for (const x of [-16, 14]) { ctx.beginPath(); ctx.moveTo(x, -80); ctx.lineTo(x, 62); ctx.stroke(); }
  ctx.fillStyle = "rgba(18,7,46,.5)";
  for (const y of [-72, 58]) for (let x = -34; x <= 34; x += 11) { ctx.beginPath(); ctx.arc(x, y, 1.7, 0, 6.2832); ctx.fill(); }
  // фирменная надпись по борту
  ctx.save(); ctx.translate(2, 0); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = '900 25px Rubik, "Arial Black", system-ui, sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.lineJoin = "round";
  ctx.strokeText("ASTRONEX", 0, 0); ctx.fillStyle = C.pink; ctx.fillText("ASTRONEX", 0, 0); ctx.restore();
  // светотень: тень справа, блик слева, копоть у двигателей
  ctx.fillStyle = "rgba(18,7,46,.24)"; ctx.fillRect(16, -340, 40, 500);
  ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(-31, -280, 6, 360);
  const soot = ctx.createLinearGradient(0, 20, 0, 134); soot.addColorStop(0, "rgba(18,7,46,0)"); soot.addColorStop(1, "rgba(18,7,46,.6)");
  ctx.fillStyle = soot; ctx.fillRect(-60, 20, 120, 120);
  ctx.restore();
  ctx.strokeStyle = C.ink; ctx.lineWidth = L; ctx.stroke(BODY);
  ctx.restore();
}

// Огонь двигателей: три факела, белое ядро → золото → оранжево-розовый хвост, «алмазы» ударных волн и свечение.
function drawFlame(ctx, s, len, t) {
  if (len < 6) return;
  const f = (k, a, b) => 1 + Math.sin(t * k + a) * b;
  ctx.save(); ctx.scale(s, s); ctx.translate(0, 152); ctx.globalCompositeOperation = "lighter";
  // свечение вокруг среза
  const R = 150 + len * .22, glow = ctx.createRadialGradient(0, 18, 4, 0, 18, R);
  glow.addColorStop(0, "rgba(255,190,90,.55)"); glow.addColorStop(.45, "rgba(255,110,60,.2)"); glow.addColorStop(1, "rgba(255,80,120,0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 18, R, 0, 6.2832); ctx.fill();
  const torch = (cx, w0, L) => {
    const draw = (k, wk, g0, g1, g2) => {
      const Lk = L * k * f(31 + cx, cx, .06), Wk = w0 * wk * f(23, cx * .1, .05);
      const gr = ctx.createLinearGradient(0, 0, 0, Lk); gr.addColorStop(0, g0); gr.addColorStop(.5, g1); gr.addColorStop(1, g2);
      ctx.beginPath(); ctx.moveTo(cx - Wk, 0); ctx.bezierCurveTo(cx - Wk * 1.12, Lk * .3, cx - Wk * .55, Lk * .72, cx + Math.sin(t * 17 + cx) * 3, Lk);
      ctx.bezierCurveTo(cx + Wk * .55, Lk * .72, cx + Wk * 1.12, Lk * .3, cx + Wk, 0); ctx.closePath(); ctx.fillStyle = gr; ctx.fill();
    };
    draw(1, 1, "rgba(255,150,60,.95)", "rgba(255,90,70,.55)", "rgba(236,81,144,0)");
    draw(.72, .72, "rgba(255,225,120,1)", "rgba(255,170,60,.8)", "rgba(255,120,60,0)");
    draw(.42, .4, "rgba(255,255,255,1)", "rgba(255,244,200,.85)", "rgba(255,230,160,0)");
    // ударные «алмазы»
    for (let k = 0; k < 4; k++) {
      const y = L * (.16 + k * .13) * f(31 + cx, cx, .04), w = w0 * (.42 - k * .07) * f(40, k, .1);
      ctx.fillStyle = `rgba(255,255,255,${.55 - k * .1})`; ctx.beginPath(); ctx.ellipse(cx, y, Math.max(2, w), w * .7 + 4, 0, 0, 6.2832); ctx.fill();
    }
  };
  torch(0, 23, len); torch(-35, 14, len * .66); torch(35, 14, len * .66);
  ctx.restore();
}

/* ============================== ГЛАВНАЯ ФУНКЦИЯ ============================== */
export function createIntro({ container = document.body, onAnimationEnd = () => {}, onFade = () => {}, title = "", subtitle = "", duration = TL.total } = {}) {
  // ---------- DOM ----------
  const el = document.createElement("div"); el.id = "xp-intro"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Intro animation");
  el.innerHTML = `<canvas></canvas><div class="xp-intro-title"><h1></h1><p></p></div>`;
  el.querySelector("h1").textContent = title; el.querySelector(".xp-intro-title p").textContent = subtitle;
  container.append(el);
  if (!title) el.querySelector(".xp-intro-title").remove();
  const canvas = el.querySelector("canvas"), titleEl = el.querySelector(".xp-intro-title"), ctx = canvas.getContext("2d");

  // ---------- размеры ----------
  let W = 1, H = 1, dpr = 1, S = 1, maxDpr = Math.min(devicePixelRatio || 1, 2);
  function resize() {
    W = el.clientWidth || innerWidth; H = el.clientHeight || innerHeight;
    dpr = Math.min(maxDpr, W * H * maxDpr * maxDpr > 4.2e6 ? 1.5 : maxDpr);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    S = Math.max(.45, Math.min(H / 780, W / 620));              // масштаб ракеты и толщины линий
  }
  addEventListener("resize", resize); resize();

  // ---------- состояние симуляции (дым) ----------
  let rnd = mulberry(7), puffs = [], acc = { plume: 0 }, faded = false;
  let time = 0, raf = 0, running = false, ended = false, prev = 0, disposed = false, captureMode = false, frames = 0, accT = 0;

  // положение ракеты: стартует ниже кадра уже на ходу, разгоняется (ease-in) и уходит за верхний край
  const rs0 = () => S * .82;
  function rocketState(t) {
    const u = seg(t, 0, TL.exit), e = .22 * u + .78 * u * u;
    const y0 = H + (ROCKET_H + 30) * rs0(), y1 = -400 * rs0();
    const nozzleY = y0 + (y1 - y0) * e;
    const thrust = easeOutQuad(seg(t, 0, .35));
    return { u, e, nozzleY, thrust, shake: 1 - seg(t, 0, TL.exit), squash: 0, speed: e };
  }

  function emit(kind, st, dt) {
    const n = (key, rate) => { acc[key] = (acc[key] || 0) + rate * dt; let c = 0; while (acc[key] >= 1) { acc[key] -= 1; c++; } return c; };
    const nozzleY = st.nozzleY, cx = W / 2;
    if (kind !== "plume" || !(nozzleY < H + 80 * S && st.thrust > .02 && nozzleY > -300 * S)) return;
    // дым: широкий мягкий шлейф, разлетается в стороны и тает
    for (let i = n("smoke", (22 + 12 * st.thrust) * (1 - .25 * st.u)); i > 0; i--) {
      const side = rnd() > .5 ? 1 : -1, sp = rnd();
      puffs.push(mkPuff(cx + side * rnd() * 30 * S, nozzleY + 8 * S + rnd() * 16 * S, side * (30 + sp * sp * 260) * S, (50 + rnd() * 150) * S, (22 + rnd() * 24) * S, .9 + rnd() * .9, rnd() > .5, rnd() > .55, "smoke"));
    }
    // искры и раскалённые частицы
    for (let i = n("spark", 70 * st.thrust); i > 0; i--) {
      puffs.push(mkPuff(cx + (rnd() - .5) * 40 * S, nozzleY + 20 * S + rnd() * 30 * S, (rnd() - .5) * 220 * S, (260 + rnd() * 380) * S, (1.4 + rnd() * 2.4) * S, .35 + rnd() * .5, true, true, "spark"));
    }
  }
  function mkPuff(x, y, vx, vy, r, life, light, front, kind) { return { x, y, vx, vy, r, r0: r, age: 0, life, light, front, kind, rot: rnd() * 6.28 }; }

  function simulate(dt, st) {
    emit("plume", st, dt);
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]; p.age += dt;
      if (p.age >= p.life) { puffs.splice(i, 1); continue; }
      const k = p.age / p.life;
      if (p.kind === "spark") { p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 1 - .8 * dt; continue; }
      p.vx *= 1 - 1.5 * dt; p.vy *= 1 - 1.1 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r = p.r0 * (1 + 1.8 * easeOutQuad(k));
    }
  }

  /* ---------- отрисовка кадра ---------- */
  const lerpC = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  function drawPuffs(front) {
    for (const p of puffs) {
      if (p.front !== front) continue;
      const k = p.age / p.life;
      if (p.kind === "spark") {
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - k) * .95;
        ctx.fillStyle = k < .4 ? "#fff3c4" : C.orange; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
        ctx.globalCompositeOperation = "source-over"; continue;
      }
      // дым: раскалённый оранжевый → серо-лавандовый → прозрачный, без контура — мягкий градиент
      const col = lerpC([255, 176, 96], p.light ? [222, 212, 246] : [168, 154, 214], Math.min(1, k * 3.2));
      const a = Math.min(1, p.age * 9) * (1 - k) * (1 - k * .3) * (p.light ? .5 : .62);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.25);
      const c = `${col[0] | 0},${col[1] | 0},${col[2] | 0}`;
      g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(.55, `rgba(${c},${a * .6})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.25, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    const t = time, st = rocketState(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // фон не рисуем: через прозрачный canvas виден фон самого сайта
    ctx.clearRect(0, 0, W, H);
    const scroll = st.e * H * 1.1;
    // линии скорости (детерминированы временем)
    if (st.e > .02) {
      ctx.save(); ctx.lineCap = "round";
      for (let i = 0; i < 26; i++) {
        const x = ((i * 0.6180339 + .13) % 1) * W, sp = .7 + (i % 5) * .22, len = (50 + (i % 4) * 36) * S * (.4 + st.e * 1.6), span = H * 1.5;
        const y = (((i * 0.3819 + scroll * sp / span * 2.2) % 1 + 1) % 1) * span - H * .25;
        ctx.globalAlpha = Math.min(1, st.e * 3) * .3; ctx.strokeStyle = i % 4 ? C.lav : C.lime; ctx.lineWidth = Math.max(1.2, 2.2 * S);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
      }
      ctx.restore();
    }
    // тряска камеры на разогреве и старте
    const shake = st.shake * 3.5 * S * seg(t, 0, .4);
    const sx = Math.sin(t * 61) * shake + Math.sin(t * 37 + 1) * shake * .5, sy = Math.sin(t * 53 + 2) * shake * .8;
    ctx.save(); ctx.translate(sx, sy);

    drawPuffs(false);
    // ракета: x по центру, лёгкое покачивание; nozzleY — низ сопла
    const rs = rs0(), lw = Math.max(2.2, 5 * S);
    const rx = W / 2 + Math.sin(t * 2.3) * 2 * S * (1 - st.e), ry = st.nozzleY - 152 * rs;
    ctx.save(); ctx.translate(rx, ry); ctx.scale(1 + st.squash * .6, 1 - st.squash);
    drawFlame(ctx, rs, st.thrust * (190 + 230 * st.e), t);
    drawRocket(ctx, rs, lw);
    ctx.restore();
    drawPuffs(true);
    ctx.restore();

    // заголовок (CSS-класс .show): «выскакивает» когда ракета уходит
    if (!titleEl) return;
    if (captureMode) {
      const k = clamp01(easeOutBack(seg(t, TL.titleAt, TL.titleAt + .7))), k2 = easeOutQuad(seg(t, TL.titleAt + .2, TL.titleAt + .8)), h1 = titleEl?.firstElementChild, sub = titleEl.lastElementChild;
      h1.style.cssText = `transition:none;opacity:${seg(t, TL.titleAt, TL.titleAt + .25)};transform:scale(${(.6 + .4 * easeOutBack(seg(t, TL.titleAt, TL.titleAt + .7))).toFixed(4)}) rotate(${(-4 * (1 - k)).toFixed(2)}deg)`; sub.style.cssText = `transition:none;opacity:${k2}`;
    } else titleEl.classList.toggle("show", t >= TL.titleAt);
  }

  /* ---------- управление ---------- */
  function reset() { time = 0; ended = false; faded = false; rnd = mulberry(7); puffs = []; acc = { plume: 0 }; titleEl?.classList.remove("show"); }
  function step(dt) { time += dt; simulate(dt, rocketState(time)); if (!faded && time >= TL.fade) { faded = true; onFade(); } }
  function animate(now) {
    if (!running || disposed) return;
    raf = requestAnimationFrame(animate);
    const dt = Math.min(.04, (now - prev) / 1000 || 0); prev = now;
    step(dt); render();
    // автоподстройка: если кадр дольше ~26 мс, снижаем разрешение
    accT += dt; frames++;
    if (frames === 30) { if (accT / frames > .026 && maxDpr > 1) { maxDpr = Math.max(1, maxDpr - .5); resize(); } accT = 0; frames = 0; }
    if (time >= duration && !ended) { ended = true; running = false; cancelAnimationFrame(raf); render(); onAnimationEnd(); }
  }
  function play() { if (disposed) return; el.classList.add("on"); resize(); if (!running) { running = true; prev = performance.now(); raf = requestAnimationFrame(animate); } }
  function replay() { cancelAnimationFrame(raf); running = false; reset(); play(); }
  function skip() { if (ended || disposed) return; if (!faded) { faded = true; onFade(); } ended = true; running = false; cancelAnimationFrame(raf); onAnimationEnd(); }
  function seek(sec) { cancelAnimationFrame(raf); running = false; reset(); let n = 0; while (time < sec && n++ < 4000) step(1 / 60); render(); }
  function capture() { cancelAnimationFrame(raf); running = false; captureMode = true; el.classList.add("on"); reset(); resize(); render(); }
  function frame(dt) { step(dt); render(); return time; }

  function dispose() { disposed = true; running = false; cancelAnimationFrame(raf); removeEventListener("resize", resize); el.remove(); }
  return { el, play, replay, skip, seek, capture, frame, dispose, get time() { return time; }, get ended() { return ended; }, duration, hide() { el.classList.remove("on"); } };
}
