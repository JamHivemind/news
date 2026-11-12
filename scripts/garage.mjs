// Fan-Bühne für das Auto-Dashboard (config.json → "garage"): Traumwagen der Woche mit Wertometer,
// Countdown zum nächsten Auto-Termin und Hamburg-Radar (Händlerangebote). Daten: data/markt.json (scripts/markt.mjs).

import { fmt } from "./charts.mjs";

const esc = (s = "") => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeUrl = (u = "") => /^https?:\/\//i.test(u) ? esc(u) : "#";
const teur = v => v == null ? "–" : v >= 1e6 ? `${fmt(v / 1e6, 1)} Mio. €` : `${fmt(Math.round(v / 1000))} T€`;
const eur = v => v == null ? "–" : `${fmt(v)} €`;
const dmy = iso => iso.split("-").reverse().join(".");

// ISO-Kalenderwoche: der Traumwagen wechselt jeden Montag
function isoWeek(iso) {
  const d = new Date(`${iso}T12:00:00Z`), day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
}

// Wertometer: Drehzahlmesser, dessen Nadel zeigt, wo der Angebots-Median im Preisband liegt.
// Skala: 25 % unter bis 25 % über dem Band. Rot = über dem Band („Drehzahlbereich“).
function wertometer(median, band) {
  if (!median || !band) return "";
  const span = band.bis - band.von, lo = band.von - span * 0.25, hi = band.bis + span * 0.25;
  const q = Math.min(1, Math.max(0, (median - lo) / (hi - lo)));
  const A0 = -120, A1 = 120, ang = A0 + q * (A1 - A0);
  const pt = (a, r) => { const t = (a - 90) * Math.PI / 180; return [(100 + r * Math.cos(t)).toFixed(1), (100 + r * Math.sin(t)).toFixed(1)]; };
  const arc = (a, b, r) => { const [x1, y1] = pt(a, r), [x2, y2] = pt(b, r); return `M${x1} ${y1}A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  const aBand0 = A0 + 0.2 * (A1 - A0), aBand1 = A0 + 0.8 * (A1 - A0);
  let ticks = "";
  for (let i = 0; i <= 10; i++) {
    const a = A0 + i * (A1 - A0) / 10, [x1, y1] = pt(a, 78), [x2, y2] = pt(a, i % 5 ? 70 : 64);
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="g-tick${i % 5 ? "" : " big"}"/>`;
  }
  const lage = median < band.von ? ["unter dem Band", "low"] : median > band.bis ? ["über dem Band", "high"] : ["im Band", "mid"];
  const [lx, ly] = pt(A0, 92), [rx, ry] = pt(A1, 92);
  return `<figure class="g-meter" data-tip="${esc(`Angebots-Median ${eur(median)} · Preisband ${eur(band.von)} bis ${eur(band.bis)}`)}">
    <svg viewBox="0 0 200 170" role="img" aria-label="${esc(`Wertometer: Median ${teur(median)}, ${lage[0]}`)}">
      <path d="${arc(A0, A1, 82)}" class="g-arc"/>
      <path d="${arc(aBand0, aBand1, 82)}" class="g-arc band"/>
      <path d="${arc(aBand1, A1, 82)}" class="g-arc red"/>
      ${ticks}
      <text x="${lx}" y="${+ly + 14}" class="g-scale" text-anchor="middle">${teur(lo)}</text>
      <text x="${rx}" y="${+ry + 14}" class="g-scale" text-anchor="middle">${teur(hi)}</text>
      <g class="g-needle" style="--a:${ang.toFixed(1)}deg"><line x1="100" y1="112" x2="100" y2="34"/></g>
      <circle cx="100" cy="100" r="9" class="g-hub"/>
      <text x="100" y="140" class="g-val" text-anchor="middle">${teur(median)}</text>
      <text x="100" y="156" class="g-unit" text-anchor="middle">Median · ${lage[0]}</text>
    </svg></figure>`;
}

export function renderGarage(cfg, markt, date) {
  const G = cfg.garage || {}, liste = cfg.modelle?.liste || [];
  const daten = markt?.modelle || {};
  if (!liste.length) return "";

  // ---- Traumwagen der Woche ----
  const kw = isoWeek(date), m = liste[kw % liste.length];
  const akt = daten[m.id]?.verlauf?.at(-1), band = m.preisband?.at(-1), hh = daten[m.id]?.hamburg?.angebote || [];
  let fan = `<section class="g-stage"><div class="g-hero">
    <div class="g-flag">Traumwagen der Woche · KW ${kw}</div>
    <div class="g-name"><span class="g-make">${esc(m.name)}</span><span class="g-series">${esc(m.baureihe)}</span></div>
    <div class="g-facts"><span>${esc(m.bauzeit)}</span><span>${esc(m.leistung)}</span>${akt ? `<span>${fmt(akt.anzahl)} im Angebot</span>` : ""}${hh.length ? `<span>${fmt(hh.length)} in Hamburg</span>` : ""}</div>
    <p class="g-info">${esc(m.info)}</p>
    <div class="g-hero-row">${wertometer(akt?.median, band)}
      <div class="g-hero-side">${hh[0] ? `<a class="g-deal" href="${safeUrl(hh[0].url)}" target="_blank" rel="noopener"><span class="fan-lab">Günstigster in Hamburg</span><b>${eur(hh[0].preis)}</b><span>${esc(hh[0].titel)}${hh[0].jahr ? `, ${esc(hh[0].jahr)}` : ""}${hh[0].km ? ` · ${fmt(hh[0].km)} km` : ""}</span><span>${esc(hh[0].haendler)}</span></a>` : ""}
        <a class="g-more" href="#mod-${esc(m.id)}">Zur Modellkarte →</a></div></div>
  </div><div class="g-side">`;

  // ---- Nächster Termin mit Countdown ----
  const heute = date, next = (G.termine || []).filter(t => (t.bis || t.von) >= heute).sort((a, b) => a.von.localeCompare(b.von))[0];
  if (next) {
    const laeuft = next.von <= heute;
    fan += `<div class="g-event" data-start="${esc(next.von)}T${esc(next.uhr || "09:00")}:00" data-end="${esc(next.bis || next.von)}T18:00:00">
      <div class="fan-lab">Nächster Termin</div>
      <div class="g-ev-name">${esc(next.name)}</div>
      <div class="fan-sub">${esc(next.ort)} · ${dmy(next.von)}${next.bis && next.bis !== next.von ? `–${dmy(next.bis)}` : ""}${next.sicher === false ? " · Termin noch nicht offiziell" : ""}</div>
      <div class="g-count" data-count${laeuft ? " hidden" : ""}><div><b data-d>–</b><span>Tage</span></div><div><b data-h>–</b><span>Std</span></div><div><b data-m>–</b><span>Min</span></div></div>
      <div class="g-live" data-live${laeuft ? "" : " hidden"}>Läuft gerade – nichts wie hin!</div>
      ${next.url ? `<a class="g-ev-link" href="${safeUrl(next.url)}" target="_blank" rel="noopener">Zum Veranstalter →</a>` : ""}
    </div>`;
  }

  // ---- Hamburg-Radar: Händlerangebote je Modell ----
  const radar = liste.map(x => ({ m: x, n: daten[x.id]?.hamburg?.angebote?.length || 0 })).filter(x => daten[x.m.id]?.hamburg);
  if (radar.length) {
    const max = Math.max(1, ...radar.map(x => x.n)), total = radar.reduce((s, x) => s + x.n, 0);
    fan += `<div class="g-radar"><div class="fan-lab">Hamburg-Radar · ${fmt(total)} Händlerangebote</div><ul>` +
      radar.map(x => `<li><a href="#hh-${esc(x.m.id)}">${esc(x.m.name.replace(/^(Porsche|Mercedes-AMG|Mercedes) /, ""))} <i>${esc(x.m.baureihe)}</i></a>` +
        `<span class="g-bar"><span style="width:${(x.n / max * 100).toFixed(0)}%"></span></span><b>${fmt(x.n)}</b></li>`).join("") +
      `</ul><div class="fan-sub">Hamburg und Umgebung, nur Händler. Stand ${markt?.abgerufen ? dmy(markt.abgerufen) : "–"}.</div></div>`;
  }
  return fan + `</div></section>`;
}
