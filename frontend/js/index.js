(async () => {

initStars();

const data = await loadData();
const { exhibits, halls } = data;

// hero slot = featured exhibit
mountViewer(document.getElementById("hero-stage"), exhibits.find(e => e.id === "apollo-lm") ?? exhibits[0], { controls: false });

// stats
document.getElementById("stats").innerHTML = `
  <div><b>${exhibits.length}</b><span>spacecraft</span></div>
  <div><b>${halls.length}</b><span>halls</span></div>
  <div><b>1967–2024</b><span>mission years</span></div>
  <div><b>∞</b><span>silent orbits</span></div>`;
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) document.querySelectorAll("#stats b").forEach(b => {   // gentle count-up for plain numbers
  const t = +b.textContent; if (!Number.isFinite(t)) return; let f = 0; b.textContent = "0";
  new IntersectionObserver(([en], o) => { if (!en.isIntersecting) return; o.disconnect(); const go = () => { f++; b.textContent = Math.round(t * Math.min(1, f / 28)); if (f < 28) requestAnimationFrame(go); }; go(); }).observe(b);
});

// halls
const tabs = document.getElementById("tabs");
const grid = document.getElementById("grid");
const line = document.getElementById("hall-line");
let current = "all";

tabs.innerHTML = [{ id: "all", name: "All halls" }, ...halls]
  .map(h => `<button data-h="${h.id}" aria-pressed="${h.id === "all"}">${esc(h.name)}</button>`).join("");

function render() {
  const list = current === "all" ? exhibits : exhibits.filter(e => e.hall === current);
  line.textContent = halls.find(h => h.id === current)?.tagline ?? "Pick a hall or browse the whole archive.";
  grid.innerHTML = list.map(e => `
    <a class="card panel" data-hall="${e.hall}" href="exhibit.html?id=${encodeURIComponent(e.id)}">
      <div class="thumb"><img src="img/exhibits/${esc(e.id)}.png" alt="${esc(e.short)}" loading="lazy" onerror="var p=this.parentNode;this.remove();p.classList.add('ph')">${e.placeholder ? '<span class="wipb">3D model in development</span>' : ""}</div>
      <span class="status">${esc(e.status)}</span>
      <h3>${esc(e.short)}</h3>
      <div class="meta"><span>${esc(hallName(data, e.hall))}</span><span>${esc(e.years)}</span></div>
      <p>${esc(e.summary.split(". ")[0].replace(/\.$/, ""))}.</p>
    </a>`).join("");
}
tabs.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  current = b.dataset.h;
  tabs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
  setBg(current === "all" ? "space" : current);
  render();
});
render();

// hovering a card previews its hall in the background
grid.addEventListener("pointerover", e => {
  const c = e.target.closest(".card"); if (c) setBg(c.dataset.hall);
});
grid.addEventListener("pointerleave", () => setBg(current === "all" ? "space" : current));

// scrolling: hero -> neutral space, archive -> current hall
const mark = (id, fn) => new IntersectionObserver(es => es.forEach(x => x.isIntersecting && fn()), { rootMargin: "-45% 0px -45% 0px" }).observe(document.getElementById(id) || document.querySelector("." + id));
mark("hero", () => setBg("space"));
mark("archive", () => setBg(current === "all" ? "space" : current));

})();
