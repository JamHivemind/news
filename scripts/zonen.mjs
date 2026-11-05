// Steuer-Bausteine (config.json → "zonen"): Karte der Bundesländer mit umschaltbaren Ebenen
// (Grunderwerbsteuer, Grundsteuer-Modell, Gewerbesteuer-Oasen, Freizonen, Sonderzonen-Vorschläge),
// Verfahrens-Tracker, Termine und Vergleiche. Daten: <dashboard>/data/zonen.json (gepflegt, mit Quelle und Stand)
// und <dashboard>/data/laender.json (vereinfachte Ländergrenzen, schon projiziert).

import { hBars, fmt } from "./charts.mjs";

const esc = (s = "") => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeUrl = (u = "") => /^https?:\/\//i.test(u) ? esc(u) : "#";
const src = (name, url) => url ? `<a href="${safeUrl(url)}" target="_blank" rel="noopener">${esc(name || "Quelle")}</a>` : esc(name || "");
const dmy = iso => { const [y, m, d] = iso.split("-"); return d ? `${d}.${m}.${y}` : iso; };
const pct = v => `${fmt(v, 1)} %`;
const daysUntil = (iso, today) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5);
const inDays = n => n === 0 ? "heute" : n === 1 ? "morgen" : n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;

// Grunderwerbsteuer 3,5 … 6,5 % → Anteil der Akzentfarbe
const shade = (v, lo, hi) => `color-mix(in srgb, var(--z-seq) ${Math.round(18 + (v - lo) / (hi - lo || 1) * 82)}%, var(--surface2))`;

function map(Z, G) {
  const P = G.proj, at = (lat, lon) => [(lon - P.lon0) * P.k * P.scale, (P.lat1 - lat) * P.scale];
  const ge = Z.grunderwerbsteuer, gs = Z.grundsteuer, vals = Object.values(ge.saetze);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  let svg = `<svg class="zmap" viewBox="-6 -6 ${G.width + 12} ${G.height + 12}" role="img" aria-label="Karte der Bundesländer">`;
  for (const l of G.laender) {
    const v = ge.saetze[l.code], [mod, note] = gs.laender[l.code] || ["", ""];
    const m = gs.modelle[mod] || {};
    svg += `<path d="${l.d}" class="land" style="--f1:${v != null ? shade(v, lo, hi) : "var(--surface2)"};--f2:${m.farbe || "var(--surface2)"}"` +
      ` data-tip="${esc(`${l.name}: Grunderwerbsteuer ${v != null ? pct(v) : "?"}`)}"` +
      ` data-tip-grest="${esc(`${l.name}: Grunderwerbsteuer ${v != null ? pct(v) : "?"}`)}"` +
      ` data-tip-grst="${esc(`${l.name}: ${m.label || "?"}. ${note}`)}"/>`;
  }
  // Beschriftung Grunderwerbsteuer in der Landesmitte (grob: Mitte der Pfadpunkte)
  for (const l of G.laender) {
    const nums = l.d.match(/-?\d+\.?\d*/g).map(Number), xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2);
    let x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
    if (l.code === "BB") { x += 18; y += 22; }            // Berlin liegt in der Mitte
    if (l.code === "SH") { x += 10; y += 12; }
    if (l.code === "NI") { x += 20; y += 20; }            // Bremen liegt in der Mitte
    const small = ["BE", "HB", "HH", "SL"].includes(l.code);
    const v = ge.saetze[l.code];
    if (v == null) continue;
    svg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="zlab l-grest${small ? " small" : ""}" text-anchor="middle" dominant-baseline="central">${fmt(v, 1)}</text>`;
    svg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="zlab l-grst${small ? " small" : ""}" text-anchor="middle" dominant-baseline="central">${esc(l.code)}</text>`;
  }
  // Punkte
  for (const o of Z.gewerbesteuer.oasen.filter(o => !o.vergleich)) {   // Vergleichswerte nur im Balkendiagramm
    const [x, y] = at(o.lat, o.lon), r = o.vergleich ? 5 : 7;
    svg += `<g class="pt pt-oase${o.vergleich ? " pt-vgl" : ""}" data-tip="${esc(`${o.name}: Gewerbesteuer-Hebesatz ${o.hebesatz} % (${o.jahr}). Quelle: ${o.quelle}`)}">` +
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${o.vergleich ? r + 1 : r + 6}" class="hitpt"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/></g>`;
  }
  for (const z of Z.zonen) {
    const [x, y] = at(z.lat, z.lon), s = 7;
    const shape = z.art === "freizone"
      ? `<rect x="${(x - s).toFixed(1)}" y="${(y - s).toFixed(1)}" width="${2 * s}" height="${2 * s}" rx="2"/>`
      : `<path d="M${x.toFixed(1)},${(y - s - 2).toFixed(1)}L${(x + s + 2).toFixed(1)},${y.toFixed(1)}L${x.toFixed(1)},${(y + s + 2).toFixed(1)}L${(x - s - 2).toFixed(1)},${y.toFixed(1)}Z"/>`;
    svg += `<g class="pt pt-${z.art}${z.status === "endet" ? " pt-endet" : ""}" data-tip="${esc(`${z.name} (${z.status}): ${z.text}`)}">` +
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" class="hitpt"/>${shape}</g>`;
  }
  svg += `</svg>`;

  const legGrest = `<div class="zleg l-grest"><span>${pct(lo)}</span><i class="zramp"></i><span>${pct(hi)}</span></div>`;
  const used = new Set(Object.values(gs.laender).map(([m]) => m));
  const legGrst = `<div class="zleg l-grst">${Object.entries(gs.modelle).filter(([k]) => used.has(k))
    .map(([, m]) => `<span><i style="background:${m.farbe}"></i>${esc(m.label)}</span>`).join("")}</div>`;

  const side = `<div class="zside">
    <div class="zinfo l-grest"><b>Grunderwerbsteuer</b><p>Zahlt der Käufer beim Immobilienkauf, jedes Land legt den Satz selbst fest.</p>
      <ul>${ge.letzteAenderungen.map(a => `<li>${esc(a.text)}</li>`).join("")}</ul></div>
    <div class="zinfo l-grst"><b>Grundsteuer-Modell</b><p>Seit 2025 rechnet jedes Land nach seinem Modell. Wie viel man zahlt, entscheidet am Ende der Hebesatz der Gemeinde.</p></div>
    <div class="zpoints">
      <label><input type="checkbox" data-pt="oase" checked><i class="sym sym-oase"></i>Gewerbesteuer-Oasen</label>
      <label><input type="checkbox" data-pt="freizone" checked><i class="sym sym-freizone"></i>Freizonen (Zoll)</label>
      <label><input type="checkbox" data-pt="vorschlag" checked><i class="sym sym-vorschlag"></i>Sonderzonen-Vorschläge</label>
    </div>
    <ul class="zlist">${Z.zonen.map(z => `<li><b>${esc(z.name)}</b> <span class="zst zst-${esc(z.art)}">${esc(z.status)}</span><br>${esc(z.text)} <span class="zsrc">${src(z.quelle, z.quelleUrl)}</span></li>`).join("")}</ul>
  </div>`;

  return `<section class="zstage" data-layer="grest">
    <div class="zhead"><h3>Steuer-Landkarte</h3>
      <div class="zseg" role="tablist"><button type="button" data-layer="grest" aria-selected="true">Grunderwerbsteuer</button><button type="button" data-layer="grst" aria-selected="false">Grundsteuer-Modell</button></div></div>
    <div class="zgrid"><div class="zmapbox">${svg}${legGrest}${legGrst}</div>${side}</div>
    <div class="panel-foot">Stand ${dmy(Z.stand)}. Grunderwerbsteuer: ${src(ge.quelle, ge.quelleUrl)}. Grundsteuer: ${src(gs.quelle, gs.quelleUrl)}.
      Zum Antippen: Länder und Punkte zeigen Details. Angaben ohne Gewähr, keine Steuerberatung.</div>
  </section>
  <script>(function(){var s=document.currentScript.previousElementSibling;if(!s)return;
  s.querySelectorAll(".zseg button").forEach(function(b){b.addEventListener("click",function(){var l=b.getAttribute("data-layer");s.setAttribute("data-layer",l);
  s.querySelectorAll(".zseg button").forEach(function(x){x.setAttribute("aria-selected",x===b?"true":"false")});
  s.querySelectorAll("path.land").forEach(function(p){p.setAttribute("data-tip",p.getAttribute("data-tip-"+l))});});});
  s.querySelectorAll("input[data-pt]").forEach(function(c){c.addEventListener("change",function(){s.classList.toggle("hide-"+c.getAttribute("data-pt"),!c.checked)});});
  })();</script>`;
}

const STATUS_CLASS = { "verhandelt": "warn", "termin": "warn", "im Bundestag": "warn", "beschlossen": "ok", "wartet": "idle" };

export function renderZonen(cfg, Z, G, today, panel, tile) {
  if (!Z || !G) return { fan: "", tiles: "", panels: "" };
  const ge = Z.grunderwerbsteuer, vals = Object.entries(ge.saetze);
  const lo = Math.min(...vals.map(([, v]) => v)), hi = Math.max(...vals.map(([, v]) => v));
  const heim = cfg.zonen?.heimatLand || "HH";
  const upcoming = Z.tracker.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.datum) && daysUntil(t.datum, today) >= 0)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const next = upcoming[0];

  let tiles = tile(`Grunderwerbsteuer ${heim}`, pct(ge.saetze[heim]), `Spanne ${pct(lo)} bis ${pct(hi)}`);
  const gw = Z.gewerbesteuer;
  tiles += tile("Ø Gewerbesteuer-Hebesatz", `${gw.durchschnitt.wert} %`, `${gw.durchschnitt.quelle} ${gw.durchschnitt.jahr}, Minimum ${gw.minimum.wert} %`);
  if (next) tiles += tile("Nächster Termin", inDays(daysUntil(next.datum, today)), `${dmy(next.datum)}: ${next.titel.split(":")[0]}`);
  tiles += tile("Erbschaftsteuer-Urteil", "2027?", "BVerfG hat im Oktober verhandelt");

  // Tracker
  const tr = `<ul class="ztrack">${Z.tracker.map(t => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(t.datum) ? daysUntil(t.datum, today) : null;
    const when = d === null ? esc(t.datum || "offen") : `${dmy(t.datum)} · ${inDays(d)}`;
    return `<li><div class="zt-top"><span class="ztag">${esc(t.thema)}</span><span class="zst zst-${STATUS_CLASS[t.status] || "idle"}">${esc(t.status)}</span></div>` +
      `<b><a href="${safeUrl(t.quelleUrl)}" target="_blank" rel="noopener">${esc(t.titel)}</a></b><p>${esc(t.stand)}</p>` +
      `<div class="zt-next">Als Nächstes: ${esc(t.naechstes)} · <span>${when}</span></div></li>`;
  }).join("")}</ul>`;

  // Termine als Zeitstrahl
  const tl = upcoming.length ? `<ol class="ztime">${upcoming.map(t =>
    `<li><span class="zd">${dmy(t.datum)}</span><span class="zx">${esc(t.naechstes)}: ${esc(t.titel)}</span><span class="zin">${inDays(daysUntil(t.datum, today))}</span></li>`).join("")}</ol>`
    : `<div class="chart-empty">Keine festen Termine eingetragen.</div>`;

  let panels = "";
  panels += panel("Verfahren im Blick", "Erbschaftsteuer, Grundsteuer, Gesetzgebung und Zonen: Stand und nächster Schritt", tr);
  panels += panel("Was sich ändert", "Feste Termine, nächster zuerst", tl, "Termine aus Gerichtsplänen und Gesetzgebungsverfahren, können sich verschieben.");
  panels += panel("Grunderwerbsteuer im Vergleich", "Satz je Bundesland, höchster zuerst",
    hBars(vals.sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ label: G.laender.find(l => l.code === c)?.name || c, value: v,
      tip: `${G.laender.find(l => l.code === c)?.name}: ${pct(v)} vom Kaufpreis` })), { unit: " %", color: "var(--z-seq)", decimals: 1 }),
    `Beispiel: 500.000 € Kaufpreis kosten in Bayern ${fmt(500000 * lo / 100)} €, in NRW ${fmt(500000 * hi / 100)} € Grunderwerbsteuer.`);
  panels += panel("Gewerbesteuer-Oasen", `Niedrigste Hebesätze, gesetzliches Minimum ${gw.minimum.wert} %, Bundesschnitt ${gw.durchschnitt.wert} %`,
    hBars([...gw.oasen].sort((a, b) => a.hebesatz - b.hebesatz).map(o => ({ label: o.name.replace(" (zum Vergleich)", " ⇢ Vgl."), value: o.hebesatz,
      tip: `${o.name}: ${o.hebesatz} % (${o.jahr}), ${o.quelle}` })), { unit: " %", color: "var(--s3)", max: Math.max(gw.durchschnitt.wert, ...gw.oasen.map(o => o.hebesatz)) }),
    "Je niedriger der Hebesatz, desto weniger Gewerbesteuer zahlt ein Betrieb am Ort. Stand je Gemeinde siehe Tooltip.");

  return { fan: map(Z, G), tiles, panels };
}
