// Entry point: "Interactive Explore" button -> page slides away -> darken -> three.js intro -> darken -> planets.
import { createExplore } from "./explore.js";
import { createIntro } from "./intro.js";

window.AstronexIntro = { create: createIntro };           // для демо-страницы intro.html

const wait = ms => new Promise(r => setTimeout(r, ms));

(async function init() {
  const btn = document.getElementById("explore-btn");
  if (!btn) return;
  const data = window.EXHIBITS_DATA ?? await (await fetch("../data/exhibits.json")).json();
  const html = document.documentElement;
  let xp = null, busy = false, inExplore = false, skipIntro = null, scrollPos = 0;

  // veil + video layers
  const veil = Object.assign(document.createElement("div"), { id: "xp-veil" });
  document.body.append(veil);
  const fade = (on, ms) => { veil.style.transitionDuration = ms + "ms"; veil.classList.toggle("on", on); return wait(ms); };

  // page pieces that fly out
  const pieces = () => {
    const out = [[document.querySelector(".top"), "u"], [document.querySelector(".hero"), "l"], [document.querySelector("main > div.wrap"), "r"], [document.querySelector("footer"), "d"]];
    document.querySelectorAll("main > section.block").forEach((s, i) => out.push([s, i % 2 ? "l" : "r"]));
    return out.filter(([el]) => el);
  };

  // Вступление (src/explore/intro.js): ракета на фоне сайта. onFade — момент, когда фон начинает плавно меняться на космос Explore.
  function playIntro(onFade) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();   // без анимации для тех, кому она вредна
    return new Promise(resolve => {
      let intro = null, done = false;
      const finish = async () => {                                  // onAnimationEnd: и по окончании, и по «Skip»
        if (done) return; done = true; skipIntro = null;
        intro.el.classList.remove("on");
        await wait(650);
        intro.dispose(); resolve();
      };
      intro = createIntro({ onFade, onAnimationEnd: finish });
      skipIntro = () => intro.skip();
      intro.play();
    });
  }

  async function enter() {
    if (busy || inExplore) return; busy = true;
    scrollPos = scrollY;
    xp ??= createExplore(data);
    xp.onExit = leave; xp.onState = saveState;
    const prep = xp.prepare();                       // планеты строятся, пока играет вступление
    pieces().forEach(([el, dir]) => (el.dataset.xpAway = dir));
    html.classList.add("xp-lock", "xp-away");        // элементы сайта плавно исчезают, остаётся только фон
    await wait(800);
    pieces().forEach(([el]) => (el.inert = true));
    let shown = null;
    const reveal = () => (shown ??= prep.then(() => xp.show({ fade: true })));   // фон плавно становится космосом, элементы Explore проявляются
    await playIntro(reveal);                         // летящая ракета
    await reveal();
    inExplore = true;
    busy = false;
  }

  // keep the Explore position in the URL so a reload reopens the same place
  const EDITQ = /[?&]edit(=|&|$)/.test(location.search) ? "&edit=1" : "";
  function saveState(st) {
    if (!inExplore && !busy) return;
    const u = "?explore=" + (st.planet || "select") + (st.site ? "&site=" + encodeURIComponent(st.site) : "") + EDITQ;
    history.replaceState(null, "", location.pathname + u);
  }

  async function leave() {
    if (busy || !inExplore) return; busy = true;
    history.replaceState(null, "", location.pathname + location.hash);
    await fade(true, 800);
    xp.hide(); inExplore = false;
    html.classList.add("xp-instant"); html.classList.remove("xp-away");
    pieces().forEach(([el]) => (el.inert = false));
    html.classList.remove("xp-lock"); scrollTo(0, scrollPos);
    await wait(60); html.classList.remove("xp-instant");
    await fade(false, 900);
    busy = false;
  }

  // coming back from exhibit.html: open Explore straight at the planet / site (no intro)
  async function enterDirect(planet, exId) {
    busy = true; scrollPos = (window.AX && AX.savedScroll()) || 0;
    veil.style.transitionDuration = "0ms"; veil.classList.add("on");
    xp ??= createExplore(data); xp.onExit = leave; xp.onState = saveState;
    await xp.prepare();
    html.classList.add("xp-lock", "xp-away", "xp-instant");
    pieces().forEach(([el, dir]) => { el.dataset.xpAway = dir; el.inert = true; });
    await xp.show(); inExplore = true;
    xp.openAt(planet, exId); saveState({ planet: P_OK(planet), site: exId });
    await wait(120); html.classList.remove("xp-instant");
    await fade(false, 800); busy = false;
  }
  const q = new URLSearchParams(location.search);
  const P_OK = p => (p === "moon" || p === "mars" ? p : null);
  if (q.get("explore")) enterDirect(q.get("explore"), q.get("site"));

  btn.addEventListener("click", enter);
  document.querySelectorAll('a[href="#explore"]').forEach(a => a.addEventListener("click", e => {
    if (a.classList.contains("btn")) { e.preventDefault(); enter(); }
  }));
  addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (skipIntro) skipIntro();
    else if (inExplore && !busy && !xp.escape()) leave();
  });
})();
