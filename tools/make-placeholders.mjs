// Generates stand-in .glb files so every model slot has a real file to replace later.
// Run:  cd tools && npm run placeholders
// Output: frontend/models/{lro,mer,ingenuity,moon,mars}.glb  (apollo-lm.glb is the real model and is not touched)
import * as T from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { buildAbstract } from "../frontend/src/explore/shapes.js";
import { writeFileSync, mkdirSync } from "node:fs";

// GLTFExporter expects a browser; give it the two things it needs in Node.
globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then(r => { this.result = r; this.onloadend?.({ target: this }); }); }
  readAsDataURL(b) { b.arrayBuffer().then(r => { this.result = "data:" + (b.type || "application/octet-stream") + ";base64," + Buffer.from(r).toString("base64"); this.onloadend?.({ target: this }); }); }
};

const OUT = new URL("../frontend/models/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

async function save(name, object) {
  const buf = await new GLTFExporter().parseAsync(object, { binary: true });
  writeFileSync(OUT + name + ".glb", Buffer.from(buf));
  console.log("wrote", name + ".glb", (buf.byteLength / 1024).toFixed(0) + " KB");
}

// ---- spacecraft: same abstract shapes as the Explore fallback, minus the cyan edge lines
for (const [id, file] of [["lro", "lro"], ["mer", "mer"], ["ingenuity", "ingenuity"]]) {
  const g = buildAbstract(id);
  const lines = []; g.traverse(o => { if (o.isLineSegments) lines.push(o); }); lines.forEach(l => l.parent.remove(l));
  g.name = "placeholder-" + id;
  await save(file, g);
}

// ---- planets: unit sphere (radius 1) with vertex colours. UV layout = THREE.SphereGeometry (equirectangular, lon -180..180).
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
const hash = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t), l = (a, b, t) => a + (b - a) * t; let r = 0;
  const u = s(xf), v = s(yf), w = s(zf);
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0,0,0), c(1,0,0), u), l(c(0,1,0), c(1,1,0), u), v), l(l(c(0,0,1), c(1,0,1), u), l(c(0,1,1), c(1,1,1), u), v), w);
}
const fbm = (x, y, z) => { let a = .5, f = 1, s = 0; for (let i = 0; i < 5; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2; a *= .5; } return s; };

function planet(name, base, dark, light, craters) {
  const geo = new T.SphereGeometry(1, 128, 80);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const cs = Array.from({ length: craters }, () => { const v = new T.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).normalize(); return { v, r: .05 + rnd() * .16 }; });
  const b = new T.Color(base), d = new T.Color(dark), li = new T.Color(light), c = new T.Color(), p = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const n = fbm(p.x * 3 + 5, p.y * 3 + 5, p.z * 3 + 5);
    c.copy(d).lerp(b, Math.min(1, n * 1.6)).lerp(li, Math.max(0, n - .62) * 2.2);
    for (const k of cs) {                                   // soft crater: dark floor, bright rim
      const t = p.angleTo(k.v) / k.r;
      if (t < 1) c.multiplyScalar(.72 + .28 * t * t); else if (t < 1.18) c.multiplyScalar(1.12);
    }
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new T.BufferAttribute(col, 3));
  const m = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  m.name = name; return m;
}
await save("moon", planet("placeholder-moon", 0x8d8f96, 0x4a4c53, 0xc4c6cc, 70));
await save("mars", planet("placeholder-mars", 0xb5532c, 0x6b2a14, 0xe0a070, 26));
