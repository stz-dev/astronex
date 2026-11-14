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

  // Вступление на three.js (src/explore/intro.js): одна непрерывная сцена ~14 с вместо mp4.
  function playIntro() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();   // без анимации для тех, кому она вредна
    return new Promise(resolve => {
      let intro = null, done = false;
      const finish = async () => {                                  // onAnimationEnd: и по окончании, и по «Skip»
        if (done) return; done = true; skipIntro = null;
        intro.el.classList.remove("on");
        await wait(700);
        intro.dispose(); resolve();
      };
      intro = createIntro({ onAnimationEnd: finish });
      skipIntro = () => intro.skip();
      intro.play();
    });
  }

  async function enter() {
    if (busy || inExplore) return; busy = true;
    scrollPos = scrollY;
    xp ??= createExplore(data);
    xp.onExit = leave;
    const prep = xp.prepare();                       // build planets while the intro plays
    pieces().forEach(([el, dir]) => (el.dataset.xpAway = dir));
    html.classList.add("xp-lock", "xp-away");        // everything slides aside
    await wait(350);
    await fade(true, 1100);                          // site goes dark
    pieces().forEach(([el]) => (el.inert = true));
    await playIntro();                               // three.js intro (ракета, дым)
    await prep;
    await xp.show();                                 // planets appear (under the black veil)
    inExplore = true;
    await fade(false, 1000);                         // lights come up on the planets
    busy = false;
  }

  async function leave() {
    if (busy || !inExplore) return; busy = true;
    await fade(true, 800);
    xp.hide(); inExplore = false;
    html.classList.add("xp-instant"); html.classList.remove("xp-away");
    pieces().forEach(([el]) => (el.inert = false));
    html.classList.remove("xp-lock"); scrollTo(0, scrollPos);
    await wait(60); html.classList.remove("xp-instant");
    await fade(false, 900);
    busy = false;
  }

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
