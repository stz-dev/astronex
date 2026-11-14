// Entry point: "Interactive Explore" button -> page slides away -> darken -> intro video -> darken -> planets.
import { createExplore } from "./explore.js";

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

  function playIntro() {
    return new Promise(resolve => {
      const video = Object.assign(document.createElement("video"), { id: "xp-video", playsInline: true, preload: "auto" });
      const skip = Object.assign(document.createElement("button"), { id: "xp-skip", type: "button", textContent: "Skip ›" });
      const note = Object.assign(document.createElement("div"), { id: "xp-note" });
      let done = false;
      const finish = async () => {
        if (done) return; done = true; skipIntro = null;
        video.classList.remove("on"); skip.classList.remove("on"); note.classList.remove("on");
        await wait(650);
        video.pause(); video.removeAttribute("src"); video.load(); video.remove(); skip.remove(); note.remove();
        resolve();
      };
      skipIntro = finish;
      video.addEventListener("ended", finish);
      video.addEventListener("error", () => {
        note.textContent = "Intro video not found — add frontend/video/intro.mp4"; note.classList.add("on");
        setTimeout(finish, 1800);
      });
      skip.addEventListener("click", finish);
      document.body.append(video, note, skip);
      video.src = "video/intro.mp4";
      requestAnimationFrame(() => { video.classList.add("on"); setTimeout(() => skip.classList.add("on"), 800); });
      const p = video.play(); if (p) p.catch(() => { video.muted = true; video.play().catch(() => {}); });
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
    await playIntro();                               // mp4
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
