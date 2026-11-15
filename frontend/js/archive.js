(async () => {

initStars();

const data = await loadData();
const { exhibits, halls } = data;

const tabs = document.getElementById("tabs");
const grid = document.getElementById("grid");
const line = document.getElementById("hall-line");
let current = "all";

tabs.innerHTML = [{ id: "all", name: "All" }, ...halls]
  .map(h => `<button data-h="${h.id}" aria-pressed="${h.id === "all"}">${esc(h.name)}</button>`).join("");

function render() {
  const list = current === "all" ? exhibits : exhibits.filter(e => e.hall === current);
  line.textContent = halls.find(h => h.id === current)?.tagline ?? "Pick a place or browse every spacecraft.";
  grid.innerHTML = list.map(e => `
    <a class="card panel" data-hall="${e.hall}" href="exhibit.html?id=${encodeURIComponent(e.id)}">
      <div class="thumb"><img src="img/exhibits/${esc(e.id)}.png" alt="${esc(e.short)}" loading="lazy" onerror="var p=this.parentNode;this.remove();p.classList.add('ph')">${e.placeholder ? '<span class="wipb">3D model in development</span>' : ""}</div>
      <span class="status">${esc(e.status)}</span>
      <h3>${esc(e.short)}</h3>
      <div class="meta"><span>${esc(hallName(data, e.hall))}</span><span>${esc(e.years)}</span></div>
      <p>${esc(e.summary.split(". ")[0].replace(/\.$/, ""))}.</p>
    </a>`).join("");
  window.AX && AX.rescan && AX.rescan();
}
tabs.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  current = b.dataset.h;
  tabs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
  setBg(current === "all" ? "space" : current);
  render();
});
setBg("space");
render();

grid.addEventListener("pointerover", e => { const c = e.target.closest(".card"); if (c) setBg(c.dataset.hall); });
grid.addEventListener("pointerleave", () => setBg(current === "all" ? "space" : current));

})();
