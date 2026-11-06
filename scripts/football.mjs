// Fußball-Bausteine für Vereins-Dashboards (config.json → "football"): nächstes Spiel mit Countdown,
// Form, Tabelle, Punkteverlauf, Ergebnisse und Restprogramm. Daten: data/metrics.json → football (OpenLigaDB).

import { lines, legend, fmt } from "./charts.mjs";

const esc = (s = "") => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const berlin = (utc, opts) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", ...opts }).format(new Date(utc));
const when = utc => `${berlin(utc, { weekday: "short", day: "2-digit", month: "2-digit" })} · ${berlin(utc, { hour: "2-digit", minute: "2-digit" })} Uhr`;

// Ergebnis aus Sicht des Vereins: S, U oder N
function result(m, id) {
  const own = m.homeId === id ? m.g1 : m.g2, opp = m.homeId === id ? m.g2 : m.g1;
  return { own, opp, r: own > opp ? "S" : own === opp ? "U" : "N" };
}
const R_TEXT = { S: "Sieg", U: "Remis", N: "Niederlage" };

export function renderFootball(cfg, metrics, panel, tile) {
  const F = metrics.football, f = cfg.football;
  if (!F?.matches?.length) return { fan: "", tiles: "", panels: "" };
  const id = f.teamId, short = f.short || "Wir";
  const played = F.matches.filter(m => m.done && m.g1 !== null);
  const upcoming = F.matches.filter(m => !m.done);
  const next = upcoming[0], last = played.at(-1);
  const posOf = teamId => F.table.find(t => t.id === teamId)?.pos;
  const me = F.table.find(t => t.id === id);
  const opp = m => m.homeId === id ? { name: m.away, short: m.awayShort, id: m.awayId, home: true } : { name: m.home, short: m.homeShort, id: m.homeId, home: false };

  // ---- Bühne: nächstes Spiel mit Countdown, letztes Ergebnis, Form ----
  let fan = `<section class="fan-stage">`;
  if (next) {
    const o = opp(next), op = posOf(o.id);
    fan += `<div class="fan-next" data-kickoff="${esc(next.utc)}" data-league="${esc(f.league)}" data-season="${esc(f.season)}" data-day="${next.day}" data-team="${id}">
      <div class="fan-flag" data-flag>Nächstes Spiel</div>
      <div class="fan-match"><span class="fan-us">${esc(o.home ? short : o.short)}</span><span class="fan-vs">vs</span><span class="fan-them">${esc(o.home ? o.short : short)}</span></div>
      <div class="fan-when">${esc(when(next.utc))} · ${next.day}. Spieltag · ${o.home ? "Heimspiel im Volkspark 🏟️" : `auswärts bei ${esc(o.name)}`}${op ? ` · Gegner auf Platz ${op}` : ""}</div>
      <div class="fan-live" data-live hidden aria-live="polite"></div>
      <div class="fan-count" data-count aria-live="off"><div><b data-d>–</b><span>Tage</span></div><div><b data-h>–</b><span>Std</span></div><div><b data-m>–</b><span>Min</span></div><div><b data-s>–</b><span>Sek</span></div></div>
    </div>`;
  } else {
    fan += `<div class="fan-next"><div class="fan-flag">Sommerpause</div><div class="fan-match"><span class="fan-us">Bald geht's wieder los</span></div></div>`;
  }
  fan += `<div class="fan-side">`;
  if (last) {
    const o = opp(last), x = result(last, id);
    fan += `<div class="fan-last r-${x.r}"><div class="fan-lab">Letztes Spiel · ${R_TEXT[x.r]}</div>
      <div class="fan-score">${esc(last.homeShort)} <b>${last.g1}:${last.g2}</b> ${esc(last.awayShort)}</div>
      <div class="fan-sub">${esc(berlin(last.utc, { weekday: "long", day: "numeric", month: "long" }))}, ${o.home ? "zu Hause" : "auswärts"}</div></div>`;
  }
  const form = played.slice(-5).map(m => { const x = result(m, id), o = opp(m);
    return `<span class="fan-pill r-${x.r}" data-tip="${esc(`${m.day}. Spieltag: ${m.homeShort} ${m.g1}:${m.g2} ${m.awayShort} (${R_TEXT[x.r]})`)}">${x.r}</span>`; }).join("");
  if (form) fan += `<div class="fan-form"><div class="fan-lab">Form, letzte 5</div><div class="fan-pills">${form}</div></div>`;
  fan += `</div></section>`;

  // ---- Kacheln ----
  let tiles = "";
  if (me) {
    tiles += tile("Tabellenplatz", `${me.pos}.`, `${me.pts} Punkte nach ${me.sp} Spielen`);
    tiles += tile("Tore", `${me.g}:${me.o}`, `Differenz ${me.diff > 0 ? "+" : ""}${me.diff}`);
    tiles += tile("Bilanz", `${me.w}-${me.d}-${me.l}`, "Siege, Remis, Niederlagen");
    const above = F.table.find(t => t.pos === 15), below = F.table.find(t => t.pos === 16);
    if (me.pos <= 15 && below) tiles += tile("Vorsprung auf Platz 16", `${me.pts - below.pts}`, `Punkte vor ${below.short || below.team}`);
    else if (above) tiles += tile("Rückstand auf Platz 15", `${above.pts - me.pts}`, `Punkte hinter ${above.short || above.team}`);
  }
  const home = played.filter(m => m.homeId === id).map(m => result(m, id).r);
  if (home.length) tiles += tile("Heimbilanz", `${home.filter(r => r === "S").length}-${home.filter(r => r === "U").length}-${home.filter(r => r === "N").length}`, "im Volkspark");
  if (f.founded) tiles += tile("Tage Vereinsliebe", `<span data-since="${esc(f.founded)}">${fmt(Math.floor((Date.now() - Date.parse(f.founded)) / 864e5))}</span>`, `seit der Gründung am 29.09.1887`);

  // ---- Felder ----
  let panels = "";
  if (F.table?.length) {
    const rows = F.table.map(t => `<tr class="${t.id === id ? "me" : ""} ${t.pos <= 4 ? "z-cl" : t.pos <= 6 ? "z-el" : t.pos === 16 ? "z-rel" : t.pos >= 17 ? "z-down" : ""}">` +
      `<td>${t.pos}</td><td class="t">${esc(t.short || t.team)}</td><td>${t.sp}</td><td>${t.g}:${t.o}</td><td>${t.diff > 0 ? "+" : ""}${t.diff}</td><td><b>${t.pts}</b></td></tr>`).join("");
    panels += panel("Die Tabelle", `Bundesliga ${f.season}/${String(f.season + 1).slice(2)}, Stand nach dem letzten Spiel`,
      `<table class="fan-table"><thead><tr><th>#</th><th class="t">Verein</th><th>Sp</th><th>Tore</th><th>Diff</th><th>Pkt</th></tr></thead><tbody>${rows}</tbody></table>`,
      "Farben: Champions League, Europa League, Relegation, Abstieg.");
  }
  if (played.length > 1) {
    // Ganze Saison auf der Achse (34 Spieltage bei 18 Vereinen), damit man sieht, was noch kommt
    const N = F.table?.length ? 2 * (F.table.length - 1) : F.matches.length, GOAL = f.goal || 40;
    const dd = d => String(d).padStart(2, "0"), days = Array.from({ length: N }, (_, i) => i + 1);
    let sum = 0;
    const pts = played.map(m => { const r = result(m, id).r; sum += r === "S" ? 3 : r === "U" ? 1 : 0; return [dd(m.day), sum]; });
    const pace = days.map(d => [dd(d), Math.round(d * (GOAL / N) * 10) / 10]);
    // Letzte Chance: so viele Punkte braucht man nach Spieltag d mindestens, sonst sind 40 nicht mehr zu schaffen
    const must = days.filter(d => GOAL - 3 * (N - d) >= 0).map(d => [dd(d), GOAL - 3 * (N - d)]);
    const rest = F.matches.length - played.length, max = sum + 3 * rest, need = GOAL - sum;
    let calc;
    if (need <= 0) calc = `<span class="ok">✔ ${GOAL} Punkte geschafft</span>, der Klassenerhalt ist so gut wie sicher.`;
    else if (max < GOAL) calc = `<span class="bad">✘ ${GOAL} Punkte sind rechnerisch nicht mehr möglich</span> (höchstens noch ${max}). Jetzt zählt nur der Abstand zu Platz 16.`;
    else {
      const wins = Math.ceil(need / 3), free = Math.floor(N - need / 3);
      calc = `Noch <b>${need} Punkte</b> bis ${GOAL}, das sind mindestens <b>${wins} Siege</b> aus ${rest} Spielen.<br>` +
        `Selbst ohne weiteren Punkt bleiben die ${GOAL} rechnerisch erreichbar bis zum <b>${free}. Spieltag</b>. Wo die Punkte mindestens stehen müssen, zeigt die rote Linie.`;
    }
    panels += panel("Punkte-Jagd", `Punkte nach jedem Spieltag. Gelb: Kurs auf ${GOAL} Punkte (gilt als sicher). Rot: letzte Chance, darunter sind ${GOAL} nicht mehr drin.`,
      `<div class="fan-calc">${calc}</div>` +
      legend([{ name: short, color: "var(--s1)" }, { name: `${GOAL}-Punkte-Kurs`, color: "var(--s4)" }, { name: "Letzte Chance", color: "var(--loss)" }]) +
      lines([{ name: short, color: "var(--s1)", points: pts },
        { name: `${GOAL}-Punkte-Kurs`, color: "var(--s4)", points: pace, dash: true },
        { name: "Letzte Chance (mind.)", color: "var(--loss)", points: must, dash: true, end: false }],
        { label: d => `${Number(d)}.`, decimals: 0, base: GOAL, min: 0, step: 10 }),
      `Eigene Rechnung: Rote Linie = ${GOAL} minus 3 Punkte je Spiel, das danach noch übrig ist.`);

    // Aus Spaß: Aufholjagd auf Platz 1
    const top = F.table?.[0], prog = F.progress?.[top?.id];
    if (top && me && prog?.length > 1) {
      const lead = prog.map(([d, p]) => [dd(d), p]);
      const gap = top.pts - me.pts, myMax = me.pts + 3 * (N - me.sp), room = myMax - top.pts - 1;
      const perGame = (p, n) => n ? (p / n).toLocaleString("de-DE", { maximumFractionDigits: 2 }) : "0";
      const proj = t => Math.round(t.pts / (t.sp || 1) * N);
      let txt;
      if (top.id === id) txt = `<span class="ok">🏆 Wir sind Tabellenführer!</span> ${me.pts - (F.table[1]?.pts ?? me.pts)} Punkte vor ${esc(F.table[1]?.short || "Platz 2")}.`;
      else if (room < 0) txt = `<span class="bad">Rechnerisch ist ${esc(top.short || top.team)} nicht mehr einzuholen.</span> ${gap} Punkte Rückstand.`;
      else txt = `<b>${gap} Punkte</b> Rückstand auf ${esc(top.short || top.team)}. Rechnerisch noch drin: Wenn wir alle ${N - me.sp} Spiele gewinnen (${myMax} Punkte), ` +
        `darf ${esc(top.short || top.team)} höchstens noch <b>${room} Punkte</b> holen.<br>` +
        `Schnitt pro Spiel: ${esc(short)} ${perGame(me.pts, me.sp)}, ${esc(top.short || top.team)} ${perGame(top.pts, top.sp)}. Hochgerechnet aufs Saisonende: ${proj(me)} zu ${proj(top)} Punkte.`;
      panels += panel("Aufholjagd auf Platz 1", "Nicht ganz ernst gemeint: unser Punkteverlauf gegen den Tabellenführer",
        `<div class="fan-calc">${txt}</div>` +
        legend([{ name: short, color: "var(--s1)" }, { name: top.short || top.team, color: "var(--s2)" }]) +
        lines([{ name: short, color: "var(--s1)", points: pts }, { name: top.short || top.team, color: "var(--s2)", points: lead }],
          { label: d => `${Number(d)}.`, decimals: 0, min: 0 }), "Eigene Rechnung aus allen Ergebnissen der Liga (OpenLigaDB).");
    }
  }
  if (played.length) {
    const li = played.slice().reverse().map(m => { const x = result(m, id), o = opp(m);
      return `<li class="r-${x.r}"><span class="fan-pill r-${x.r}">${x.r}</span><span>${m.day}. · ${esc(m.homeShort)} – ${esc(m.awayShort)}</span><b>${m.g1}:${m.g2}</b></li>`; }).join("");
    panels += panel("Alle Ergebnisse", "Neueste zuerst", `<ul class="fan-list">${li}</ul>`);
  }
  if (upcoming.length) {
    const li = upcoming.slice(0, 6).map(m => { const o = opp(m), p = posOf(o.id);
      return `<li><span class="fan-ha">${o.home ? "H" : "A"}</span><span>${esc(o.name)}${p ? ` <i>(${p}.)</i>` : ""}</span><b>${esc(berlin(m.utc, { day: "2-digit", month: "2-digit" }))}</b></li>`; }).join("");
    panels += panel("Was jetzt kommt", "Die nächsten Gegner, H = Heimspiel, A = Auswärts", `<ul class="fan-list">${li}</ul>`,
      "Quelle Spielplan und Tabelle: OpenLigaDB. Anstoßzeiten können sich ändern.");
  }
  return { fan, tiles, panels };
}
