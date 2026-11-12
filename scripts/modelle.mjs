// Baustein "Modelle im Blick" (config.json → modelle): Vergleichstabelle und eine Karte je Modell mit
// Marktdaten aus <dashboard>/data/markt.json (scripts/markt.mjs, wöchentlich), gepflegtem Preisband,
// Preisverlauf, Erwähnungen in der heutigen Ausgabe und Links zu den Börsen.

import { lines, legend, fmt } from "./charts.mjs";

const esc = (s = "") => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeUrl = (u = "") => /^https?:\/\//i.test(u) ? esc(u) : "#";
const eur = v => v == null ? "–" : `${fmt(v)} €`;
const teur = v => v == null ? "–" : v >= 1e6 ? `${fmt(v / 1e6, 1)} Mio. €` : `${fmt(Math.round(v / 1000))} T€`;
const dmy = iso => { const [y, m, d] = iso.split("-"); return d ? `${d}.${m}.${y}` : `${m}/${y}`; };
const TREND = { steigend: ["↗", "steigend", "up"], stabil: ["→", "stabil", "flat"], fallend: ["↘", "fallend", "down"] };

// Waagerechte Spannen-Leiste: Inserate (mittlere Hälfte + Median) und Preisband auf gemeinsamer Skala
function spanne(akt, band) {
  const werte = [akt?.p25, akt?.p75, akt?.median, band?.von, band?.bis].filter(v => v > 0);
  if (!werte.length) return "";
  let lo = Math.min(...werte), hi = Math.max(...werte);
  const pad = (hi - lo || hi * 0.2) * 0.15; lo = Math.max(0, lo - pad); hi += pad;
  const X = v => `${(((v - lo) / (hi - lo)) * 100).toFixed(1)}%`;
  const W = (a, b) => `${(((b - a) / (hi - lo)) * 100).toFixed(1)}%`;
  let h = `<div class="mspan">`;
  if (akt?.p25) h += `<div class="mrow"><span class="ml">Inserate</span><div class="mtrack">` +
    `<div class="mbar ins" style="left:${X(akt.p25)};width:${W(akt.p25, akt.p75)}" data-tip="${esc(`Mittlere Hälfte der Angebote: ${eur(akt.p25)} bis ${eur(akt.p75)}`)}"></div>` +
    `<div class="mdot" style="left:${X(akt.median)}" data-tip="${esc(`Median: ${eur(akt.median)}`)}"></div></div></div>`;
  if (band) h += `<div class="mrow"><span class="ml">Preisband</span><div class="mtrack">` +
    `<div class="mbar band" style="left:${X(band.von)};width:${W(band.von, band.bis)}" data-tip="${esc(`Einordnung ${dmy(band.stand)}: ${eur(band.von)} bis ${eur(band.bis)}`)}"></div></div></div>`;
  h += `<div class="mrow axis"><span class="ml"></span><div class="mtrack"><span style="left:0">${teur(lo)}</span><span style="right:0">${teur(hi)}</span></div></div>`;
  return h + `</div>`;
}

// Händlerangebote aus Hamburg und Umgebung (data/markt.json → modelle.<id>.hamburg), günstigstes zuerst
function hamburg(m, hh) {
  if (!hh) return "";
  const titel = m.lokal?.titel || "In Hamburg angeboten";
  if (!hh.angebote.length) return `<div class="mhh" id="hh-${esc(m.id)}"><b>${esc(titel)}:</b> derzeit kein Händlerangebot gefunden.</div>`;
  const zeige = 5, rows = hh.angebote.slice(0, zeige).map(o =>
    `<li><a href="${safeUrl(o.url)}" target="_blank" rel="noopener"><span class="mhh-t">${esc(o.titel)}${o.jahr ? `, ${esc(o.jahr)}` : ""}</span>` +
    `<span class="mhh-h">${esc(o.haendler)}${o.ort ? ` · ${esc(o.ort)}` : ""}${o.km ? ` · ${fmt(o.km)} km` : ""}</span>` +
    `<b>${eur(o.preis)}</b></a></li>`).join("");
  const mehr = hh.angebote.length > zeige ? `<div class="mhh-more">und ${fmt(hh.angebote.length - zeige)} weitere</div>` : "";
  return `<div class="mhh" id="hh-${esc(m.id)}"><b>${esc(titel)}</b> <span>(${fmt(hh.angebote.length)}, Stand ${dmy(hh.datum)})</span><ul>${rows}</ul>${mehr}</div>`;
}

export function renderModelle(cfg, markt, eintraege) {
  const M = cfg.modelle;
  if (!M?.liste?.length) return "";
  const daten = markt?.modelle || {};
  const reihe = id => daten[id]?.verlauf || [];

  // Erwähnungen in der heutigen Ausgabe
  const treffer = m => !m.news ? [] : eintraege.filter(e => new RegExp(m.news, "i").test(`${e.title} ${e.text || ""} ${e.summary || ""}`));

  // Vergleichstabelle
  let rows = "";
  for (const m of M.liste) {
    const akt = reihe(m.id).at(-1), band = m.preisband?.at(-1), t = TREND[band?.trend];
    rows += `<tr><th scope="row"><a href="#mod-${esc(m.id)}">${esc(m.name)}</a><span>${esc(m.baureihe)} · ${esc(m.bauzeit)}</span></th>` +
      `<td>${akt ? fmt(akt.anzahl) : "–"}</td><td><b>${akt?.median ? teur(akt.median) : "–"}</b></td>` +
      `<td>${akt?.p25 && akt.anzahl > 1 ? `${teur(akt.p25)} – ${teur(akt.p75)}` : "–"}</td>` +
      `<td>${band ? `${teur(band.von)} – ${teur(band.bis)}` : "–"}</td>` +
      `<td>${t ? `<span class="mtrend ${t[2]}" title="${t[1]}">${t[0]} ${t[1]}</span>` : "–"}</td>` +
      `<td>${daten[m.id]?.hamburg ? `<a href="#hh-${esc(m.id)}">${fmt(daten[m.id].hamburg.angebote.length)}</a>` : "–"}</td></tr>`;
  }
  const stand = markt?.abgerufen ? `Inserate ausgewertet am ${dmy(markt.abgerufen)}` : "Erste Auswertung der Inserate folgt";
  const tabelle = `<div class="mtable-wrap"><table class="mtable"><thead><tr><th>Modell</th><th>Angebote</th><th>Median</th>` +
    `<th>Mittlere Hälfte</th><th>Preisband</th><th>Trend</th><th>In Hamburg</th></tr></thead><tbody>${rows}</tbody></table></div>`;

  // Preisentwicklung aller Modelle, Start = 100 (sobald mindestens zwei Wochen vorliegen)
  const serien = M.liste.map((m, i) => {
    const v = reihe(m.id).filter(x => x.median), b = v[0]?.median;
    return { name: m.name.replace(/^(Porsche|Mercedes-AMG|Mercedes) /, "") + ` (${m.baureihe})`, color: `var(--s${i + 1})`,
      points: v.map(x => [x.datum, Math.round((x.median / b) * 1000) / 10]) };
  }).filter(s => s.points.length > 1);
  const verlauf = serien.length
    ? `<div class="mverlauf"><h4>Preisentwicklung</h4><div class="panel-sub">Median der Angebotspreise, erste Woche = 100</div>${legend(serien)}${lines(serien, { base: 100 })}</div>`
    : `<p class="mhint">Die Preisentwicklung erscheint, sobald mindestens zwei wöchentliche Auswertungen vorliegen.</p>`;

  // Karten
  let karten = "";
  for (const m of M.liste) {
    const v = reihe(m.id), akt = v.at(-1), vor = v.length > 1 ? v.at(-2) : null, band = m.preisband?.at(-1), t = TREND[band?.trend];
    const diff = akt?.median && vor?.median ? (akt.median - vor.median) / vor.median * 100 : null;
    const news = treffer(m);
    karten += `<article class="mcard" id="mod-${esc(m.id)}"><div class="mhead"><h4>${esc(m.name)}</h4><span class="mchip">${esc(m.baureihe)}</span></div>` +
      `<div class="mfacts">${esc(m.bauzeit)} · ${esc(m.leistung)}</div><p>${esc(m.info)}</p>` +
      `<div class="mnums"><div><b>${akt ? fmt(akt.anzahl) : "–"}</b><span>Angebote</span></div>` +
      `<div><b>${akt?.median ? teur(akt.median) : "–"}</b><span>Median${diff != null ? ` <em class="${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff), 1)} %</em>` : ""}</span></div>` +
      `<div><b>${akt?.kmMedian ? `${fmt(Math.round(akt.kmMedian / 1000))} Tkm` : "–"}</b><span>typ. Laufleistung</span></div></div>` +
      spanne(akt?.anzahl > 1 ? akt : akt?.median ? { p25: akt.median, p75: akt.median, median: akt.median } : null, band) +
      (band ? `<div class="mband">Preisband ${dmy(band.stand)}${t ? `, Trend ${t[1]} ${t[0]}` : ""}. Grundlage: ${esc(band.quelle)}</div>` : "") +
      hamburg(m, daten[m.id]?.hamburg) +
      (news.length ? `<div class="mnews"><b>Heute in den News:</b> ${news.slice(0, 3).map(e => `<a href="#m-${e._k}">${esc(e.title)}</a>`).join(" · ")}</div>` : "") +
      `<div class="mlinks">${(m.links || []).map(l => `<a href="${safeUrl(l.url)}" target="_blank" rel="noopener">${esc(l.name)} →</a>`).join("")}</div></article>`;
  }

  return `<section class="modelle" id="modelle"><h2>${esc(M.titel || "Modelle im Blick")}</h2>` +
    `<p class="mintro">${esc(M.text || "")} <span class="mstand">${esc(stand)}.</span></p>` +
    tabelle + verlauf + `<div class="mcards">${karten}</div>` +
    (M.hinweis ? `<p class="mhint">${esc(M.hinweis)}</p>` : "") + `</section>`;
}
