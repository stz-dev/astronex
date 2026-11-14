// Procedural equirectangular planet textures (placeholder until real NASA maps are dropped in textures/).
// Longitude runs -180..180 left to right, so real equirectangular maps line up with the markers.
const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
};
function vnoise(u, v, px, py, s) {
  const x = u * px, y = v * py, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const X0 = ((x0 % px) + px) % px, X1 = (X0 + 1) % px;
  const a = hash(X0, y0, s), b = hash(X1, y0, s), c = hash(X0, y0 + 1, s), d = hash(X1, y0 + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(u, v, s, oct = 5) {
  let amp = .5, f = 1, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) { sum += amp * vnoise(u, v, 4 * f, 2 * f, s + o * 17); norm += amp; amp *= .5; f *= 2; }
  return sum / norm;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rng(seed) { let t = seed; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }

const slice = (() => { let t = 0; return async () => { if (performance.now() - t > 7) { await new Promise(r => setTimeout(r, 0)); t = performance.now(); } }; })();

export async function makePlanetCanvas(kind, W = 2048, H = 1024) {
  // Плоская «наклейка»: 3–4 заливки по шуму вместо реалистичных градиентов.
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const img = g.createImageData(W, H), d = img.data;
  const moon = kind === "moon", S = moon ? 11 : 37;
  const PAL = moon
    ? { base: [226, 218, 247], light: [244, 238, 255], dark: [176, 162, 226], deep: [138, 120, 205], crater: "rgba(122,104,196,.9)", rim: "rgba(255,255,255,.55)" }
    : { base: [255, 138, 92],  light: [255, 184, 132], dark: [226, 98, 70],  deep: [190, 66, 66],  crater: "rgba(168,52,60,.9)",  rim: "rgba(255,214,170,.55)" };
  for (let y = 0; y < H; y++) {
    if (y % 4 === 0) await slice();                       // keep the page responsive (animations, video)
    const v = y / H, lat = Math.abs(v - .5) * 180;
    for (let x = 0; x < W; x++) {
      const u = x / W, n = fbm(u, v, S), big = fbm(u, v, S + 99, 3);
      let col = PAL.base;
      if (big > .6) col = PAL.deep; else if (big > .53) col = PAL.dark;           // тёмные «моря» / тени
      if (n > .62 && big < .53) col = PAL.light;                                   // светлые пятна
      if (!moon && smooth(78, 85, lat + (n - .5) * 14) > .5) col = [250, 244, 232]; // полярные шапки
      const i = (y * W + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // craters: flat dark discs with a light rim
  const rand = rng(S), count = moon ? 520 : 240;
  for (let i = 0; i < count; i++) {
    if (i % 25 === 0) await slice();
    const rr = 4 + Math.pow(rand(), 3) * (moon ? 52 : 40);
    const y = H * (.1 + rand() * .8), x0 = rand() * W;
    const lat = (y / H - .5) * Math.PI, sx = 1 / Math.max(.28, Math.cos(lat));
    for (const x of [x0, x0 - W, x0 + W]) {
      if (x < -rr * sx * 2 || x > W + rr * sx * 2) continue;
      g.save(); g.translate(x, y); g.scale(sx, 1);
      g.fillStyle = PAL.crater; g.beginPath(); g.arc(0, 0, rr, 0, 6.2832); g.fill();
      g.strokeStyle = PAL.rim; g.lineWidth = Math.max(1.5, rr * .14);
      g.beginPath(); g.arc(0, 0, rr * .98, Math.PI * .8, Math.PI * 1.45); g.stroke();
      g.restore();
    }
  }
  return c;
}
