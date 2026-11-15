(async () => {

initStars();

const data = await loadData();
const { exhibits, halls } = data;

// hero slot = featured exhibit
mountViewer(document.getElementById("hero-stage"), exhibits.find(e => e.id === "apollo-lm") ?? exhibits[0], { controls: false });

// stats
document.getElementById("stats").innerHTML = `
  <div><b>${exhibits.length}</b><span>spacecraft</span></div>
  <div><b>${halls.length}</b><span>places</span></div>
  <div><b>1967–2024</b><span>mission years</span></div>
  <div><b>∞</b><span>silent orbits</span></div>`;
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) document.querySelectorAll("#stats b").forEach(b => {   // gentle count-up for plain numbers
  const t = +b.textContent; if (!Number.isFinite(t)) return; let f = 0; b.textContent = "0";
  new IntersectionObserver(([en], o) => { if (!en.isIntersecting) return; o.disconnect(); const go = () => { f++; b.textContent = Math.round(t * Math.min(1, f / 28)); if (f < 28) requestAnimationFrame(go); }; go(); }).observe(b);
});

// background follows the page: hero -> neutral space
setBg("space");

})();
