// Small 3D viewer used in the info panel. Shows the exhibit's .glb if it exists, else an abstract placeholder.
import * as T from "three";
import { makeGLTFLoader } from "./glb.js";
import { buildAbstract } from "./shapes.js";

async function exists(url) {
  if (location.protocol === "file:") return false;           // browsers block local file reads for WebGL
  try { const r = await fetch(url, { method: "HEAD" }); return r.ok && !(r.headers.get("content-type") || "").includes("text/html"); }
  catch { return false; }
}

export class Preview {
  constructor(canvas, tagEl) {
    this.canvas = canvas; this.tagEl = tagEl;
    this.r = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.r.toneMapping = T.ACESFilmicToneMapping;
    this.scene = new T.Scene();
    this.cam = new T.PerspectiveCamera(36, 1, .1, 50); this.cam.position.set(0, .7, 4.6); this.cam.lookAt(0, 0, 0);
    this.scene.add(new T.AmbientLight(0xcdbcff, 1.3));
    const sun = new T.DirectionalLight(0xfff0dd, 3); sun.position.set(-3, 4, 5); this.scene.add(sun);
    const rim = new T.DirectionalLight(0xec5190, 1.2); rim.position.set(4, 2, -4); this.scene.add(rim);
    this.holder = new T.Group(); this.scene.add(this.holder);
    this.yaw = .6; this.drag = null; this.token = 0; this.running = false;
    canvas.addEventListener("pointerdown", e => { this.drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (this.drag !== null) { this.yaw += (e.clientX - this.drag) * .01; this.drag = e.clientX; } });
    const up = () => (this.drag = null); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
  }
  async show(ex) {
    const my = ++this.token;
    this.holder.clear(); this.resize();
    let obj = null, real = false;
    if (await exists(ex.model)) {
      try {
        const gltf = await makeGLTFLoader().loadAsync(ex.model); obj = gltf.scene; real = true;
        const box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
        const k = 1.9 / Math.max(size.x, size.y, size.z); obj.scale.setScalar(k); obj.position.sub(c.multiplyScalar(k));
      } catch { obj = null; }
    }
    if (my !== this.token) return;
    if (!obj) obj = buildAbstract(ex.id);
    this.holder.add(obj);
    if (this.tagEl) this.tagEl.textContent = real && !ex.placeholder ? "3D MODEL · " + ex.short : "3D MODEL IN DEVELOPMENT · placeholder";
  }
  start() { if (this.running) return; this.running = true; const loop = () => { if (!this.running) return; this.holder.rotation.y = this.yaw += this.drag === null ? .006 : 0; this.r.render(this.scene, this.cam); requestAnimationFrame(loop); }; loop(); }
  stop() { this.running = false; }
}
