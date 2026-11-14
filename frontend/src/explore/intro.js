// Кинематографичное вступление на three.js (вместо mp4): одна непрерывная сцена ~14 секунд.
//   космос → ракета поднимается снизу → дым и огонь → всё темнеет и растворяется в дыму → чёрный экран + заголовок.
//
// Использование:
//   const intro = createIntro({ onAnimationEnd() { ... } });   // создаёт оверлей с canvas и кнопками
//   intro.play();   // intro.replay(), intro.skip(), intro.dispose()
//
// Все этапы управляются ОДНИМ таймлайном: progress 0..1 → updateTimeline(progress). Никаких setTimeout внутри сцены.
import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/* ============================== ТАЙМЛАЙН ============================== */
// Ключевые моменты в секундах (общая длительность TOTAL). Меняйте здесь — вся сцена подстроится.
const TL = {
  total: 14.0,
  ignite: 1.3,      // зажигание: появляется огонь и первый дым
  launch: 1.8,      // ракета трогается с места
  exit: 10.6,       // сопло ракеты уходит за верхний край кадра
  smokeStop: 10.7,  // шлейф перестаёт выпускать новые частицы
  titleAt: 12.0     // появляется заголовок (CSS-класс .show)
};
const clamp01 = x => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));            // прогресс отрезка [a,b] в 0..1
const lerp = (a, b, k) => a + (b - a) * k;
const easeInQuad = x => x * x;
const easeOutQuad = x => 1 - (1 - x) * (1 - x);
const easeInOutCubic = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

/* ============================== ШУМ ============================== */
// Быстрый value-noise по таблице 32³ (для завихрений дыма и текстур). Диапазон 0..1.
const NS = 32, NTAB = new Float32Array(NS * NS * NS);
{ let s = 1337; for (let i = 0; i < NTAB.length; i++) { s = (s * 16807) % 2147483647; NTAB[i] = s / 2147483647; } }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const X0 = xi & 31, X1 = (xi + 1) & 31, Y0 = (yi & 31) << 5, Y1 = ((yi + 1) & 31) << 5, Z0 = (zi & 31) << 10, Z1 = ((zi + 1) & 31) << 10;
  const a = NTAB[X0 + Y0 + Z0], b = NTAB[X1 + Y0 + Z0], c = NTAB[X0 + Y1 + Z0], d = NTAB[X1 + Y1 + Z0];
  const e = NTAB[X0 + Y0 + Z1], f = NTAB[X1 + Y0 + Z1], g = NTAB[X0 + Y1 + Z1], h = NTAB[X1 + Y1 + Z1];
  const l0 = a + (b - a) * u, l1 = c + (d - c) * u, l2 = e + (f - e) * u, l3 = g + (h - g) * u;
  const m0 = l0 + (l1 - l0) * v, m1 = l2 + (l3 - l2) * v;
  return m0 + (m1 - m0) * w;
}
const fbm = (x, y, z) => { let a = .5, f = 1, s = 0; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2; a *= .5; } return s; };

/* ============================== ТЕКСТУРЫ (canvas, без внешних файлов) ============================== */
function canvasTex(c) { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }

// Атлас 2×2 «облачков» для дыма: фрактальный шум × радиальная маска (рваные края) + запечённая подсветка сверху в RGB.
function makeCloudAtlas() {
  const S = 512, H = S / 2, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), img = g.createImageData(S, S);
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * H, oy = Math.floor(cell / 2) * H, sd = cell * 7.3 + 1.7;
    for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) {
      const nx = (x / H - .5) * 2, ny = (y / H - .5) * 2, r = Math.hypot(nx, ny);
      const w = fbm(nx * 1.4 + sd, ny * 1.4 + sd, 3.1) , w2 = fbm(nx * 3.2 + sd, ny * 3.2 - sd, 9.4);
      const mask = 1 - Math.min(1, Math.max(0, (r + (w - .5) * .55 - .28) / .62));        // рваный край
      const dens = Math.min(1, Math.max(0, (w2 * .55 + w * .6) * mask * 1.7 - .12));       // внутренняя «ватность»
      const lit = .55 + .45 * Math.min(1, Math.max(0, .5 - ny * .5 + (w2 - .5) * .6));     // свет сверху, тень снизу
      const i = ((oy + y) * S + ox + x) * 4, v = Math.round(255 * lit);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = Math.round(255 * dens * dens * (3 - 2 * dens));
    }
  }
  g.putImageData(img, 0, 0); const t = canvasTex(c); t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; return t;
}
function makeGlowTex() {                                          // мягкое светящееся пятно (огонь, свечение сопла)
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.25, "rgba(255,255,255,.55)"); gr.addColorStop(.6, "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return canvasTex(c);
}
function makeNebulaTex(rgb) {                                     // облако туманности: много мягких пятен
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
  for (let i = 0; i < 46; i++) {
    const a = rnd(0, Math.PI * 2), d = Math.pow(Math.random(), .8) * S * .3, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d * .7, r = rnd(S * .08, S * .24);
    const gr = g.createRadialGradient(x, y, 0, x, y, r), al = rnd(.04, .1);
    gr.addColorStop(0, `rgba(${rgb},${al})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  return canvasTex(c);
}
function makePlanetTex() {                                        // ледяной гигант: полосы + шум (по 3D-координатам → без шва)
  const W = 512, H = 256, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = y / H, lat = (v - .5) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = x / W * Math.PI * 2, px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
      const n = fbm(px * 2.4 + 3, py * 2.4 + 3, pz * 2.4 + 3), band = Math.sin((v + (n - .5) * .22) * 34) * .5 + .5;
      const warm = Math.max(0, Math.sin((v + n * .12) * 11 + 1) - .55) * 1.6;
      let r = lerp(.16, .6, band), gg = lerp(.3, .72, band), b = lerp(.44, .84, band);
      r = lerp(r, .78, warm * .55); gg = lerp(gg, .56, warm * .55); b = lerp(b, .42, warm * .55);
      const k = .75 + n * .5, i = (y * W + x) * 4;
      img.data[i] = Math.min(255, r * k * 255); img.data[i + 1] = Math.min(255, gg * k * 255); img.data[i + 2] = Math.min(255, b * k * 255); img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0); return canvasTex(c);
}

/* ============================== ЗВЁЗДЫ ============================== */
// Points с мерцанием (шейдер). Прозрачность управляется uniform uOpacity (исчезают последними).
function createStars(group) {
  const n = 2600, pos = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n), speed = new Float32Array(n), tint = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const z = -rnd(.12, 1), a = rnd(0, Math.PI * 2), rr = Math.sqrt(1 - z * z), R = rnd(110, 170);
    pos.set([Math.cos(a) * rr * R, Math.sin(a) * rr * R * .75, z * R], i * 3);
    size[i] = Math.pow(Math.random(), 3) * 2.4 + .9; phase[i] = rnd(0, 6.28); speed[i] = rnd(.6, 2.6);
    const w = Math.random(); tint.set(w < .2 ? [.7, .82, 1] : w < .3 ? [1, .86, .7] : [1, 1, 1], i * 3);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3)); geo.setAttribute("aSize", new T.BufferAttribute(size, 1));
  geo.setAttribute("aPhase", new T.BufferAttribute(phase, 1)); geo.setAttribute("aSpeed", new T.BufferAttribute(speed, 1)); geo.setAttribute("aTint", new T.BufferAttribute(tint, 3));
  const mat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uPx: { value: 1 } },
    vertexShader: `attribute float aSize,aPhase,aSpeed; attribute vec3 aTint; uniform float uTime,uPx; varying float vTw; varying vec3 vT;
      void main(){ vTw=.55+.45*sin(uTime*aSpeed+aPhase); vT=aTint; gl_PointSize=aSize*uPx*(.7+.5*vTw); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uOpacity; varying float vTw; varying vec3 vT;
      void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.05,d)*vTw*uOpacity; gl_FragColor=vec4(vT*1.1,a); }`,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  });
  const pts = new T.Points(geo, mat); pts.frustumCulled = false; group.add(pts);
  return { pts, mat, dispose() { geo.dispose(); mat.dispose(); } };
}

/* ============================== ПЛАНЕТА ============================== */
function createPlanet(group) {
  const tex = makePlanetTex(), planet = new T.Group();
  const body = new T.Mesh(new T.SphereGeometry(1, 64, 48), new T.MeshStandardMaterial({ map: tex, roughness: .92, metalness: 0, transparent: true }));
  const atmoMat = new T.ShaderMaterial({                          // атмосферное свечение (френель, как в основном сайте)
    uniforms: { c: { value: new T.Color(0x6fb7ff) }, k: { value: 1.25 }, p: { value: 3 }, o: { value: 1 } },
    vertexShader: "varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
    fragmentShader: "varying vec3 vN;varying vec3 vV;uniform vec3 c;uniform float k;uniform float p;uniform float o;void main(){float f=pow(abs(dot(vN,vV)),p);gl_FragColor=vec4(c,f*k*o);}",
    transparent: true, blending: T.AdditiveBlending, side: T.BackSide, depthWrite: false
  });
  const atmo = new T.Mesh(new T.SphereGeometry(1.13, 64, 48), atmoMat);
  planet.add(body, atmo); group.add(planet);
  return { planet, body, atmoMat,
    setOpacity(a) { body.material.opacity = a; atmoMat.uniforms.o.value = a; },
    dispose() { tex.dispose(); body.geometry.dispose(); body.material.dispose(); atmo.geometry.dispose(); atmoMat.dispose(); } };
}

/* ============================== АСТЕРОИДЫ ============================== */
function createAsteroids(group) {
  const list = [], specs = [
    { p: [-9.5, 3.4, -24], r: 1.5, s: [1, .75, .9], v: [.25, .1] },
    { p: [8.5, -3.6, -31], r: 1.1, s: [.9, 1, .8], v: [-.2, .15] },
    { p: [-3.8, -6.2, -19], r: .75, s: [1, .8, 1], v: [.3, -.2] }
  ];
  for (const sp of specs) {
    const geo = new T.IcosahedronGeometry(1, 3), pos = geo.attributes.position, v = new T.Vector3(), seed = rnd(0, 50);
    for (let i = 0; i < pos.count; i++) {                         // бугристая поверхность по шуму
      v.fromBufferAttribute(pos, i).normalize();
      const k = 1 + (fbm(v.x * 1.7 + seed, v.y * 1.7 + seed, v.z * 1.7 + seed) - .5) * .9 + (vnoise(v.x * 5 + seed, v.y * 5, v.z * 5) - .5) * .18;
      pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
    }
    geo.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({ color: 0x77706a, roughness: .95, metalness: .05, flatShading: true, transparent: true });
    const m = new T.Mesh(geo, mat); m.scale.set(...sp.s.map(x => x * sp.r)); m.position.set(...sp.p);
    group.add(m); list.push({ mesh: m, mat, home: new T.Vector3(...sp.p), spin: new T.Vector3(sp.v[0], sp.v[1], rnd(-.1, .1)) });
  }
  return { list, dispose() { list.forEach(a => { a.mesh.geometry.dispose(); a.mat.dispose(); }); } };
}

/* ============================== ТУМАННОСТЬ ============================== */
function createNebula(group) {
  const defs = [["110,70,200", [-32, 12, -95], 150], ["60,170,200", [30, -14, -100], 160], ["230,120,70", [4, 24, -105], 120]], list = [];
  for (const [rgb, p, s] of defs) {
    const tex = makeNebulaTex(rgb), mat = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, opacity: .55 });
    const sp = new T.Sprite(mat); sp.position.set(...p); sp.scale.set(s, s * .8, 1); sp.material.rotation = rnd(0, 6.28); group.add(sp); list.push({ sp, mat, tex });
  }
  return { list, dispose() { list.forEach(n => { n.tex.dispose(); n.mat.dispose(); }); } };
}

/* ============================== РАКЕТА ============================== */
// Из примитивов. Начало координат группы = срез сопла, ось ракеты = +Y. Высота ≈ 8.3 ед. (≈70% высоты кадра).
function createRocket(envTex) {
  const g = new T.Group(), mats = [];
  const M = (color, o = {}) => { const m = new T.MeshStandardMaterial({ color, metalness: .35, roughness: .38, envMap: envTex, envMapIntensity: .7, ...o }); mats.push(m); return m; };
  const white = M(0xe9ecf2), dark = M(0x23283a, { metalness: .6, roughness: .45 }), orange = M(0xe0642a, { metalness: .2, roughness: .5 }), steel = M(0x8c93a3, { metalness: .8, roughness: .35 });
  const add = (geo, mat, y) => { const m = new T.Mesh(geo, mat); m.position.y = y; g.add(m); return m; };
  const nozzle = add(new T.CylinderGeometry(.3, .52, .75, 32, 1, true), steel, .375); nozzle.material.side = T.DoubleSide;
  const glowMat = new T.MeshBasicMaterial({ color: 0xffb060 }); mats.push(glowMat);
  const glow = new T.Mesh(new T.CircleGeometry(.3, 24), glowMat); glow.rotation.x = Math.PI / 2; glow.position.y = .6; g.add(glow);   // раскалённая внутренность сопла
  add(new T.CylinderGeometry(.58, .5, .5, 32), dark, .95);                                          // моторный отсек
  add(new T.CylinderGeometry(.64, .64, 5.3, 48), white, 3.85);                                      // корпус
  add(new T.CylinderGeometry(.655, .655, .32, 48), orange, 2.2);                                    // оранжевый пояс
  add(new T.CylinderGeometry(.655, .655, .14, 48), dark, 2.6);
  add(new T.CylinderGeometry(.655, .655, .5, 48), dark, 5.3);                                       // верхний тёмный пояс
  add(new T.CylinderGeometry(.655, .655, .1, 48), orange, 4.1);
  add(new T.ConeGeometry(.64, 1.9, 48), white, 7.45);                                               // носовой конус
  add(new T.CylinderGeometry(.07, .02, .5, 12), steel, 8.65);                                       // штырь
  const sh = new T.Shape(); sh.moveTo(0, 3.3); sh.lineTo(0, 1.2); sh.lineTo(1.1, .85); sh.lineTo(1.1, 1.6); sh.lineTo(0, 3.3);   // плавник (контур в плоскости XY)
  const finGeo = new T.ExtrudeGeometry(sh, { depth: .08, bevelEnabled: false }); finGeo.translate(.58, 0, -.04);
  for (let i = 0; i < 4; i++) { const f = new T.Mesh(finGeo, dark); f.rotation.y = i * Math.PI / 2 + Math.PI / 4; g.add(f); }
  const porthole = new T.Mesh(new T.CylinderGeometry(.2, .2, .08, 24), M(0x1b2a44, { metalness: .9, roughness: .2 })); porthole.rotation.x = Math.PI / 2; porthole.position.set(0, 6.0, .62); g.add(porthole);
  return { group: g, height: 9, setEnv(k) { mats.forEach(m => { if (m.envMapIntensity !== undefined) m.envMapIntensity = .7 * k; }); },
    dispose() { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); mats.forEach(m => m.dispose()); } };
}

/* ============================== ЧАСТИЦЫ (инстансированные билборды) ============================== */
// Общая система: каждый инстанс — квад, повёрнутый к камере. Своё вращение, размер, цвет и альфа на частицу.
// Нет ограничения размера, как у gl_PointSize, поэтому огромные облака дыма рисуются корректно.
function createQuadSystem(N, map, { additive = false, atlas = false } = {}) {
  const base = new T.PlaneGeometry(1, 1), geo = new T.InstancedBufferGeometry();
  geo.index = base.index; geo.setAttribute("position", base.attributes.position); geo.setAttribute("uv", base.attributes.uv); geo.instanceCount = N;
  const mk = (n, name) => { const a = new T.InstancedBufferAttribute(new Float32Array(N * n), n); a.setUsage(T.DynamicDrawUsage); geo.setAttribute(name, a); return a; };
  const A = { pos: mk(3, "iPos"), size: mk(1, "iSize"), rot: mk(1, "iRot"), alpha: mk(1, "iAlpha"), color: mk(3, "iColor"), vari: mk(1, "iVar") };
  const mat = new T.ShaderMaterial({
    uniforms: { map: { value: map }, uGlobal: { value: 1 }, uAtlas: { value: atlas ? 1 : 0 } },
    vertexShader: `attribute vec3 iPos; attribute float iSize,iRot,iAlpha,iVar; attribute vec3 iColor; uniform float uAtlas;
      varying vec2 vUv; varying vec3 vCol; varying float vA;
      void main(){
        vec4 mv=modelViewMatrix*vec4(iPos,1.); float c=cos(iRot),s=sin(iRot); vec2 p=position.xy*iSize;
        mv.xy+=vec2(c*p.x-s*p.y,s*p.x+c*p.y); gl_Position=projectionMatrix*mv;
        vec2 off=vec2(mod(iVar,2.),floor(iVar/2.)); vUv=uAtlas>.5?uv*.5+off*.5:uv; vCol=iColor; vA=iAlpha; }`,
    fragmentShader: `uniform sampler2D map; uniform float uGlobal,uAtlas; varying vec2 vUv; varying vec3 vCol; varying float vA;
      void main(){ vec4 tx=texture2D(map,vUv); float a=tx.a*vA*uGlobal; if(a<.002) discard; gl_FragColor=vec4(vCol*mix(vec3(1.),tx.rgb,uAtlas),a); }`,
    transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending
  });
  const mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false;
  return { mesh, A, mat, N, dispose() { geo.dispose(); base.dispose(); mat.dispose(); } };
}

/* ============================== ДЫМ ============================== */
// Пул из N частиц (кольцевой буфер, без аллокаций в кадре). Движение: затухание скорости + «curl»-завихрения из шума,
// рост размера, вращение. Цвет: серо-оранжевый у сопла → тёмно-серый по мере «старения».
function createSmoke(group, N = 5000) {
  const tex = makeCloudAtlas(), sys = createQuadSystem(N, tex, { atlas: true }), { A } = sys;
  sys.mesh.renderOrder = 2; group.add(sys.mesh);
  const P = new Float32Array(N * 3), V = new Float32Array(N * 3), age = new Float32Array(N), life = new Float32Array(N), s0 = new Float32Array(N), gr = new Float32Array(N),
    rot = new Float32Array(N), rotV = new Float32Array(N), shade = new Float32Array(N), seed = new Float32Array(N);
  let head = 0, clock = 0;
  const HOT = [.95, .5, .2], MID = [.36, .345, .335], DARK = [.1, .1, .112];

  function spawn(x, y, z, vx, vy, vz, lifeS, size0, growth, shd) {
    const i = head; head = (head + 1) % N;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
    age[i] = 0; life[i] = lifeS; s0[i] = size0; gr[i] = growth; rot[i] = rnd(0, 6.28); rotV[i] = rnd(-.35, .35); shade[i] = shd; seed[i] = rnd(0, 20);
    A.vari.array[i] = Math.floor(rnd(0, 4)); A.vari.needsUpdate = true;
  }
  // Шлейф за соплом: n частиц, равномерно распределённых по пути сопла (y0→y1) за кадр.
  function emitPlume(n, y0, y1, vRocket, launchK) {
    for (let k = 0; k < n; k++) {
      const y = lerp(y0, y1, Math.random()), a = rnd(0, 6.283), side = (rnd(.5, 1.7) + 1.8 * (1 - launchK)) ;
      spawn(rnd(-.3, .3), y, rnd(-1.6, -.1), Math.cos(a) * side, -rnd(.2, 1.8) + vRocket * .08, Math.sin(a) * side * .3,
        rnd(4.8, 6.8), rnd(.8, 1.4), rnd(4.4, 7.0), rnd(.85, 1.15));
    }
  }
  // Выброс у «стартового стола» (ниже кадра): густые клубы катятся вверх и в стороны, заполняя экран снизу.
  function emitPad(n, y) {
    for (let k = 0; k < n; k++) {
      const a = rnd(0, 6.283), side = rnd(1.2, 5);
      spawn(Math.cos(a) * rnd(0, 1.4), y + rnd(-.8, .8), rnd(-2.4, .2), Math.cos(a) * side, rnd(1.0, 3.4), Math.sin(a) * side * .15,
        rnd(5, 7), rnd(1.2, 2.0), rnd(2.8, 4.4), rnd(.8, 1.1));
    }
  }
  function update(dt, tGlobal, alphaK) {
    clock += dt; const tt = clock * .12, drag = Math.exp(-.5 * dt), k = .16, e = .5;
    sys.mat.uniforms.uGlobal.value = alphaK;
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue;
      age[i] += dt; const a = age[i], L = life[i];
      if (a >= L) { life[i] = 0; A.alpha.array[i] = 0; A.size.array[i] = 0; continue; }
      const i3 = i * 3; let x = P[i3], y = P[i3 + 1], z = P[i3 + 2];
      // curl-шум: скорость = (dψ/dy, -dψ/dx) от скалярного поля ψ(x,y,t) → бездивергентные завихрения
      const sd = seed[i] * .1, dpy = vnoise(x * k + sd, (y + e) * k, tt) - vnoise(x * k + sd, (y - e) * k, tt), dpx = vnoise((x + e) * k + sd, y * k, tt) - vnoise((x - e) * k + sd, y * k, tt);
      const spread = (a > .5 ? .34 * Math.min(1, (a - .5) / 1.5) : 0) * (x - 0);   // клубы расходятся от оси шлейфа вширь (экспоненциально) → дым заполняет экран
      let vx = V[i3] * drag + (dpy * 15 + spread) * dt, vy = V[i3 + 1] * drag + (-dpx * 15 + .45) * dt, vz = V[i3 + 2] * drag + (vnoise(x * k, y * k, tt + 7) - .5) * 2.2 * dt;
      V[i3] = vx; V[i3 + 1] = vy; V[i3 + 2] = vz;
      x += vx * dt; y += vy * dt; z = Math.max(-3, Math.min(.9, z + vz * dt)); P[i3] = x; P[i3 + 1] = y; P[i3 + 2] = z;
      rot[i] += rotV[i] * dt;
      const u = a / L, heat = Math.pow(Math.max(0, 1 - a / 1.8), 1.5), sh = shade[i];
      const m = clamp01(u * 1.5);                                  // MID → DARK
      let r = lerp(MID[0], DARK[0], m), g = lerp(MID[1], DARK[1], m), b = lerp(MID[2], DARK[2], m);
      r = lerp(r, HOT[0], heat); g = lerp(g, HOT[1], heat); b = lerp(b, HOT[2], heat);
      const c = A.color.array; c[i3] = r * sh; c[i3 + 1] = g * sh; c[i3 + 2] = b * sh;
      A.pos.array[i3] = x; A.pos.array[i3 + 1] = y; A.pos.array[i3 + 2] = z;
      A.size.array[i] = s0[i] * (1 + gr[i] * (1 - Math.exp(-a * .55)));
      A.rot.array[i] = rot[i];
      A.alpha.array[i] = Math.min(1, a / .5) * Math.pow(1 - u, 1.2) * .4;
    }
    for (const key of ["pos", "size", "rot", "alpha", "color"]) A[key].needsUpdate = true;
  }
  function reset() { life.fill(0); A.alpha.array.fill(0); A.size.array.fill(0); head = 0; clock = 0; for (const key of ["alpha", "size"]) A[key].needsUpdate = true; }
  return { sys, spawn, emitPlume, emitPad, update, reset, dispose() { sys.dispose(); tex.dispose(); } };
}

/* ============================== ОГОНЬ ============================== */
// Яркие короткоживущие частицы (additive): белый → жёлтый → оранжевый → красный. Плюс светящееся ядро у сопла.
function createFire(group, N = 520) {
  const tex = makeGlowTex(), sys = createQuadSystem(N, tex, { additive: true }), { A } = sys;
  sys.mesh.renderOrder = 3; group.add(sys.mesh);
  const P = new Float32Array(N * 3), V = new Float32Array(N * 3), age = new Float32Array(N), life = new Float32Array(N), s0 = new Float32Array(N);
  let head = 0;
  const STOPS = [[0, [1, .97, .85]], [.18, [1, .85, .35]], [.45, [1, .48, .1]], [.8, [.8, .14, .04]], [1, [.3, .03, .01]]];
  function ramp(u) { for (let i = 1; i < STOPS.length; i++) if (u <= STOPS[i][0]) { const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], k = (u - a) / (b - a); return [lerp(ca[0], cb[0], k), lerp(ca[1], cb[1], k), lerp(ca[2], cb[2], k)]; } return STOPS[STOPS.length - 1][1]; }
  function emit(n, y0, y1, vRocket, thrust) {
    for (let k = 0; k < n; k++) {
      const i = head; head = (head + 1) % N;
      const a = rnd(0, 6.283), r = Math.sqrt(Math.random()) * .28, y = lerp(y0, y1, Math.random());
      P[i * 3] = Math.cos(a) * r; P[i * 3 + 1] = y; P[i * 3 + 2] = Math.sin(a) * r;
      V[i * 3] = Math.cos(a) * rnd(.2, 1.1); V[i * 3 + 1] = vRocket * .5 - rnd(6, 11) * thrust; V[i * 3 + 2] = Math.sin(a) * rnd(.2, 1.1);
      age[i] = 0; life[i] = rnd(.28, .6); s0[i] = rnd(.55, .95) * (.6 + .4 * thrust);
    }
  }
  function update(dt, intensity) {
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue;
      age[i] += dt; const a = age[i], L = life[i];
      if (a >= L) { life[i] = 0; A.alpha.array[i] = 0; A.size.array[i] = 0; continue; }
      const i3 = i * 3, u = a / L; P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      A.pos.array[i3] = P[i3]; A.pos.array[i3 + 1] = P[i3 + 1]; A.pos.array[i3 + 2] = P[i3 + 2];
      const c = ramp(u); A.color.array[i3] = c[0]; A.color.array[i3 + 1] = c[1]; A.color.array[i3 + 2] = c[2];
      A.size.array[i] = s0[i] * (1 + 1.4 * u) * (1 - .35 * u); A.alpha.array[i] = Math.pow(1 - u, 1.1) * .3 * intensity;
    }
    for (const key of ["pos", "size", "alpha", "color"]) A[key].needsUpdate = true;
  }
  function reset() { life.fill(0); A.alpha.array.fill(0); A.size.array.fill(0); head = 0; A.alpha.needsUpdate = A.size.needsUpdate = true; }
  return { sys, emit, update, reset, dispose() { sys.dispose(); tex.dispose(); } };
}

/* ============================== ПОСТОБРАБОТКА: «мгла» ============================== */
// Виньетка → затемнение снизу вверх (с дымным краем) → общее затемнение до почти чёрного. Управляется тремя uniform.
const GrimeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0 }, uBottom: { value: 0 }, uAll: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1.7 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig,uBottom,uAll,uTime,uAspect; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
    void main(){
      vec4 c=texture2D(tDiffuse,vUv); vec2 q=vUv-.5; q.x*=uAspect*.62;
      float vig=smoothstep(.12,1.1,length(q))*uVig;
      float wob=(n(vUv*vec2(3.2,2.1)+vec2(0.,uTime*.18))*.65+n(vUv*vec2(7.,5.)-vec2(uTime*.1,0.))*.35-.5)*.4;
      float m=(1.-smoothstep(uBottom-.5,uBottom,vUv.y+wob))*smoothstep(0.,.06,uBottom);
      vec3 smoke=vec3(.03,.029,.033);
      c.rgb=mix(c.rgb,smoke,clamp(vig*.75+m*.6,0.,1.));
      c.rgb=mix(c.rgb,vec3(.004),uAll);
      float gn=fract(52.9829189*fract(dot(gl_FragCoord.xy+fract(uTime)*37.,vec2(.06711056,.00583715)))); c.rgb+=(gn-.5)*.007*(.5+uAll);
      gl_FragColor=c; }`
};

/* ============================== ГЛАВНАЯ ФУНКЦИЯ ============================== */
export function createIntro({ container = document.body, onAnimationEnd = () => {}, title = "ASTRONEX", subtitle = "Abandoned but not forgotten", duration = TL.total } = {}) {
  // ---------- DOM: оверлей, canvas, заголовок, кнопки ----------
  const el = document.createElement("div"); el.id = "xp-intro"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Intro animation");
  el.innerHTML = `<canvas></canvas><div class="xp-intro-title"><h1></h1><p></p></div>
    <div class="xp-intro-ui"><button type="button" data-a="replay">Replay ↺</button><button type="button" data-a="skip">Skip ›</button></div>`;
  el.querySelector("h1").textContent = title; el.querySelector(".xp-intro-title p").textContent = subtitle;
  container.append(el);
  const canvas = el.querySelector("canvas"), titleEl = el.querySelector(".xp-intro-title");

  // ---------- renderer / scene / camera ----------
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.setClearColor(0x03050c);
  const scene = new T.Scene(); scene.background = new T.Color(0x03050c);
  scene.fog = new T.FogExp2(0x0b0c10, .0006);
  const camera = new T.PerspectiveCamera(45, 1, .1, 400); camera.position.set(0, 0, 14);
  const pmrem = new T.PMREMGenerator(renderer), env = pmrem.fromScene(new RoomEnvironment(), .04).texture;

  // ---------- освещение ----------
  const hemi = new T.HemisphereLight(0x5a6c9a, 0x15121a, .55);
  const key = new T.DirectionalLight(0xfff1de, 2.4); key.position.set(-8, 6, 10);
  const rim = new T.DirectionalLight(0x6fb7ff, 1.1); rim.position.set(9, 2, -6);
  const fireLight = new T.PointLight(0xff8a3c, 0, 26, 1.6);
  scene.add(hemi, key, rim, fireLight);
  const baseLight = { hemi: hemi.intensity, key: key.intensity, rim: rim.intensity };

  // ---------- объекты сцены ----------
  const world = new T.Group(); scene.add(world);
  const stars = createStars(world), nebula = createNebula(world), asteroids = createAsteroids(world), planetObj = createPlanet(world);
  world.visible = false;   // фон (звёзды, планета, астероиды, туманность) убран: остаются только ракета, огонь и дым
  planetObj.planet.position.set(12, 6.5, -62); planetObj.planet.scale.setScalar(13);
  const rocket = createRocket(env); scene.add(rocket.group);
  const smoke = createSmoke(scene), fire = createFire(scene);
  const coreMat = new T.SpriteMaterial({ map: makeGlowTex(), color: 0xffc27a, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, opacity: 0 });
  const core = new T.Sprite(coreMat); core.renderOrder = 4; scene.add(core);

  // ---------- постобработка ----------
  const composer = new EffectComposer(renderer), bloom = new UnrealBloomPass(new T.Vector2(512, 512), .62, .6, .88);
  const grime = new ShaderPass(GrimeShader);
  composer.addPass(new RenderPass(scene, camera)); composer.addPass(bloom); composer.addPass(grime); composer.addPass(new OutputPass());

  // ---------- адаптивность ----------
  let quality = 0, pr = Math.min(devicePixelRatio || 1, 1.5);   // потолок 1.5: дым мягкий, лишние пиксели не нужны
  const PR_STEPS = [1, .85, .7];
  function resize() {
    const w = innerWidth, h = innerHeight, ratio = quality ? Math.min(pr, PR_STEPS[quality - 1]) : pr;
    renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); composer.setPixelRatio(ratio); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    stars.mat.uniforms.uPx.value = ratio * 1.1; grime.uniforms.uAspect.value = w / h;
    // на узких экранах сдвигаем планету ближе к центру, чтобы она оставалась в кадре
    planetObj.planet.position.x = 12 * Math.min(1, Math.max(.45, w / h / 1.6));
  }
  addEventListener("resize", resize); resize();

  /* ---------- параметры траектории ---------- */
  const Y0 = -14.2, Y1 = 8.4;                                      // сопло: старт под кадром → за верхним краем
  const rocketSpeed = u => (Y1 - Y0) * 2 * u / (TL.exit - TL.launch);   // производная easeInQuad
  const nozzleY = t => lerp(Y0, Y1, easeInQuad(seg(t, TL.launch, TL.exit)));
  const thrustAt = t => easeOutQuad(seg(t, TL.ignite, TL.launch + 1.4)) * (1 - seg(t, TL.exit - .2, TL.exit + .4));

  /* ---------- плавное растворение объектов (каждый со своей задержкой) ---------- */
  const fades = [
    { a: 6.0, b: 8.8, set: k => nebula.list.forEach((n, i) => (n.mat.opacity = .55 * k)) },
    { a: 7.0, b: 9.2, set: k => { asteroids.list[0].mat.opacity = k; } },
    { a: 7.6, b: 9.8, set: k => { asteroids.list[1].mat.opacity = k; } },
    { a: 8.2, b: 10.4, set: k => { asteroids.list[2].mat.opacity = k; } },
    { a: 8.6, b: 11.6, set: k => planetObj.setOpacity(k) },
    { a: 10.2, b: 13.2, set: k => { stars.mat.uniforms.uOpacity.value = k; } }
  ];

  /* ============ updateTimeline: ВСЕ этапы сцены вычисляются из progress (0..1) ============ */
  let lastNoozle = Y0, shakeAmp = 0;
  function updateTimeline(progress) {
    const t = progress * TL.total;
    // 1) камера: медленный дрейф
    camera.position.set(Math.sin(t * .13) * .7, Math.cos(t * .1) * .4, 14); camera.rotation.set(Math.sin(t * .09) * .008, Math.sin(t * .11) * .01, 0);
    // 2) ракета: плавный разгон ease-in строго вверх
    const u = seg(t, TL.launch, TL.exit), ny = nozzleY(t), thrust = thrustAt(t);
    rocket.group.position.set(Math.sin(t * 61) * .014 * thrust, ny, 0); rocket.group.scale.set(1.35, 1.08, 1.35); rocket.group.visible = t < TL.exit + .3;
    // 3) огонь: PointLight освещает корпус, ядро светится
    fireLight.position.set(0, ny - 1.1, 1.6); fireLight.intensity = thrust * (95 + Math.sin(t * 47) * 12 + Math.sin(t * 91) * 8);
    core.position.set(0, ny - .35, .3); core.scale.setScalar(thrust * (2.6 + Math.sin(t * 53) * .25)); coreMat.opacity = thrust * .9;
    // 4) тряска камеры: пик при старте и нарастание при наборе скорости
    shakeAmp = .85 * easeOutQuad(seg(t, TL.ignite, TL.launch + .5)) * (1 - easeInOutCubic(seg(t, TL.launch + .5, TL.launch + 3.6))) + .38 * easeInQuad(u) * (1 - seg(t, TL.exit, TL.exit + .6));
    camera.position.x += (vnoise(t * 18, 1.3, 0) - .5) * .32 * shakeAmp; camera.position.y += (vnoise(t * 17, 5.1, 2) - .5) * .32 * shakeAmp; camera.rotation.z = (vnoise(t * 14, 9.7, 4) - .5) * .02 * shakeAmp;
    // 5) туман, свет и растворение: «всё уходит в мглу»
    scene.fog.density = .0006 + .031 * easeInQuad(seg(t, 3.8, 11.8));
    const lk = 1 - .88 * easeInOutCubic(seg(t, 6.0, 12.2));
    hemi.intensity = baseLight.hemi * lk; key.intensity = baseLight.key * lk; rim.intensity = baseLight.rim * lk; rocket.setEnv(lk);
    for (const f of fades) f.set(1 - easeInOutCubic(seg(t, f.a, f.b)));
    // 6) мгла: виньетка → низ кадра → весь кадр
    grime.uniforms.uVig.value = easeInOutCubic(seg(t, 3.2, 8.5));
    grime.uniforms.uBottom.value = 1.35 * easeInOutCubic(seg(t, 4.2, 11.0));
    grime.uniforms.uAll.value = Math.max(.74 * easeInOutCubic(seg(t, 8.8, 13.4)), 1 - easeOutQuad(seg(t, 0, .9)));   // + плавное появление из чёрного в начале
    // 7) заголовок поверх (CSS-класс .show)
    if (captureMode) {                                              // запись видео: заголовок считается от времени таймлайна, а не от CSS-переходов
      const k = easeOutQuad(seg(t, TL.titleAt, TL.titleAt + 1.7)), k2 = easeOutQuad(seg(t, TL.titleAt + .5, TL.titleAt + 2.1)), h1 = titleEl.firstElementChild, sub = titleEl.lastElementChild;
      h1.style.cssText = `transition:none;opacity:${k};filter:blur(${(14 * (1 - k)).toFixed(2)}px);transform:translateY(${(10 * (1 - k)).toFixed(2)}px) scale(${(1 + .04 * (1 - k)).toFixed(4)})`; sub.style.cssText = `transition:none;opacity:${(k2 * .9).toFixed(3)}`;
    } else titleEl.classList.toggle("show", t >= TL.titleAt);
    return { t, ny, thrust, u };
  }

  /* ---------- симуляция частиц (зависит от dt, привязана к положению ракеты) ---------- */
  let simTime = 0;
  function simulate(dt, st) {
    const { t, ny, thrust, u } = st, vR = rocketSpeed(u), launchK = easeOutQuad(seg(t, TL.launch, TL.launch + 3));
    // огонь: короткие частицы вдоль пройденного за кадр пути сопла
    if (thrust > .01) fire.emit(Math.round(720 * thrust * dt + Math.random()), lastNoozle, ny, vR, thrust);
    // дым: выброс «у стартового стола» + шлейф за ракетой
    if (t > TL.ignite && t < TL.launch + 3.4) smoke.emitPad(Math.round(480 * dt * (1 - seg(t, TL.launch + 1.5, TL.launch + 3.4)) * (.4 + .6 * seg(t, TL.ignite, TL.launch + .4)) + Math.random()), -9.5);
    if (t > TL.ignite && t < TL.smokeStop) smoke.emitPlume(Math.round(780 * dt * (.35 + .65 * thrust) + Math.random()), lastNoozle, ny, vR, launchK);
    smoke.update(dt, t, 1 - .45 * easeInOutCubic(seg(t, 11.0, 14)));     // к финалу дым редеет → «лёгкий дым» на чёрном
    fire.update(dt, 1);
    lastNoozle = ny; simTime += dt;
  }

  /* ---------- главный цикл ---------- */
  let captureMode = false, time = 0, raf = 0, running = false, ended = false, prev = 0, frames = 0, acc = 0, disposed = false;
  function reset() { time = 0; ended = false; lastNoozle = Y0; simTime = 0; smoke.reset(); fire.reset(); titleEl.classList.remove("show"); }
  function renderFrame() { stars.mat.uniforms.uTime.value = time; grime.uniforms.uTime.value = time; composer.render(); }
  function step(dt) {
    time += dt; const st = updateTimeline(Math.min(1, time / duration));
    asteroids.list.forEach(a => { a.mesh.rotation.x += a.spin.x * dt; a.mesh.rotation.y += a.spin.y * dt; a.mesh.rotation.z += a.spin.z * dt; a.mesh.position.x = a.home.x + Math.sin(time * .2 + a.home.z) * .4; });
    planetObj.planet.rotation.y += dt * .02;
    simulate(dt, st);
  }
  function animate(now) {
    if (!running || disposed) return;
    raf = requestAnimationFrame(animate);
    const dt = Math.min(.05, (now - prev) / 1000 || 0); prev = now;
    step(dt); renderFrame();
    // автоподстройка качества: если средний кадр дольше ~24 мс — снижаем разрешение / отключаем bloom
    acc += dt; frames++;
    if (frames === 40) { if (acc / frames > .024 && quality < 3) { quality++; if (quality === 3) bloom.enabled = false; resize(); } acc = 0; frames = 0; }
    if (time >= duration && !ended) { ended = true; running = false; cancelAnimationFrame(raf); renderFrame(); onAnimationEnd(); }
  }
  function play() { if (disposed) return; el.classList.add("on"); if (!running) { running = true; prev = performance.now(); raf = requestAnimationFrame(animate); } }
  function replay() { cancelAnimationFrame(raf); running = false; reset(); play(); }
  function skip() { if (ended || disposed) return; ended = true; running = false; cancelAnimationFrame(raf); onAnimationEnd(); }
  // Перемотка для отладки/превью: прогоняет симуляцию до секунды t без рендера и рисует один кадр.
  function seek(sec) { cancelAnimationFrame(raf); running = false; reset(); let n = 0; while (time < sec && n++ < 2000) step(1 / 30); renderFrame(); }
  // Режим записи видео: останавливает цикл, прячет кнопки; frame(dt) двигает сцену на фиксированный шаг и рисует кадр (детерминированно).
  function capture() { cancelAnimationFrame(raf); running = false; captureMode = true; el.classList.add("on"); el.querySelector(".xp-intro-ui").style.display = "none"; reset(); resize(); renderFrame(); }
  function frame(dt) { step(dt); renderFrame(); return time; }
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; b.dataset.a === "replay" ? replay() : skip(); });

  function dispose() {
    disposed = true; running = false; cancelAnimationFrame(raf); removeEventListener("resize", resize);
    stars.dispose(); nebula.dispose(); asteroids.dispose(); planetObj.dispose(); rocket.dispose(); smoke.dispose(); fire.dispose(); coreMat.map.dispose(); coreMat.dispose();
    env.dispose(); pmrem.dispose(); composer.dispose(); renderer.dispose(); renderer.forceContextLoss(); el.remove();
  }
  return { el, play, replay, skip, seek, capture, frame, dispose, get time() { return time; }, get ended() { return ended; }, duration, hide() { el.classList.remove("on"); } };
}
