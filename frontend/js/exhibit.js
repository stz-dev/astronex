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
  const prev = data.exhibits[(i - 1 + data.exhibits.length) % data.exhibits.length];
  const next = data.exhibits[(i + 1) % data.exhibits.length];
  document.title = `${e.short} · ASTRONEX`;
  document.body.dataset.hall = e.hall;
  setBg(e.hall);
  root.innerHTML = `
    <div class="crumbs"><a href="index.html">Archive</a> / <a href="index.html#archive">${esc(hallName(data, e.hall))}</a> / ${esc(e.short)}</div>
    <div class="exhibit">
      <div><div class="stage tall" id="stage"></div></div>
      <div class="panel">
        <span class="eyebrow">${esc(hallName(data, e.hall))}</span>
        <h1>${esc(e.name)}</h1>
        ${(e.story || [e.summary]).map(t => `<p style="color:var(--muted)">${esc(t)}</p>`).join("")}
        <dl class="telemetry">
          <div><dt>Status</dt><dd class="st">${esc(e.status)}</dd></div>
          <div><dt>Last contact</dt><dd>${esc(e.last_contact)}</dd></div>
          <div><dt>Mission years</dt><dd>${esc(e.years)}</dd></div>
          <div><dt>Location</dt><dd>${esc(e.location)}</dd></div>
          <div><dt>Agency</dt><dd>${esc(e.agency)}</dd></div>
          <div><dt>Creators</dt><dd>${esc(e.creators)}</dd></div>
        </dl>
        <p class="fact"><b class="mono" style="font-size:.7rem;letter-spacing:.14em;color:var(--accent)">FACT</b><br>${esc(e.fact)}</p>
      </div>
    </div>
    ${detailsHTML(e)}
    <div class="pager">
      <a class="btn ghost" href="exhibit.html?id=${encodeURIComponent(prev.id)}">← ${esc(prev.short)}</a>
      <a class="btn ghost" href="exhibit.html?id=${encodeURIComponent(next.id)}">${esc(next.short)} →</a>
    </div>`;
  mountViewer(document.getElementById("stage"), e);
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
