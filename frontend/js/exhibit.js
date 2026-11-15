(async () => {

initStars();
const id = new URLSearchParams(location.search).get("id");
const data = await loadData();
const i = data.exhibits.findIndex(e => e.id === id);
const root = document.getElementById("root");

if (i < 0) {
  root.innerHTML = `<div class="panel"><h1>Exhibit not found</h1><p style="margin:1rem 0">This spacecraft is not in the archive.</p><a class="btn" href="index.html#archive">Back to the archive</a></div>`;
} else {
  const e = data.exhibits[i];
  const qs = new URLSearchParams(location.search);
  const fromXp = qs.get("from") === "explore" ? (qs.get("planet") || "") : "";
  const prev = data.exhibits[(i - 1 + data.exhibits.length) % data.exhibits.length];
  const next = data.exhibits[(i + 1) % data.exhibits.length];
  document.title = `${e.short} · ASTRONEX`;
  document.body.dataset.hall = e.hall;
  setBg(e.hall);
  root.innerHTML = `
    ${fromXp ? `<a class="btn back-xp" href="index.html?explore=${encodeURIComponent(fromXp)}&site=${encodeURIComponent(e.id)}">← Back to Explore</a>` : ""}
    <div class="crumbs"><a href="index.html">Archive</a> / <a href="index.html#archive">${esc(hallName(data, e.hall))}</a> / ${esc(e.short)}</div>
    <div class="exhibit">
      <div class="exh-left">
        <div class="stage tall" id="stage"></div>
        <p class="fact"><b class="mono" style="font-size:.7rem;letter-spacing:.14em;color:var(--accent)">FACT</b><br>${esc(e.fact)}</p>
      </div>
      <div class="panel">
        <span class="eyebrow">${esc(hallName(data, e.hall))}</span>
        <h1>${esc(e.name)}</h1>
        ${(e.story || [e.summary]).map(t => `<p style="color:var(--muted)">${esc(t)}</p>`).join("")}
        ${galleryHTML(e)}
        <dl class="telemetry">
          <div><dt>Status</dt><dd class="st">${esc(e.status)}</dd></div>
          <div><dt>Last contact</dt><dd>${esc(e.last_contact)}</dd></div>
          <div><dt>Mission years</dt><dd>${esc(e.years)}</dd></div>
          <div><dt>Location</dt><dd>${esc(e.location)}</dd></div>
          <div><dt>Agency</dt><dd>${esc(e.agency)}</dd></div>
          <div><dt>Creators</dt><dd>${esc(e.creators)}</dd></div>
        </dl>
      </div>
    </div>
    ${detailsHTML(e)}
    <div class="pager">
      <a class="btn ghost" href="exhibit.html?id=${encodeURIComponent(prev.id)}">← ${esc(prev.short)}</a>
      <a class="btn ghost" href="exhibit.html?id=${encodeURIComponent(next.id)}">${esc(next.short)} →</a>
    </div>`;
  mountViewer(document.getElementById("stage"), e);
  initGallery(root.querySelector(".gal"));
  window.AX && AX.rescan && AX.rescan();
}

// 2 images per exhibit: arrows, dots, swipe, arrow keys. A missing file shows a labelled placeholder instead of a broken image.
function galleryHTML(e) {
  const im = (e.images || []).slice(0, 2); if (!im.length) return "";
  return `<div class="gal" tabindex="0" aria-label="Images of ${esc(e.short)}">
    <div class="gal-track">${im.map(g => `<figure><img src="${esc(g.src)}" alt="${esc(g.alt)}" loading="lazy" draggable="false">
      <figcaption>${esc(g.alt)} · <small>${esc(g.credit)} · <a href="${esc(g.page)}" target="_blank" rel="noopener">find on NASA</a></small></figcaption></figure>`).join("")}</div>
    <button type="button" class="gal-nav prev" aria-label="Previous image">‹</button><button type="button" class="gal-nav next" aria-label="Next image">›</button>
    <div class="gal-dots">${im.map((_, k) => `<i data-k="${k}"></i>`).join("")}</div></div>`;
}
function initGallery(g) {
  if (!g) return;
  const tr = g.querySelector(".gal-track"), n = tr.children.length, dots = [...g.querySelectorAll(".gal-dots i")]; let k = 0, x0 = null;
  g.querySelectorAll("img").forEach(img => img.addEventListener("error", () => {
    img.replaceWith(Object.assign(document.createElement("div"), { className: "slot", style: "aspect-ratio:16/10;display:grid;place-items:center;text-align:center", innerHTML: "<div><div class='glyph'>◇</div><b>IMAGE COMING SOON</b><br><small>" + img.getAttribute("src") + "</small></div>" }));
  }));
  const go = i => { k = (i + n) % n; tr.style.transform = `translateX(${-k * 100}%)`; dots.forEach((d, j) => d.classList.toggle("on", j === k)); };
  g.querySelector(".prev").onclick = () => go(k - 1); g.querySelector(".next").onclick = () => go(k + 1);
  dots.forEach(d => d.onclick = () => go(+d.dataset.k));
  g.addEventListener("keydown", ev => { if (ev.key === "ArrowLeft") go(k - 1); if (ev.key === "ArrowRight") go(k + 1); });
  g.addEventListener("pointerdown", ev => (x0 = ev.clientX));
  g.addEventListener("pointerup", ev => { if (x0 !== null && Math.abs(ev.clientX - x0) > 40) go(k + (ev.clientX < x0 ? 1 : -1)); x0 = null; });
  if (n < 2) g.querySelectorAll(".gal-nav,.gal-dots").forEach(el => el.remove());
  go(0);
}

// "Study in detail" blocks: e.details = [{title, text[], list[], after}]
function detailsHTML(e) {
  if (!e.details || !e.details.length) return "";
  return `<section class="details"><span class="eyebrow">Study in detail</span>` + e.details.map(d => `
    <article class="dsec"><h2>${esc(d.title)}</h2>
      ${(d.text || []).map(t => `<p>${esc(t)}</p>`).join("")}
      ${d.list ? `<ul>${d.list.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      ${d.after ? `<p>${esc(d.after)}</p>` : ""}
    </article>`).join("") + `</section>`;
}

})();
