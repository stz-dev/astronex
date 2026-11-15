// Builds detailed procedural spacecraft models for the exhibits that have no Blender model yet.
// Run:  cd tools && npm run models
// Output: frontend/models/{surveyor3,sojourner,viking,phoenix,insight,pioneer,dawn}.glb
// Real Blender models simply replace these files (same names) — nothing else has to change.
import * as T from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { writeFileSync, mkdirSync } from "node:fs";

globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then(r => { this.result = r; this.onloadend?.({ target: this }); }); }
  readAsDataURL(b) { b.arrayBuffer().then(r => { this.result = "data:" + (b.type || "application/octet-stream") + ";base64," + Buffer.from(r).toString("base64"); this.onloadend?.({ target: this }); }); }
};
const OUT = new URL("../frontend/models/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// ---------- materials ----------
const M = (color, m = .3, r = .55, extra = {}) => new T.MeshStandardMaterial({ color, metalness: m, roughness: r, ...extra });
const MAT = {
  gold:   M(0xd9a441, .85, .32), kapton: M(0xc98a2b, .7, .42), white: M(0xeceff4, .1, .6), cream: M(0xe3dcc8, .15, .6),
  alu:    M(0xbfc3cc, .8, .33), steel: M(0x8a8f9a, .7, .45), dark: M(0x2a2d36, .3, .55), black: M(0x15161c, .2, .7),
  solar:  M(0x1d3a8a, .55, .28), solarLine: M(0x9db4ff, .6, .3), rubber: M(0x24262d, 0, .92), copper: M(0xb87333, .8, .38),
  red:    M(0xc8442f, .1, .6), glass: M(0x0b1030, .9, .12), rtg: M(0x3a3d48, .5, .5), dust: M(0xa9a39a, .1, .95),
};

// ---------- helpers ----------
const V = (x, y, z) => new T.Vector3(x, y, z);
function mesh(geo, mat, pos, rot) { const m = new T.Mesh(geo, mat); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); return m; }
const box = (w, h, d, mat, pos, rot) => mesh(new T.BoxGeometry(w, h, d), mat, pos, rot);
const cyl = (rt, rb, h, mat, pos, rot, seg = 28) => mesh(new T.CylinderGeometry(rt, rb, h, seg), mat, pos, rot);
const sph = (r, mat, pos, sc) => { const m = mesh(new T.SphereGeometry(r, 32, 20), mat, pos); if (sc) m.scale.set(...sc); return m; };
const tor = (R, r, mat, pos, rot) => mesh(new T.TorusGeometry(R, r, 10, 40), mat, pos, rot);
function rod(a, b, r, mat, seg = 12) {
  a = V(...a); b = V(...b);
  const m = mesh(new T.CylinderGeometry(r, r, a.distanceTo(b), seg), mat);
  m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); return m;
}
const G = (name, ...kids) => { const g = new T.Group(); g.name = name; g.add(...kids.flat()); return g; };
const at = (g, x, y, z, ry = 0, rx = 0, rz = 0) => { g.position.set(x, y, z); g.rotation.set(rx, ry, rz); return g; };

// flat solar panel in the XZ plane: slab + frame + cell lines
function panel(w, d, cols, rows, t = .03, name = "solar-panel") {
  const g = G(name, box(w, t, d, MAT.solar));
  const f = t * .6, fw = Math.min(w, d) * .02;
  g.add(box(w + fw, t + f, fw, MAT.alu, [0, 0, d / 2]), box(w + fw, t + f, fw, MAT.alu, [0, 0, -d / 2]),
        box(fw, t + f, d, MAT.alu, [w / 2, 0, 0]), box(fw, t + f, d, MAT.alu, [-w / 2, 0, 0]));
  for (let i = 1; i < cols; i++) g.add(box(fw * .45, t * 1.1, d, MAT.solarLine, [-w / 2 + w * i / cols, 0, 0]));
  for (let j = 1; j < rows; j++) g.add(box(w, t * 1.1, fw * .45, MAT.solarLine, [0, 0, -d / 2 + d * j / rows]));
  return g;
}
// circular solar fan (Phoenix / InSight)
function fan(R, spokes, name) {
  const g = G(name, cyl(R, R, .03, MAT.solar, [0, 0, 0], null, 64));
  g.add(tor(R, .022, MAT.alu, [0, 0, 0], [Math.PI / 2, 0, 0]), cyl(R * .14, R * .14, .06, MAT.gold, [0, .02, 0]));
  for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI; g.add(box(R * 2, .036, .012, MAT.solarLine, [0, 0, 0], [0, a, 0])); }
  for (const k of [.38, .68]) g.add(tor(R * k, .008, MAT.solarLine, [0, .018, 0], [Math.PI / 2, 0, 0]));
  return g;
}
// parabolic dish opening towards +Y
function dish(R, focal, mat, name = "dish") {
  const pts = []; for (let i = 0; i <= 24; i++) { const r = R * i / 24; pts.push(new T.Vector2(r, r * r / (4 * focal))); }
  const m = new T.Mesh(new T.LatheGeometry(pts, 56), mat.clone()); m.material.side = T.DoubleSide; m.name = name; return m;
}
// wheel with grousers, axis along Z
function wheel(r, w, mat = MAT.alu) {
  const g = G("wheel", cyl(r, r, w, mat, [0, 0, 0], [Math.PI / 2, 0, 0], 32), cyl(r * .62, r * .62, w * 1.05, MAT.steel, [0, 0, 0], [Math.PI / 2, 0, 0]),
                       cyl(r * .2, r * .2, w * 1.25, MAT.dark, [0, 0, 0], [Math.PI / 2, 0, 0], 16));
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.add(box(r * .11, r * .16, w * .96, MAT.rubber, [Math.cos(a) * r, Math.sin(a) * r, 0], [0, 0, a])); }
  return g;
}
function foot(r = .13, mat = MAT.alu) { return G("footpad", cyl(r, r * 1.05, .03, mat, [0, 0, 0], null, 32), cyl(r * .55, r * .8, .05, MAT.dark, [0, .04, 0]), sph(r * .28, mat, [0, .06, 0])); }
// radiator louvers on a box face (decorative lines)
function louvers(w, h, mat, n = 6) { const g = new T.Group(); for (let i = 0; i < n; i++) g.add(box(w, h * .05, .01, mat, [0, -h / 2 + h * (i + .5) / n, 0])); return g; }
function lens(r, depth, pos, rot) { return G("lens", cyl(r * 1.35, r * 1.35, depth, MAT.dark, pos, rot), cyl(r, r, depth * 1.05, MAT.glass, pos.map((v, i) => v + (rot ? 0 : 0)), rot)); }

// ======================================================================
// SURVEYOR 3 — three-legged lunar lander, tall mast with camera and solar panel
// ======================================================================
function surveyor3() {
  const g = G("surveyor3");
  const hinge = [0, 1, 2].map(i => { const a = i / 3 * Math.PI * 2 + Math.PI / 6; return { a, top: [Math.cos(a) * .42, .9, Math.sin(a) * .42], foot: [Math.cos(a) * 1.25, .05, Math.sin(a) * 1.25] }; });
  hinge.forEach((h, i) => {
    g.add(rod(h.top, h.foot, .028, MAT.alu), rod([h.top[0] * .6, .55, h.top[2] * .6], [h.foot[0] * .82 + h.top[0] * .18 * 0, .3, h.foot[2] * .82], .016, MAT.steel));
    g.add(at(foot(.15), h.foot[0], h.foot[1], h.foot[2]));
    g.add(cyl(.05, .05, .24, MAT.kapton, [h.top[0] * 1.35, .72, h.top[2] * 1.35], [0, 0, 0]));                         // crushable shock absorber
    const j = hinge[(i + 1) % 3]; g.add(rod(h.top, j.top, .02, MAT.alu));                                                 // frame triangle
    g.add(cyl(.045, .045, .3, MAT.dark, [h.top[0] * 1.15, .66, h.top[2] * 1.15], [Math.cos(h.a) * .15, 0, -Math.sin(h.a) * .15]), cyl(.03, .07, .08, MAT.black, [h.top[0] * 1.2, .48, h.top[2] * 1.2]));  // vernier engine + nozzle
  });
  g.add(cyl(.035, .035, 1.15, MAT.alu, [0, 1.45, 0]));                                                                   // central mast
  // equipment compartments
  g.add(box(.46, .32, .34, MAT.gold, [Math.cos(.52) * .3, .66, Math.sin(.52) * .3], [0, -.52, 0]), box(.4, .3, .3, MAT.white, [Math.cos(2.62) * .3, .66, Math.sin(2.62) * .3], [0, -2.62, 0]),
        box(.3, .26, .26, MAT.kapton, [Math.cos(4.71) * .3, .64, Math.sin(4.71) * .3], [0, -4.71, 0]));
  const lv = louvers(.34, .26, MAT.steel); lv.position.set(Math.cos(2.62) * .3 + .05, .66, Math.sin(2.62) * .3 + .18); lv.rotation.y = -2.62; g.add(lv);
  g.add(sph(.26, MAT.steel, [0, .47, 0]), cyl(.05, .17, .2, MAT.black, [0, .27, 0]));                                      // retro-rocket motor + nozzle
  // TV camera + mirror
  g.add(G("camera", cyl(.075, .075, .24, MAT.white, [0, 1.38, 0]), cyl(.095, .095, .05, MAT.dark, [0, 1.52, 0]), box(.16, .02, .16, MAT.alu, [0, 1.26, .0], [.5, 0, 0]),
        cyl(.06, .06, .08, MAT.glass, [0, 1.25, 0.06], [Math.PI / 2 - .5, 0, 0])));
  // solar panel on the mast top and the planar antenna on a boom
  g.add(at(panel(.95, .8, 6, 5, .03, "solar-array"), 0, 2.05, 0, .3, .08, -.1));
  g.add(rod([0, 1.75, 0], [.45, 1.82, -.2], .014, MAT.steel), at(G("planar-antenna", box(.34, .02, .34, MAT.alu), box(.3, .022, .3, MAT.dark)), .5, 1.85, -.22, .4, .1));
  g.add(rod([-.04, 1.9, 0], [-.18, 2.55, 0], .01, MAT.steel));                                                           // whip antenna
  // surface sampler arm (pantograph + scoop)
  const base = [Math.cos(.52) * .5, .7, Math.sin(.52) * .5];
  g.add(rod(base, [1.0, .62, .86], .018, MAT.steel), rod([base[0], base[1] - .08, base[2]], [1.0, .5, .86], .018, MAT.steel),
        box(.12, .1, .18, MAT.alu, [1.04, .52, .9], [0, .6, 0]), box(.1, .05, .14, MAT.dark, [1.08, .46, .96], [.3, .6, 0]));
  g.add(box(.18, .02, .18, MAT.dust, [1.1, .02, .96]));                                                                  // trench patch
  return g;
}

// ======================================================================
// SOJOURNER — six-wheel rocker-bogie rover
// ======================================================================
function sojourner() {
  const g = G("sojourner");
  const r = .1, W = .1, zS = .36, y0 = r;
  g.add(box(.7, .16, .5, MAT.kapton, [0, .4, 0]), box(.68, .1, .46, MAT.alu, [0, .3, 0]));                                  // warm electronics box + skirt
  g.add(at(panel(.66, .46, 8, 5, .025, "solar-panel"), 0, .5, 0, 0, .0, .0));
  g.add(box(.72, .02, .52, MAT.white, [0, .395, 0]));
  for (const s of [-1, 1]) {
    const z = s * zS, px = .06;
    const front = [.3, y0, z], mid = [0, y0, z], rear = [-.3, y0, z], pivot = [px, .32, s * .27], bogieP = [.15, .2, z];
    g.add(rod(pivot, rear, .02, MAT.steel), rod(pivot, bogieP, .02, MAT.steel), rod(bogieP, front, .02, MAT.steel), rod(bogieP, mid, .02, MAT.steel), cyl(.035, .035, .08, MAT.dark, [pivot[0], pivot[1], pivot[2]], [Math.PI / 2, 0, 0]));
    for (const p of [front, mid, rear]) g.add(at(wheel(r, W), ...p));
    g.add(box(.5, .02, .03, MAT.steel, [0, .32, s * .27]));                                                                // rocker differential bar
  }
  g.add(cyl(.01, .01, .85, MAT.black, [-.3, .88, -.12]), sph(.022, MAT.red, [-.3, 1.31, -.12]));                           // whip antenna (UHF)
  g.add(box(.08, .05, .06, MAT.dark, [-.3, .55, -.12]));
  g.add(box(.16, .1, .06, MAT.dark, [.37, .42, 0]), cyl(.025, .025, .06, MAT.glass, [.41, .45, -.04], [0, 0, Math.PI / 2]), cyl(.025, .025, .06, MAT.glass, [.41, .45, .04], [0, 0, Math.PI / 2]),
        box(.04, .03, .12, MAT.red, [.4, .38, 0]));                                                                          // camera eyes + laser stripers
  g.add(rod([-.37, .38, 0], [-.55, .22, 0], .012, MAT.steel), cyl(.045, .045, .07, MAT.gold, [-.6, .2, 0], [0, 0, Math.PI / 2]));  // APXS arm
  g.add(box(.2, .04, .12, MAT.steel, [-.1, .55, .26], [0, 0, 0]));
  return g;
}

// ======================================================================
// VIKING — hexagonal lander, 3 legs, RTGs, HGA dish, sampler boom
// ======================================================================
function viking() {
  const g = G("viking");
  const hex = (r, h, mat, y) => cyl(r, r, h, mat, [0, y, 0], [0, Math.PI / 6, 0], 6);
  g.add(hex(.66, .26, MAT.steel, .22), hex(.58, .12, MAT.white, .41), hex(.5, .05, MAT.gold, .5));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(box(.02, .22, .02, MAT.dark, [Math.cos(a) * .66, .22, Math.sin(a) * .66])); }
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + Math.PI / 2, c = Math.cos(a), s = Math.sin(a), top = [c * .6, .2, s * .6], bot = [c * 1.75, -.6, s * 1.75];
    g.add(rod(top, bot, .035, MAT.alu), rod([c * .3, .04, s * .3], [c * 1.45, -.5, s * 1.45], .022, MAT.steel), cyl(.07, .07, .34, MAT.kapton, [c * .95, -.1, s * .95], [s * .55, 0, -c * .55]), at(foot(.22), c * 1.78, -.62, s * 1.78));
  }
  // RTGs with fins and wind shields
  for (const a of [Math.PI / 6, Math.PI + Math.PI / 6]) {
    const c = Math.cos(a), s = Math.sin(a), rg = G("rtg", cyl(.12, .12, .55, MAT.rtg, [0, 0, 0], [0, 0, Math.PI / 2]), cyl(.075, .075, .62, MAT.steel, [0, 0, 0], [0, 0, Math.PI / 2]));
    for (let k = -2; k <= 2; k++) rg.add(cyl(.17, .17, .015, MAT.alu, [k * .09, 0, 0], [0, 0, Math.PI / 2]));
    rg.add(box(.62, .02, .3, MAT.white, [0, .17, 0]), sph(.12, MAT.rtg, [.3, 0, 0], [.5, 1, 1]));
    g.add(at(rg, c * .78, .28, s * .78, -a + Math.PI / 2));
  }
  // high-gain antenna on a boom
  g.add(rod([.15, .5, -.2], [.3, 1.15, -.35], .03, MAT.alu), cyl(.06, .06, .1, MAT.dark, [.3, 1.16, -.35]));
  const hga = dish(.4, .32, MAT.white); hga.position.set(.3, 1.2, -.35); hga.rotation.set(-.9, .4, 0); g.add(hga, at(cyl(.015, .015, .26, MAT.steel), .38, 1.34, -.5, .4, -.9));
  // UHF antenna
  g.add(cyl(.02, .02, .55, MAT.alu, [-.5, .75, -.1]), cyl(.17, .17, .02, MAT.alu, [-.5, 1.05, -.1], null, 36));
  // camera towers
  for (const [x, z] of [[-.28, .32], [.1, .46]]) g.add(cyl(.075, .075, .42, MAT.white, [x, .75, z]), cyl(.09, .09, .1, MAT.dark, [x, .98, z]), cyl(.035, .035, .08, MAT.glass, [x + .08, .98, z + .05], [0, 0, Math.PI / 2]));
  // sampler boom, meteorology boom, seismometer, biology box
  g.add(rod([.3, .5, .3], [1.3, .55, .9], .022, MAT.steel), cyl(.04, .04, .22, MAT.steel, [1.32, .5, .92], [Math.PI / 2, 0, .8]), box(.12, .07, .18, MAT.dark, [1.36, .46, .96], [0, .6, 0]));
  g.add(rod([-.5, .5, .25], [-.5, 1.0, .85], .015, MAT.alu), box(.06, .04, .06, MAT.dark, [-.5, 1.03, .88]));
  g.add(box(.34, .2, .26, MAT.gold, [-.2, .6, -.32]), box(.24, .18, .2, MAT.white, [.3, .59, .08]), cyl(.09, .09, .1, MAT.kapton, [.1, .6, -.05]));
  g.add(box(.3, .06, .24, MAT.alu, [0, .55, .5]));
  return g;
}

// ======================================================================
// PHOENIX — three-legged polar lander, two circular solar fans, robotic arm
// ======================================================================
function phoenix() {
  const g = G("phoenix");
  g.add(cyl(.72, .78, .12, MAT.alu, [0, 0, 0], [0, Math.PI / 12, 0], 12), cyl(.7, .7, .03, MAT.white, [0, .075, 0], null, 12), tor(.72, .018, MAT.gold, [0, 0, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    g.add(rod([c * .66, -.02, s * .66], [c * 1.25, -.78, s * 1.25], .035, MAT.alu), rod([c * .3, -.05, s * .3], [c * 1.0, -.62, s * 1.0], .02, MAT.steel), cyl(.06, .06, .38, MAT.kapton, [c * .96, -.33, s * .96], [s * .62, 0, -c * .62]), at(foot(.17), c * 1.27, -.8, s * 1.27));
  }
  // solar fans on booms
  for (const sgn of [-1, 1]) {
    g.add(rod([sgn * .7, .1, 0], [sgn * 1.0, .24, 0], .03, MAT.alu), at(fan(.86, 6, "solar-fan"), sgn * 1.75, .26, 0, 0, 0, sgn * .07));
  }
  g.add(cyl(.2, .2, .02, MAT.gold, [.0, .095, .06], null, 24));
  // robotic arm
  const sh = [.25, .15, .45], el = [.62, .7, .9], wr = [1.05, .25, 1.0];
  g.add(cyl(.07, .07, .1, MAT.dark, sh), rod(sh, el, .03, MAT.alu), sph(.05, MAT.dark, el), rod(el, wr, .026, MAT.alu), sph(.04, MAT.dark, wr),
        at(G("scoop", box(.14, .06, .18, MAT.steel), box(.14, .02, .03, MAT.dark, [0, -.04, .1])), wr[0] + .02, wr[1] - .06, wr[2] + .05, .3, .5));
  g.add(box(.18, .06, .1, MAT.steel, [.15, .15, .4]));
  // stereo camera mast, MET mast
  g.add(rod([-.12, .06, -.4], [-.12, .72, -.4], .022, MAT.alu), box(.2, .1, .1, MAT.white, [-.12, .78, -.4]), cyl(.03, .03, .06, MAT.glass, [-.2, .78, -.34], [Math.PI / 2, 0, 0]), cyl(.03, .03, .06, MAT.glass, [-.04, .78, -.34], [Math.PI / 2, 0, 0]));
  g.add(rod([.45, .06, -.5], [.45, 1.15, -.5], .012, MAT.steel), box(.22, .02, .02, MAT.alu, [.45, 1.1, -.5]), box(.1, .08, .1, MAT.dark, [.45, .35, -.5]));
  // TEGA ovens, MECA, UHF antenna
  g.add(cyl(.09, .09, .16, MAT.alu, [-.1, .17, .22]), cyl(.06, .12, .06, MAT.steel, [-.1, .28, .22]), cyl(.09, .09, .16, MAT.alu, [.0, .17, .38]), cyl(.06, .12, .06, MAT.steel, [.0, .28, .38]),
        box(.34, .14, .22, MAT.white, [-.35, .15, 0]), cyl(.015, .015, .45, MAT.alu, [.6, .28, .1]), cyl(.1, .1, .02, MAT.alu, [.6, .53, .1]));
  g.add(box(.22, .12, .2, MAT.gold, [.45, .13, -.15]), box(.2, .1, .14, MAT.kapton, [-.5, .13, -.35]));
  return g;
}

// ======================================================================
// INSIGHT — lander with two big solar fans, dome seismometer on the ground, heat probe
// ======================================================================
function insight() {
  const g = G("insight");
  g.add(cyl(.72, .78, .14, MAT.white, [0, 0, 0], [0, Math.PI / 6, 0], 6), cyl(.7, .7, .03, MAT.cream, [0, .085, 0], [0, Math.PI / 6, 0], 6), tor(.74, .02, MAT.gold, [0, 0, 0], [Math.PI / 2, 0, 0], 6));
  g.add(box(.5, .16, .4, MAT.gold, [-.1, .17, -.1]), box(.36, .12, .3, MAT.alu, [.2, .15, .25]));
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
    g.add(rod([c * .66, -.02, s * .66], [c * 1.3, -.8, s * 1.3], .035, MAT.alu), rod([c * .3, -.05, s * .3], [c * 1.05, -.64, s * 1.05], .02, MAT.steel), cyl(.06, .06, .38, MAT.kapton, [c * .98, -.34, s * .98], [s * .62, 0, -c * .62]), at(foot(.17), c * 1.32, -.82, s * 1.32));
  }
  for (const sgn of [-1, 1]) {
    g.add(rod([sgn * .72, .1, 0], [sgn * 1.0, .24, 0], .03, MAT.alu), at(fan(1.05, 8, "solar-fan"), sgn * 2.1, .27, 0, 0, 0, sgn * .06));
    g.add(rod([sgn * .5, .12, -.55], [sgn * .75, .38, -.8], .01, MAT.steel));
  }
  // instruments on the ground: seismometer dome (SEIS) and heat probe box (HP3)
  const sx = 1.2, sz = 1.2;
  g.add(G("seis-dome", sph(.5, MAT.steel, [sx, -.82, sz], [1, .75, 1]), tor(.5, .03, MAT.alu, [sx, -.82, sz], [Math.PI / 2, 0, 0]), tor(.35, .015, MAT.alu, [sx, -.6, sz], [Math.PI / 2, 0, 0])));
  g.add(cyl(.12, .12, .24, MAT.gold, [sx - 1.0, -.7, sz + .1]), cyl(.04, .04, .5, MAT.dark, [sx - 1.0, -.55, sz + .1], [0, 0, 0]), rod([sx - 1.0, -.82, sz + .1], [sx - .5, -.84, sz - .1], .01, MAT.black));
  // robotic arm with scoop-grapple
  const sh = [.05, .18, .55], el = [.6, .55, 1.0], wr = [.95, .0, 1.15];
  g.add(cyl(.07, .07, .1, MAT.dark, sh), rod(sh, el, .032, MAT.alu), sph(.05, MAT.dark, el), rod(el, wr, .028, MAT.alu), sph(.04, MAT.dark, wr), at(G("grapple", box(.12, .12, .06, MAT.dark), box(.02, .1, .02, MAT.alu, [-.05, -.1, 0]), box(.02, .1, .02, MAT.alu, [.05, -.1, 0])), wr[0], wr[1] - .06, wr[2], 0, 0));
  g.add(box(.14, .12, .1, MAT.white, [.62, .62, 1.02]), cyl(.025, .025, .05, MAT.glass, [.62, .62, 1.08], [Math.PI / 2, 0, 0]));        // IDC on the arm
  // antennas, cameras, wind sensors
  g.add(rod([-.5, .1, .55], [-.5, .65, .55], .02, MAT.white), cyl(.03, .09, .14, MAT.white, [-.5, .75, .55]));
  g.add(at(cyl(.03, .08, .12, MAT.white), -.1, .22, -.6, 0, Math.PI / 2 - .3), at(cyl(.03, .08, .12, MAT.white), .1, .22, -.6, 0, Math.PI / 2 - .3));
  g.add(rod([.65, .1, .35], [.95, .2, .5], .012, MAT.steel), box(.06, .04, .05, MAT.dark, [.97, .21, .51]), rod([-.65, .1, .3], [-.95, .2, .45], .012, MAT.steel), box(.06, .04, .05, MAT.dark, [-.97, .21, .46]));
  g.add(box(.1, .08, .08, MAT.dark, [.0, .0, .72]), cyl(.025, .025, .04, MAT.glass, [.0, .0, .78], [Math.PI / 2, 0, 0]));
  return g;
}

// ======================================================================
// PIONEER 10 — big high-gain dish, hexagonal bus, RTG booms, magnetometer boom, plaque
// ======================================================================
function pioneer() {
  const g = G("pioneer");
  const R = 1.37, f = 1.0;
  const d = dish(R, f, MAT.alu, "high-gain-dish"); d.rotation.x = Math.PI / 2; d.position.z = 0; g.add(d);           // opens towards +Z
  g.add(tor(R, .025, MAT.steel, [0, 0, R * R / (4 * f)], null));
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; g.add(rod([0, 0, 0], [Math.cos(a) * R, Math.sin(a) * R, R * R / (4 * f)], .008, MAT.steel)); }  // ribs behind
  // bus (hexagonal prism) behind the dish
  g.add(cyl(.5, .5, .42, MAT.white, [0, 0, -.28], [Math.PI / 2, Math.PI / 6, 0], 6), cyl(.46, .46, .06, MAT.gold, [0, 0, -.52], [Math.PI / 2, Math.PI / 6, 0], 6), cyl(.52, .52, .05, MAT.kapton, [0, 0, -.06], [Math.PI / 2, Math.PI / 6, 0], 6));
  // feed horn on a tripod
  const fz = f;
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 2; g.add(rod([Math.cos(a) * .95, Math.sin(a) * .95, .9 * .95 * .95 / (1) * .55 + .0], [Math.cos(a) * .06, Math.sin(a) * .06, fz], .014, MAT.alu)); }
  g.add(cyl(.1, .1, .3, MAT.white, [0, 0, fz + .1], [Math.PI / 2, 0, 0]), cyl(.05, .13, .12, MAT.alu, [0, 0, fz + .3], [Math.PI / 2, 0, 0]), sph(.07, MAT.gold, [0, 0, fz + .38]));
  // RTG booms (2 x 2 RTGs) at 120° from the magnetometer boom
  for (const sgn of [-1, 1]) {
    const dir = V(sgn * Math.cos(.35), -Math.sin(.35) * .2, -.0);
    const end = V(sgn * 2.8, -.25, -.45), start = V(sgn * .5, 0, -.35);
    g.add(rod(start.toArray(), end.toArray(), .022, MAT.alu), rod([sgn * .5, .0, -.35], [sgn * 1.6, .35, -.2], .01, MAT.steel));
    for (const k of [0, 1]) {
      const p = V(sgn * (1.75 + k * .62), -.2, -.42 + (k ? .02 : -.02)), rg = G("rtg", cyl(.1, .1, .55, MAT.rtg, [0, 0, 0], [0, 0, Math.PI / 2]));
      for (let j = -3; j <= 3; j++) rg.add(cyl(.15, .15, .012, MAT.alu, [j * .075, 0, 0], [0, 0, Math.PI / 2]));
      rg.position.copy(p); g.add(rg);
    }
  }
  // magnetometer boom (long, thin) and its sensor
  g.add(rod([0, -.3, -.5], [-1.1, -.7, -3.9], .014, MAT.alu), box(.1, .1, .1, MAT.gold, [-1.12, -.71, -3.95]));
  // science / sensors on the bus: star sensor, thrusters, antenna omni, plaque
  g.add(cyl(.06, .06, .22, MAT.dark, [.3, .34, -.35], [0, 0, 0]), cyl(.075, .075, .05, MAT.black, [.3, .46, -.35]), box(.14, .14, .1, MAT.steel, [-.32, -.38, -.16]), cyl(.02, .02, .5, MAT.alu, [-.4, .2, -.5], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; g.add(cyl(.02, .035, .09, MAT.black, [Math.cos(a) * (R - .08), Math.sin(a) * (R - .08), R * R / (4 * f) + .02], [Math.PI / 2, 0, 0])); }
  const plaque = box(.34, .22, .008, MAT.gold, [.58, -.62, .12], [0, .35, .0]); plaque.name = "plaque"; g.add(plaque, rod([.42, -.3, -.1], [.55, -.55, .1], .012, MAT.steel), rod([.74, -.3, -.1], [.62, -.55, .1], .012, MAT.steel));
  return g;
}

// ======================================================================
// DAWN — box bus with gold foil, two five-panel solar wings, HGA dish, three ion engines
// ======================================================================
function dawn() {
  const g = G("dawn");
  g.add(box(1.0, 1.0, 1.4, MAT.gold, [0, 0, 0]), box(1.02, .05, 1.42, MAT.white, [0, .5, 0]), box(1.02, .05, 1.42, MAT.white, [0, -.5, 0]));
  g.add(box(1.04, .8, .06, MAT.kapton, [0, 0, .72]), box(.6, .5, .06, MAT.dark, [0, 0, -.72]));
  for (const sgn of [-1, 1]) {
    g.add(rod([sgn * .52, 0, 0], [sgn * .95, 0, 0], .05, MAT.alu), box(.12, .3, .3, MAT.steel, [sgn * .56, 0, 0]));
    for (let i = 0; i < 4; i++) {
      const w = .95, cx = sgn * (1.0 + w / 2 + i * (w + .03));
      g.add(at(panel(w, 2.1, 4, 7, .035, "solar-panel"), cx, 0, 0));
    }
    g.add(box(.05, .04, 2.14, MAT.alu, [sgn * 4.95, 0, 0]));
  }
  // high-gain dish on a gimbal at the front
  const hga = dish(.62, .5, MAT.white, "high-gain-dish"); hga.rotation.x = Math.PI / 2 - .35; hga.position.set(.0, .12, 1.0); g.add(hga, cyl(.07, .07, .3, MAT.alu, [0, .0, .88], [Math.PI / 2, 0, 0]), at(cyl(.02, .02, .55, MAT.alu), 0, .26, 1.28, 0, Math.PI / 2 - .35), sph(.05, MAT.gold, [0, .43, 1.45]));
  // ion thrusters (three, at the rear) with grid discs
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + Math.PI / 2, x = Math.cos(a) * .25, y = Math.sin(a) * .22 - .02;
    g.add(cyl(.13, .17, .3, MAT.steel, [x, y, -.95], [Math.PI / 2, 0, 0]), cyl(.13, .13, .03, MAT.copper, [x, y, -1.12], [Math.PI / 2, 0, 0]), cyl(.1, .1, .035, MAT.black, [x, y, -1.135], [Math.PI / 2, 0, 0]), tor(.15, .012, MAT.alu, [x, y, -1.1], null));
  }
  // science instruments on the underside: framing cameras, VIR spectrometer, GRaND
  g.add(box(.3, .22, .3, MAT.white, [.28, -.62, .35]), cyl(.06, .08, .22, MAT.dark, [.28, -.8, .35]), box(.3, .22, .3, MAT.white, [-.1, -.62, .35]), cyl(.06, .08, .22, MAT.dark, [-.1, -.8, .35]),
        box(.34, .26, .36, MAT.steel, [-.3, -.66, -.2]), cyl(.1, .13, .26, MAT.alu, [-.3, -.88, -.2]), box(.28, .2, .36, MAT.kapton, [.3, -.62, -.2]));
  // star trackers, low-gain antennas, thruster pods
  g.add(cyl(.05, .05, .2, MAT.dark, [.35, .58, .35]), cyl(.07, .07, .04, MAT.black, [.35, .7, .35]), cyl(.05, .05, .2, MAT.dark, [-.35, .58, .35]), cyl(.07, .07, .04, MAT.black, [-.35, .7, .35]),
        cyl(.03, .09, .14, MAT.white, [0, .6, -.45]), cyl(.03, .09, .14, MAT.white, [.45, 0, -.74]));
  for (const [x, y] of [[.5, .5], [-.5, .5], [.5, -.5], [-.5, -.5]]) g.add(cyl(.02, .04, .08, MAT.black, [x, y, .75], [Math.PI / 2, 0, 0]));
  return g;
}

// ---------- export ----------
function finish(g) {
  const b = new T.Box3().setFromObject(g), c = b.getCenter(new T.Vector3());
  const wrap = new T.Group(); wrap.name = g.name; wrap.add(g); g.position.set(-c.x, -b.min.y, -c.z); return wrap;
}
const BUILD = { surveyor3, sojourner, viking, phoenix, insight, pioneer, dawn };
for (const [id, fn] of Object.entries(BUILD)) {
  const buf = await new GLTFExporter().parseAsync(finish(fn()), { binary: true });
  writeFileSync(OUT + id + ".glb", Buffer.from(buf));
  console.log("wrote", id + ".glb", (buf.byteLength / 1024).toFixed(0) + " KB");
}
