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
// Координаты в «единицах ракеты»: центр корпуса (0,0), нос сверху (y<0), сопло снизу.
const BODY = (() => {
  const p = new Path2D();
  p.moveTo(0, -178); p.bezierCurveTo(56, -126, 62, -66, 62, -22); p.lineTo(62, 108); p.quadraticCurveTo(62, 126, 46, 126);
  p.lineTo(-46, 126); p.quadraticCurveTo(-62, 126, -62, 108); p.lineTo(-62, -22); p.bezierCurveTo(-62, -66, -56, -126, 0, -178); p.closePath(); return p;
})();
const FIN = (() => { const p = new Path2D(); p.moveTo(58, 34); p.lineTo(112, 118); p.quadraticCurveTo(116, 140, 96, 140); p.lineTo(58, 122); p.closePath(); return p; })();
const FIN_L = (() => { const p = new Path2D(); p.addPath(FIN, new DOMMatrix([-1, 0, 0, 1, 0, 0])); return p; })();
const NOZZLE = (() => { const p = new Path2D(); p.moveTo(-30, 124); p.lineTo(30, 124); p.lineTo(40, 152); p.lineTo(-40, 152); p.closePath(); return p; })();

function drawRocket(ctx, s, lw) {
  // розовая «наклейная» тень (как у кнопок сайта)
  ctx.save(); ctx.translate(16 * s, 16 * s); ctx.scale(s, s); ctx.fillStyle = C.pink;
  ctx.fill(BODY); ctx.fill(FIN); ctx.fill(FIN_L); ctx.fill(NOZZLE); ctx.restore();

  ctx.save(); ctx.scale(s, s); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = C.ink; ctx.lineWidth = lw / s;
  // сопло и плавники — позади корпуса
  ctx.fillStyle = C.indigo3; ctx.fill(NOZZLE); ctx.stroke(NOZZLE);
  ctx.fillStyle = C.pink; ctx.fill(FIN); ctx.stroke(FIN); ctx.fill(FIN_L); ctx.stroke(FIN_L);
  // корпус + полосы внутри (обрезаем по силуэту)
  ctx.fillStyle = C.cream; ctx.fill(BODY);
  ctx.save(); ctx.clip(BODY);
  ctx.fillStyle = C.pink; ctx.fillRect(-70, -190, 140, 112);                       // нос
  ctx.fillStyle = C.lime; ctx.fillRect(-70, 56, 140, 24);                           // лаймовый пояс
  ctx.fillStyle = "rgba(18,7,46,.16)"; ctx.fillRect(22, -190, 60, 330);             // мягкая тень справа
  ctx.beginPath(); ctx.moveTo(-70, -78); ctx.lineTo(70, -78); ctx.moveTo(-70, 56); ctx.lineTo(70, 56); ctx.moveTo(-70, 80); ctx.lineTo(70, 80); ctx.stroke();
  ctx.restore();
  ctx.stroke(BODY);
  // иллюминатор
  ctx.beginPath(); ctx.arc(0, -30, 27, 0, 6.2832); ctx.fillStyle = C.cyan; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-8, -39, 8, 3.4, 5.0); ctx.strokeStyle = C.cream; ctx.lineWidth = 5 / s * s; ctx.stroke();
  ctx.restore();
}

// Пламя: три слоя «капель», пляшут с разной фазой. y0 — низ сопла (в единицах ракеты), len — длина в единицах.
function drawFlame(ctx, s, lw, len, t) {
  if (len < 4) return;
  const f = (k, a, b) => 1 + Math.sin(t * k + a) * b;
  const layers = [[C.orange, 1, 1.0, 54], [C.gold, .74, .8, 38], [C.cream, .46, .62, 22]];
  ctx.save(); ctx.scale(s, s); ctx.translate(0, 148); ctx.lineJoin = "round";
  layers.forEach(([col, lk, wk, w], i) => {
    const L = len * lk * f(34 + i * 7, i * 1.7, .1), W = w * wk * f(27 + i * 5, i, .06);
    ctx.beginPath(); ctx.moveTo(-W, 0); ctx.bezierCurveTo(-W * 1.15, L * .35, -W * .45, L * .75, Math.sin(t * 19 + i) * 6, L);
    ctx.bezierCurveTo(W * .45, L * .75, W * 1.15, L * .35, W, 0); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    if (i === 0) { ctx.strokeStyle = C.ink; ctx.lineWidth = lw / s; ctx.stroke(); }
  });
  ctx.restore();
}

/* ============================== ГЛАВНАЯ ФУНКЦИЯ ============================== */
export function createIntro({ container = document.body, onAnimationEnd = () => {}, onFade = () => {}, title = "", subtitle = "", duration = TL.total } = {}) {
  // ---------- DOM ----------
  const el = document.createElement("div"); el.id = "xp-intro"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Intro animation");
  el.innerHTML = `<canvas></canvas><div class="xp-intro-title"><h1></h1><p></p></div>
    <div class="xp-intro-ui"><button type="button" data-a="replay">Replay ↺</button><button type="button" data-a="skip">Skip ›</button></div>`;
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
  const rs0 = () => S * 1.05;
  function rocketState(t) {
    const u = seg(t, 0, TL.exit), e = .22 * u + .78 * u * u;
    const y0 = H + 330 * rs0(), y1 = -380 * rs0();
    const nozzleY = y0 + (y1 - y0) * e;
    const thrust = easeOutQuad(seg(t, 0, .35));
    return { u, e, nozzleY, thrust, shake: 1 - seg(t, 0, TL.exit), squash: 0, speed: e };
  }

  function emit(kind, st, dt) {
    const n = (key, rate) => { acc[key] += rate * dt; let c = 0; while (acc[key] >= 1) { acc[key] -= 1; c++; } return c; };
    const nozzleY = st.nozzleY, cx = W / 2;
    if (kind === "plume" && nozzleY < H + 60 * S && st.thrust > .02 && nozzleY > -300 * S) {
      const c = n("plume", (17 + 15 * st.thrust) * (1 - .3 * st.u));
      for (let i = 0; i < c; i++) { const side = rnd() > .5 ? 1 : -1; puffs.push(mkPuff(cx + side * rnd() * 36 * S, nozzleY + (rnd() - .2) * 18 * S, side * (60 + rnd() * 260) * S, (40 + rnd() * 160) * S, (30 + rnd() * 34) * S, 1.1 + rnd() * .6, rnd() > .45, false)); }
    }
  }
  function mkPuff(x, y, vx, vy, r, life, light, front) { return { x, y, vx, vy, r, r0: r, age: 0, life, light, front, rot: rnd() * 6.28 }; }

  function simulate(dt, st) {
    emit("plume", st, dt);
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]; p.age += dt;
      if (p.age >= p.life) { puffs.splice(i, 1); continue; }
      const k = p.age / p.life;
      p.vx *= 1 - 1.5 * dt; p.vy *= 1 - 1.1 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r = p.r0 * (1 + 1.1 * easeOutQuad(k));
    }
  }

  /* ---------- отрисовка кадра ---------- */
  function puffPath(p, ox, oy, r) { ctx.beginPath(); ctx.arc(p.x + ox, p.y + oy, r, 0, 6.2832); }
  function drawPuffs(front) {
    const lw = Math.max(2.5, 5 * S);
    for (const p of puffs) {
      if (p.front !== front) continue;
      const k = p.age / p.life, a = Math.min(1, (1 - k) * 3.2) * Math.min(1, p.age * 10);
      ctx.globalAlpha = a;
      puffPath(p, 0, 0, p.r); ctx.fillStyle = p.light ? C.lav : "#bfaef2"; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.stroke();
      puffPath(p, -p.r * .14, -p.r * .16, p.r * .78); ctx.fillStyle = p.light ? C.cream : C.lav; ctx.fill();
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
        ctx.globalAlpha = Math.min(1, st.e * 3) * .55; ctx.strokeStyle = i % 3 ? C.cream : C.lime; ctx.lineWidth = Math.max(2, 4 * S);
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
    const rs = rs0(), lw = Math.max(3, 7 * S);
    const rx = W / 2 + Math.sin(t * 2.3) * 2 * S * (1 - st.e), ry = st.nozzleY - 152 * rs;
    ctx.save(); ctx.translate(rx, ry); ctx.scale(1 + st.squash * .6, 1 - st.squash);
    drawFlame(ctx, rs, lw, st.thrust * (150 + 170 * st.e), t);
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
  function capture() { cancelAnimationFrame(raf); running = false; captureMode = true; el.classList.add("on"); el.querySelector(".xp-intro-ui").style.display = "none"; reset(); resize(); render(); }
  function frame(dt) { step(dt); render(); return time; }
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; b.dataset.a === "replay" ? replay() : skip(); });

  function dispose() { disposed = true; running = false; cancelAnimationFrame(raf); removeEventListener("resize", resize); el.remove(); }
  return { el, play, replay, skip, seek, capture, frame, dispose, get time() { return time; }, get ended() { return ended; }, duration, hide() { el.classList.remove("on"); } };
}
