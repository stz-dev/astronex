// Abstract placeholder objects (until the 3D team's .glb files arrive in frontend/models/).
import * as T from "three";

const edgeMat = new T.LineBasicMaterial({ color: 0x12072e, transparent: true, opacity: .9 });
function part(geo, color, { metal = .3, rough = .55, pos = [0, 0, 0], rot = [0, 0, 0], emissive = 0 } = {}) {
  const m = new T.Mesh(geo, new T.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive, emissiveIntensity: .4, flatShading: true }));
  m.position.set(...pos); m.rotation.set(...rot);
  m.add(new T.LineSegments(new T.EdgesGeometry(geo, 25), edgeMat));
  return m;
}
const cyl = (rt, rb, h, s = 12) => new T.CylinderGeometry(rt, rb, h, s);
const box = (x, y, z) => new T.BoxGeometry(x, y, z);
const GOLD = 0xd9a441, GREY = 0xb7b9c2, DARK = 0x3b4152, WHITE = 0xe6e9f0, RUST = 0xc9703e, BLUE = 0x2a4a8c;

function legs(g, n, rTop, rBot, y0, y1, color = GREY, thick = .03) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, top = new T.Vector3(Math.cos(a) * rTop, y0, Math.sin(a) * rTop), bot = new T.Vector3(Math.cos(a) * rBot, y1, Math.sin(a) * rBot);
    const mid = top.clone().add(bot).multiplyScalar(.5), len = top.distanceTo(bot);
    const leg = part(cyl(thick, thick, len, 6), color, { pos: mid.toArray() });
    leg.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), top.clone().sub(bot).normalize());
    g.add(leg);
    g.add(part(cyl(.1, .1, .02, 10), color, { pos: [bot.x, bot.y - .01, bot.z] }));
  }
}
function wheels(g, xs, zs, y, r = .22, w = .12) {
  for (const x of xs) for (const z of zs)
    g.add(part(cyl(r, r, w, 14), DARK, { pos: [x, y, z], rot: [Math.PI / 2, 0, 0], rough: .9 }));
}
function dish(g, pos, r = .3, rot = [-.9, 0, 0]) {
  g.add(part(new T.SphereGeometry(r, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), WHITE, { pos, rot, metal: .6 }));
}

const BUILDERS = {
  "apollo-lm": g => {
    g.add(part(cyl(.85, .85, .5, 8), GOLD, { metal: .7, rough: .35 }));
    g.add(part(cyl(.3, .12, .35, 10), DARK, { pos: [0, -.4, 0] }));
    legs(g, 4, .8, 1.35, -.05, -.62, GOLD);
    g.add(part(box(.22, .5, .06), GREY, { pos: [0, -.1, .92], rot: [.25, 0, 0] }));
  },
  lrv: g => {
    g.add(part(box(1.7, .1, .85), GREY));
    wheels(g, [-.6, .6], [-.5, .5], -.12, .26, .12);
    g.add(part(box(.3, .3, .3), WHITE, { pos: [-.15, .2, -.18] }));
    g.add(part(box(.3, .3, .3), WHITE, { pos: [-.15, .2, .18] }));
    g.add(part(cyl(.025, .025, .8, 6), GREY, { pos: [.5, .5, 0] }));
    dish(g, [.5, .92, 0], .26, [-1.1, 0, 0]);
    g.add(part(box(.4, .22, .6), DARK, { pos: [.55, .12, 0] }));
  },
  surveyor3: g => {
    g.add(part(cyl(.1, .1, .9, 8), GREY, { pos: [0, .35, 0] }));
    g.add(part(box(.5, .3, .35), WHITE, { pos: [0, 0, 0] }));
    legs(g, 3, .1, 1.0, -.05, -.62, GREY, .035);
    g.add(part(box(.9, .02, .5), BLUE, { pos: [0, .9, 0], rot: [0, 0, .3] }));
    dish(g, [.25, .55, 0], .22, [-.4, 0, .5]);
    g.add(part(cyl(.05, .05, .6, 6), GREY, { pos: [-.4, .1, .4], rot: [0, 0, 1.2] }));
  },
  mer: g => {
    g.add(part(box(1.0, .3, .7), GOLD, { metal: .6 }));
    g.add(part(box(1.0, .03, .78), BLUE, { pos: [0, .18, 0] }));
    wheels(g, [-.42, 0, .42], [-.5, .5], -.25, .16, .12);
    g.add(part(cyl(.03, .03, .6, 6), GREY, { pos: [.38, .45, .2] }));
    g.add(part(box(.22, .1, .12), WHITE, { pos: [.38, .78, .2] }));
    dish(g, [-.35, .25, -.2], .16, [-.5, 0, 0]);
  },
  ingenuity: g => {
    g.add(part(box(.4, .4, .4), GOLD, { metal: .6 }));
    g.add(part(cyl(.03, .03, .6, 6), GREY, { pos: [0, .5, 0] }));
    g.add(part(box(.9, .03, .7), BLUE, { pos: [0, .88, 0] }));
    for (const [y, rot] of [[.7, 0], [.58, Math.PI / 2]]) {
      g.add(part(box(1.9, .015, .09), DARK, { pos: [0, y, 0], rot: [0, rot, 0] }));
    }
    legs(g, 4, .2, .55, -.2, -.65, GREY, .02);
  },
  sojourner: g => {
    g.add(part(box(.8, .28, .55), GREY, { metal: .5 }));
    g.add(part(box(.78, .03, .52), BLUE, { pos: [0, .17, 0] }));
    wheels(g, [-.32, 0, .32], [-.36, .36], -.2, .15, .1);
    g.add(part(cyl(.02, .02, .4, 6), GREY, { pos: [-.28, .38, 0] }));
  },
  viking: g => {
    g.add(part(cyl(.7, .7, .3, 6), GREY, { metal: .4 }));
    g.add(part(cyl(.34, .5, .1, 10), WHITE, { pos: [0, .22, 0] }));
    legs(g, 3, .5, 1.2, -.1, -.62, GREY, .04);
    dish(g, [.35, .45, .25], .25, [-.6, 0, 0]);
    g.add(part(box(.9, .03, .1), BLUE, { pos: [-.7, .3, 0], rot: [0, 0, -.4] }));
    g.add(part(cyl(.03, .03, .8, 6), GREY, { pos: [-.3, .6, -.3] }));
  },
  phoenix: g => {
    g.add(part(cyl(.75, .75, .1, 24), GREY, { metal: .5 }));
    g.add(part(cyl(.5, .5, .25, 12), WHITE, { pos: [0, .17, 0] }));
    for (const s of [-1, 1]) g.add(part(cyl(.6, .6, .02, 20), BLUE, { pos: [s * 1.05, .1, 0], rot: [0, 0, s * .06] }));
    legs(g, 3, .55, 1.1, -.04, -.6, GREY, .03);
    g.add(part(cyl(.025, .025, .9, 6), GREY, { pos: [.3, .55, .1] }));
  },
  insight: g => {
    g.add(part(cyl(.62, .62, .1, 24), GREY, { metal: .5 }));
    for (const s of [-1, 1]) g.add(part(cyl(.62, .62, .02, 24), BLUE, { pos: [s * 1.15, .08, 0] }));
    g.add(part(new T.SphereGeometry(.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), GOLD, { pos: [.2, .05, .2], metal: .6 }));
    g.add(part(cyl(.14, .14, .08, 10), WHITE, { pos: [-.25, .09, -.15] }));
    legs(g, 3, .5, 1.0, -.04, -.55, GREY, .03);
  },
  pioneer: g => {
    g.add(part(new T.SphereGeometry(.9, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), WHITE, { rot: [Math.PI / 2, 0, 0], pos: [0, 0, .25], metal: .5 }));
    g.add(part(cyl(.28, .28, .3, 6), GREY, { rot: [Math.PI / 2, 0, 0], pos: [0, 0, -.1] }));
    g.add(part(box(.35, .25, .02), GOLD, { pos: [.4, .1, -.15] }));
    for (const s of [-1, 1]) g.add(part(cyl(.025, .025, 1.2, 6), GREY, { pos: [s * .7, -.2, -.3], rot: [0, 0, 1.2 * s] }));
  },
  dawn: g => {
    g.add(part(box(.55, .55, .8), GOLD, { metal: .6 }));
    for (const s of [-1, 1]) g.add(part(box(1.3, .02, .6), BLUE, { pos: [s * 1.0, 0, 0] }));
    dish(g, [0, .4, .2], .3, [-.8, 0, 0]);
    g.add(part(cyl(.06, .1, .2, 8), DARK, { pos: [0, 0, -.5], rot: [Math.PI / 2, 0, 0] }));
  }
};

export function buildAbstract(id) {
  const g = new T.Group();
  (BUILDERS[id] || (gg => gg.add(part(new T.IcosahedronGeometry(.8, 1), GREY))))(g);
  return g;
}
