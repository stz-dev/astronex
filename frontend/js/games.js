// Games hub: pick one of three games; the chosen one runs in an iframe (games/*.html?embed). The URL hash keeps the choice across reloads.
(() => {
  const GAMES = {
    rover:  { title: "Rover landing",     src: "games/moon-lander.html?embed=1&g=rover#lander" },
    launch: { title: "Launch to Nowhere", src: "games/moon-lander.html?embed=1&g=launch#launch" },
    signal: { title: "Signal Recovery",   src: "games/signal-recovery.html?embed=1" }
  };
  const hub = document.getElementById("gHub"), play = document.getElementById("gPlay"), frame = document.getElementById("gFrame");
  let cur = null;
  function route() {
    const k = location.hash.slice(1), g = GAMES[k];
    if (!g) { hub.hidden = false; play.hidden = true; frame.src = "about:blank"; cur = null; document.title = "Games · ASTRONEX"; return; }
    hub.hidden = true; play.hidden = false; document.getElementById("gTitle").textContent = g.title; document.title = g.title + " · ASTRONEX";
    if (cur !== k) { frame.src = g.src; cur = k; }
    scrollTo(0, 0);
    frame.addEventListener("load", () => { try { frame.contentWindow.focus(); } catch {} }, { once: true });
  }
  addEventListener("hashchange", route);
  document.getElementById("gBack").addEventListener("click", () => { history.pushState(null, "", location.pathname); route(); });
  document.getElementById("gFull").addEventListener("click", () => { (frame.requestFullscreen || frame.webkitRequestFullscreen || (() => {})).call(frame); });
  addEventListener("message", e => {
    if (e.data && e.data.astronex === "size" && e.source === frame.contentWindow) frame.style.height = Math.min(3200, Math.max(560, e.data.h)) + "px"; if (e.data && e.data.astronex === "games-menu") { history.pushState(null, "", location.pathname); route(); } });
  route();
})();
