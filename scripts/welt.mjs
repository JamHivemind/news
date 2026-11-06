// Welt-Monitor: Globus mit Brennpunkten, Chips zum Springen, Lage nach Regionen, Katastrophen-Liste und Quellen-Mix.
// Daten: Meldungen mit "ort" ({name, lat, lon}) und "art" aus content.json, dazu GDACS und USGS aus data/metrics.json.
// Der Globus selbst wird im Browser von assets/theme-welt.js gezeichnet (d3 + Weltkarte von jsDelivr).

import { hBars, fmt } from "./charts.mjs";

// Links aus fremden Feeds (GDACS, USGS) nur mit http(s) übernehmen, sonst kein Link (kein javascript: o. Ä.)
const extUrl = (u = "") => /^https?:\/\//i.test(u) ? u : "";
const esc = (s = "") => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const ARTEN = { konflikt: "Konflikt", katastrophe: "Katastrophe", politik: "Weltpolitik", wirtschaft: "Wirtschaft" };
const RICHTUNG = { links: "links", mitte: "Mitte", rechts: "rechts" };
const dm = iso => { const [, m, d] = iso.slice(0, 10).split("-"); return `${Number(d)}.${Number(m)}.`; };

export function renderWelt(cfg, content, metrics, panel, tile) {
  const all = [...(content?.top || []).slice(0, 3), ...(content?.entries || [])];
  const marks = [];
  all.forEach((e, k) => {
    const o = e.ort;
    if (!o || typeof o.lat !== "number" || typeof o.lon !== "number") return;
    marks.push({ n: o.name || e.title, t: ARTEN[e.art] ? e.art : "politik", lat: o.lat, lon: o.lon,
      title: e.title, hh: e.hamburg || "", href: `#m-${k}` });
  });
  for (const g of metrics.gdacs || [])
    marks.push({ n: `${g.art}: ${g.country || g.name}`, t: "katastrophe", lat: g.lat, lon: g.lon,
      title: `${g.name} (Warnstufe ${g.level === "Red" ? "rot" : "orange"}, bis ${dm(g.to)})`, hh: "", href: extUrl(g.url), ext: 1 });
  for (const q of metrics.quakes || [])
    marks.push({ n: `Erdbeben M${fmt(q.mag, 1)}`, t: "katastrophe", lat: q.lat, lon: q.lon,
      title: `Erdbeben der Stärke ${fmt(q.mag, 1)}, ${q.place} (${dm(q.time)})`, hh: "", href: extUrl(q.url), ext: 1 });
  marks.push({ n: "Hamburg", t: "hamburg", lat: 53.55, lon: 10, title: "Hier laufen die Folgen zusammen: Hafen, Energie, Airbus, Zinsen.", hh: "", href: "" });

  // Brennpunkte: ein Chip je Ort aus den Meldungen, Reihenfolge wie auf der Seite
  const seen = new Set(), chips = [];
  for (const m of marks) if (m.href.startsWith("#") && !seen.has(m.n)) { seen.add(m.n); chips.push(m); }
  const chipHtml = chips.length ? `<div class="chips" aria-label="Brennpunkte">${chips.map(c =>
    `<a class="chip chip-${c.t}" href="${c.href}">${esc(c.n)}</a>`).join("")}</div>` : "";

  const legend = `<div class="globus-legende"><span><i class="l-konflikt"></i>Konflikt</span><span><i class="l-katastrophe"></i>Katastrophe</span>` +
    `<span><i class="l-politik"></i>Weltpolitik</span><span><i class="l-wirtschaft"></i>Wirtschaft</span><span><i class="l-hamburg"></i>Hamburg</span></div>`;
  const data = JSON.stringify(marks).replace(/</g, "\\u003c");
  const fan = `<section class="welt-kopf">
<h2 class="welt-h">Brennpunkte heute</h2>${chipHtml}
<details class="globus" data-globus>
<summary>Weltkarte zeigen <span>${marks.length - 1} Punkte</span></summary>
<div class="globus-inner"><svg viewBox="0 0 400 400" class="globus-svg" role="img" aria-label="Drehbarer Globus mit Brennpunkten"></svg>
<div class="globus-info" data-info><b>Globus ziehen zum Drehen, Punkt antippen für Details.</b></div></div>${legend}
<script type="application/json" data-marks>${data}</script>
</details></section>`;

  // Panels
  let panels = "";
  if (content?.regionen && Object.keys(content.regionen).length) {
    const order = cfg.regionen || Object.keys(content.regionen);
    const rows = order.filter(r => content.regionen[r]).map(r => `<li><b>${esc(r)}</b><span>${esc(content.regionen[r])}</span></li>`).join("");
    panels += panel("Ein Satz pro Weltregion", "Die Lage heute in Kürze", `<ul class="regionen">${rows}</ul>`);
  }
  const kat = [...(metrics.gdacs || []).map(g => ({ k: `${g.level === "Red" ? "🔴" : "🟠"} ${g.art}`, w: g.country || g.name, d: g.to, u: extUrl(g.url) })),
    ...(metrics.quakes || []).map(q => ({ k: `Erdbeben M${fmt(q.mag, 1)}`, w: q.place, d: q.time.slice(0, 10), u: extUrl(q.url) }))]
    .sort((a, b) => b.d.localeCompare(a.d)).slice(0, 8);
  if (kat.length)
    panels += panel("Katastrophen-Lage", "Laufende Warnungen (orange und rot) und starke Erdbeben der letzten 7 Tage",
      `<ol class="ranklist">${kat.map(x => `<li>${x.u ? `<a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.k)}</a>` : esc(x.k)}<span>${esc(x.w)}</span><b>${dm(x.d)}</b></li>`).join("")}</ol>`,
      "Quellen: GDACS (Warnsystem von UN und EU), USGS (US-Erdbebendienst).");

  // Quellen-Mix: Meldungen je Richtung der Quelle
  const dir = Object.fromEntries((cfg.sources || []).filter(s => s.richtung).map(s => [s.name, s.richtung]));
  const count = { links: 0, mitte: 0, rechts: 0 };
  for (const e of all) { const r = dir[e.source]; if (r) count[r]++; for (const s of e.stimmen || []) if (count[s.richtung] !== undefined) count[s.richtung]++; }
  if (count.links + count.mitte + count.rechts)
    panels += panel("Quellen-Mix heute", "Meldungen und weitere Stimmen je Richtung der Quelle",
      hBars(["links", "mitte", "rechts"].map((r, i) => ({ label: RICHTUNG[r], value: count[r] })), { color: "var(--s1)" }),
      "Grobe Einordnung der Medien, damit keine Seite fehlt. Die Zuordnung steht in der config.json und lässt sich ändern.");
  return { fan, panels };
}
