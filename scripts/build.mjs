#!/usr/bin/env node
// Baut alle News-Dashboards dieses Repos und die Startseite.
// Jedes Dashboard ist ein Ordner mit config.json (Titel, Rubriken, Quellen, Kennzahlen) und content.json
// (die Tagesausgabe der Routine). Ohne Abhängigkeiten.
//   node scripts/build.mjs            → alle Dashboards + Startseite
//   node scripts/build.mjs immobilien → nur dieses Dashboard (+ Startseite)

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hBars, columns, lines, legend, fmt } from "./charts.mjs";
import { renderFootball } from "./football.mjs";
import { renderZonen } from "./zonen.mjs";
import { renderWelt } from "./welt.mjs";
import { renderModelle } from "./modelle.mjs";
import { renderGarage } from "./garage.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = (file, fallback) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return fallback; } };
const saveJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + "\n");

const esc = (s = "") => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeUrl = (u = "") => /^https?:\/\//i.test(u) ? esc(u) : "#";
const fill = (t, vars) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? (k === "ICON" ? "📰" : ""));

const longDate = iso => new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${iso}T12:00:00Z`));
const shortDate = iso => new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${iso}T12:00:00Z`));
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const monthLabel = ym => { const [y, m] = ym.split("-"); return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`; };
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

// Feedback: Link zum Google-Formular aus site.json. Leer → kein Kasten. "DASHBOARD" im Link wird durch den Seitennamen ersetzt
// (vorausgefüllter Link aus Google Forms, damit man sieht, von welchem Dashboard das Feedback kommt).
const SITE = loadJson(join(ROOT, "site.json"), {});
const feedbackUrl = title => SITE.feedback ? SITE.feedback.replace("DASHBOARD", encodeURIComponent(title)) : "";
const feedbackHtml = title => !feedbackUrl(title) ? "" :
  `<section class="feedback" id="feedback"><p><b>Was würdest du verbessern?</b>Fehlt ein Thema, eine Quelle oder stört etwas? Sag es mir, dauert eine Minute.</p>` +
  `<a class="btn" href="${esc(feedbackUrl(title))}" target="_blank" rel="noopener">Feedback geben →</a></section>`;
const feedbackNav = () => SITE.feedback ? `<a href="#feedback">Feedback</a>` : "";

// ---------- Bausteine ----------

// Richtung der Quellen (config.json → sources[].richtung: links | mitte | rechts), je Dashboard gesetzt
let RICHTUNG = {};
const RL = { links: "links", mitte: "Mitte", rechts: "rechts" };
const richtungTag = r => RL[r] ? `<span class="ri ri-${r}" title="Richtung der Quelle">${RL[r]}</span>` : "";

function metaLine(e) {
  const bits = [];
  if (e.category) bits.push(`<span class="tag">${esc(e.category)}</span>`);
  if (e.source) bits.push(`<span>${esc(e.source)}</span>${richtungTag(RICHTUNG[e.source])}`);
  bits.push(`<a href="${safeUrl(e.url)}" target="_blank" rel="noopener">Zur Quelle →</a>`);
  return `<div class="meta">${bits.join("")}</div>`;
}
const tippHtml = e => (e.tipp ? `<div class="tipp"><b>Praxis-Tipp:</b> ${esc(e.tipp)}</div>` : "") +
  (e.hamburg ? `<div class="tipp hh"><b>Für Hamburg:</b> ${esc(e.hamburg)}</div>` : "") +
  (e.stimmen?.length ? `<div class="stimmen"><b>Andere Stimmen:</b> ${e.stimmen.map(s =>
    `<a href="${safeUrl(s.url)}" target="_blank" rel="noopener">${esc(s.source)}${richtungTag(s.richtung)}</a>`).join("")}</div>` : "");
const idAttr = e => Number.isInteger(e._k) ? ` id="m-${e._k}"` : "";

const renderTop = top => !top.length ? `<div class="empty">Heute keine großen Meldungen.</div>` :
  `<div class="top">${top.map((t, i) =>
    `<article class="top-card"${idAttr(t)}><div class="num">${i + 1}</div><h3>${esc(t.title)}</h3><p>${esc(t.text || t.summary)}</p>` +
    `${tippHtml(t)}${metaLine(t)}</article>`).join("")}</div>`;

function renderSections(entries, order) {
  const groups = new Map(order.map(c => [c, []]));
  for (const e of entries) {
    const c = e.category || "Sonstiges";
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(e);
  }
  let html = "";
  for (const [cat, list] of groups) {
    if (!list.length) continue;
    html += `<section class="rubrik"><h2>${esc(cat)} <span class="n">${list.length}</span></h2>`;
    for (const e of list) html += `<article class="item"${idAttr(e)}><h3>${esc(e.title)}</h3><p>${esc(e.summary)}</p>${tippHtml(e)}${metaLine({ ...e, category: "" })}</article>`;
    html += `</section>`;
  }
  return html ? `<h2 class="alle">Alle Meldungen</h2><div class="rubriken">${html}</div>` : "";
}

const panel = (title, sub, body, foot = "") =>
  `<section class="panel"><h3>${esc(title)}</h3><div class="panel-sub">${esc(sub)}</div>${body}${foot ? `<div class="panel-foot">${esc(foot)}</div>` : ""}</section>`;
const tile = (label, value, note = "") =>
  `<div class="tile"><div class="tile-l">${esc(label)}</div><div class="tile-v">${value}</div>${note ? `<div class="tile-n">${esc(note)}</div>` : ""}</div>`;
const signed = (v, d = 1, unit = "") => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v), d)}${unit}`;

// ---------- Kennzahlen ----------

function entitiesOf(e, entities) {
  const t = `${e.title} ${e.text || ""} ${e.summary || ""}`;
  return entities.filter(([, re, fl]) => new RegExp(re, fl ?? "i").test(t)).map(([n]) => n);
}

function renderDashboard(cfg, manifest, date, metrics, dir) {
  const order = cfg.categories;
  const briefs = manifest.briefs.filter(b => b.date <= date).sort((a, b) => a.date.localeCompare(b.date));
  const cur = briefs.at(-1), last7 = briefs.slice(-7), prev = briefs.slice(-8, -1);
  const avgPrev = prev.length ? prev.reduce((s, b) => s + b.count, 0) / prev.length : null;
  const sum = key => last7.reduce((acc, b) => { for (const [k, v] of Object.entries(b[key] || {})) acc[k] = (acc[k] || 0) + v; return acc; }, {});
  const cats = sum("cats"), ents = sum("ents");
  const span = last7.length <= 1 ? "heute" : `letzte ${last7.length} Ausgaben`;
  const M = cfg.metrics || {};

  // Börse: letzte 30 Handelstage, Start = 100
  const stockSeries = Object.entries(M.stocks || {}).map(([sym, name], i) => {
    const s = (metrics.stocks?.[sym] || []).slice(-30), b = s[0]?.[1];
    return { sym, name, color: `var(--s${i + 1})`, points: s.map(([d, c]) => [d, Math.round((c / b) * 1000) / 10]) };
  }).filter(s => s.points.length > 1);
  const ecbSeries = key => metrics.ecb?.[key] || [];
  // arXiv: Summe der KI-Kategorien je Tag, letzte 30 Tage
  const dm = iso => iso.split("-").reverse().slice(0, 2).join(".") + ".";
  const arxivDays = Object.entries(metrics.arxiv || {}).sort(([a], [b]) => a.localeCompare(b)).slice(-30)
    .map(([d, v]) => ({ date: d, value: Object.values(v).reduce((s, n) => s + n, 0), v }));

  // Kacheln
  let kpis = "";
  if (cur) {
    kpis += tile("Meldungen heute", fmt(cur.count), avgPrev !== null ? `Ø vorher ${fmt(avgPrev, 1)}` : "erste Ausgabe");
    kpis += tile("Quellen heute", fmt(cur.sources || 0));
  }
  for (const t of cfg.tiles || []) {
    if (t.ecb) {
      const s = ecbSeries(t.ecb); if (!s.length) continue;
      const [ym, v] = s.at(-1), before = s.at(-13);
      kpis += tile(t.label, `${fmt(v, t.decimals ?? 2)} ${t.unit || "%"}`,
        `${monthLabel(ym)}${before ? `, vor 12 Monaten ${fmt(before[1], t.decimals ?? 2)} ${t.unit || "%"}` : ""}`);
    } else if (t.arxiv) {
      const a = arxivDays.at(-1); if (!a) continue;
      kpis += tile(t.label, fmt(a.value), `arXiv, ${dm(a.date)}`);
    } else if (t.stock) {
      const s = stockSeries.find(x => x.sym === t.stock); if (!s) continue;
      kpis += tile(t.label, signed(s.points.at(-1)[1] - 100, 1, " %"), "im Vergleich zu vor 30 Handelstagen");
    }
  }

  // Fußball (Vereins-Dashboards)
  const fb = cfg.football ? renderFootball(cfg, metrics, panel, tile) : { fan: "", tiles: "", panels: "" };
  kpis = fb.tiles + kpis;

  // Steuern & Standorte: Karte, Tracker, Vergleiche (data/zonen.json)
  const zn = cfg.zonen && dir ? renderZonen(cfg, loadJson(join(dir, "data", "zonen.json"), null), loadJson(join(dir, "data", "laender.json"), null), date, panel, tile)
    : { fan: "", tiles: "", panels: "" };
  kpis = zn.tiles + kpis;

  // Welt-Monitor: Brennpunkte, Globus, Regionen, Katastrophen, Quellen-Mix
  const wl = cfg.globus && dir ? renderWelt(cfg, loadJson(join(dir, "content.json"), {}), metrics, panel, tile) : { fan: "", panels: "" };

  // Diagramme
  let panels = wl.panels + fb.panels + zn.panels;
  const catItems = order.map(c => ({ label: c, value: cats[c] || 0 })).filter(i => i.value);
  panels += panel("Worüber geredet wird", `Meldungen je Rubrik, ${span}`, hBars(catItems));
  if (cfg.entities?.length) {
    const items = Object.entries(ents).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
    panels += panel(cfg.entitiesTitle || "In den Schlagzeilen", `Erwähnungen in Meldungen, ${span}`,
      hBars(items, { color: "var(--s2)" }), "Gezählt wird, ob ein Name in einer Meldung vorkommt.");
  }
  for (const p of M.ecbPanels || []) {
    const series = p.keys.map((k, i) => ({ name: p.names[i], color: `var(--s${i + 1})`, points: ecbSeries(k).slice(-(p.months || 24)) }))
      .filter(s => s.points.length > 1);
    if (series.length)
      panels += panel(p.title, p.sub, (series.length > 1 ? legend(series) : "") +
        lines(series, { label: monthLabel, decimals: p.decimals ?? 2, unit: p.unit ?? " %" }), p.foot || "Quelle: Europäische Zentralbank (EZB-Datenportal).");
  }
  if (stockSeries.length)
    panels += panel(M.stocksTitle || "An der Börse", M.stocksSub || "Kurs, letzte 30 Handelstage, Start = 100",
      legend(stockSeries) + lines(stockSeries, { base: 100 }), "Quelle: Yahoo Finance. Nur zur Einordnung, keine Anlageberatung.");
  if (M.arxiv && arxivDays.length) {
    const short = { "cs.AI": "KI", "cs.LG": "ML", "cs.CL": "Sprache" };
    panels += panel("Wie viel zu KI geforscht wird", "Neue Fachartikel pro Tag auf arXiv (KI, maschinelles Lernen, Sprache)",
      columns(arxivDays.map(d => ({ date: d.date, value: d.value,
        tip: `${dm(d.date)}: ${fmt(d.value)} (${Object.entries(d.v).map(([k, n]) => `${short[k] || k} ${n}`).join(", ")})` }))),
      arxivDays.length < 3 ? "Die Reihe wächst jeden Tag um einen Wert." : "");
  }
  if (M.hf && metrics.hf?.length) {
    const rows = metrics.hf.slice(0, 6).map(m =>
      `<li><a href="https://huggingface.co/${esc(m.id)}" target="_blank" rel="noopener">${esc(m.id.split("/")[1] || m.id)}</a>` +
      `<span>${esc(m.id.split("/")[0])}</span><b>${fmt(m.likes)} ♥</b></li>`).join("");
    panels += panel("Gefragte offene Modelle", "Gerade am meisten beachtet auf Hugging Face", `<ol class="ranklist">${rows}</ol>`,
      "Offene Modelle kann jeder herunterladen und selbst betreiben.");
  }
  if (briefs.length > 1)
    panels += panel("Meldungen pro Tag", "Anzahl ausgewählter Meldungen je Ausgabe",
      columns(briefs.slice(-14).map(b => ({ date: b.date, value: b.count }))));

  // Auto-Fanseite: Traumwagen der Woche, nächster Termin, Hamburg-Radar (data/markt.json)
  const ga = cfg.garage && dir ? renderGarage(cfg, loadJson(join(dir, "data", "markt.json"), null), date) : "";

  return { kpis: `<div class="tiles">${kpis}</div>`, dashboard: `<div class="dash">${panels}</div>`, fan: wl.fan + fb.fan + zn.fan + ga };
}

// ---------- Ein Dashboard bauen ----------

function buildDashboard(name, template) {
  const dir = join(ROOT, name);
  const cfg = loadJson(join(dir, "config.json"), null);
  const content = loadJson(join(dir, "content.json"), null);
  const metrics = loadJson(join(dir, "data", "metrics.json"), {});
  const manifestPath = join(dir, "archive", "manifest.json");
  mkdirSync(join(dir, "archive"), { recursive: true });
  const manifest = loadJson(manifestPath, { briefs: [] });
  RICHTUNG = Object.fromEntries((cfg.sources || []).filter(s => s.richtung).map(s => [s.name, s.richtung]));
  const base = {
    LANG: "de", DESCRIPTION: esc(cfg.description), SITE_TITLE: esc(cfg.title), HUB: "",
    KENNZAHLEN: esc(cfg.kennzahlenQuellen || "eigene Zählung"), ICON: cfg.icon || "📰",
    FEEDBACK: feedbackHtml(cfg.title),
  };
  // Eigenes Design je Dashboard (config.json → "theme"): assets/theme-<name>.css und .js
  const theme = (assets) => cfg.theme ? {
    THEME_CSS: `<link rel="stylesheet" href="${assets}theme-${cfg.theme}.css">`, BODY_CLASS: `theme-${cfg.theme}`,
    EXTRA_JS: `<script src="${assets}theme-${cfg.theme}.js"></script>`,
    BANNER: existsSync(join(ROOT, "assets", `theme-${cfg.theme}.html`)) ? readFileSync(join(ROOT, "assets", `theme-${cfg.theme}.html`), "utf8") : "",
  } : {};

  // Noch keine Ausgabe: nur Platzhalter, kein Archiv-Eintrag
  if (!content?.date) {
    const { kpis, dashboard, fan } = renderDashboard(cfg, manifest, today(), metrics, dir);
    writeFileSync(join(dir, "index.html"), fill(template, {
      ...base, ...theme("../assets/"), FAN: fan, PAGE_TITLE: esc(cfg.title), DATE_LONG: "Erste Ausgabe folgt", ASSETS: "../assets/",
      STATS: "Die erste Ausgabe erscheint mit dem nächsten Morgenlauf.", NAV: `<a href="../">Alle Dashboards</a>`,
      KPIS: kpis, DASHBOARD: dashboard, TOP_TITLE: "", SOURCES: (cfg.sources || []).map(s => esc(s.name)).join(", "),
    }).replace("<h2></h2>", ""));
    console.log(`${name}: Platzhalter (noch keine Ausgabe)`);
    return { name, cfg, latest: null };
  }

  const date = content.date;
  const top = (content.top || []).slice(0, 3), entries = content.entries || [], all = [...top, ...entries];
  all.forEach((e, k) => { e._k = k; }); // Sprungmarken m-0, m-1, … (Globus und Brennpunkte verlinken darauf)
  const sources = [...new Set(all.map(e => e.source).filter(Boolean))];
  const cats = {}, ents = {};
  for (const e of all) {
    if (e.category) cats[e.category] = (cats[e.category] || 0) + 1;
    for (const n of entitiesOf(e, cfg.entities || [])) ents[n] = (ents[n] || 0) + 1;
  }
  manifest.briefs = manifest.briefs.filter(b => b.date !== date);
  manifest.briefs.push({ date, file: `${date}.html`, headline: top[0]?.title || "", count: all.length, sources: sources.length, cats, ents });
  manifest.briefs.sort((a, b) => b.date.localeCompare(a.date));
  manifest.site = { title: cfg.title, description: cfg.description };
  const older = manifest.briefs[manifest.briefs.findIndex(b => b.date === date) + 1];
  const { kpis, dashboard: dash, fan } = renderDashboard(cfg, manifest, date, metrics, dir);
  // Modelle im Blick (Autos): Vergleich mit Marktdaten aus data/markt.json (scripts/markt.mjs)
  // "modelle.oben": true → vor den Diagrammen statt danach
  const mod = cfg.modelle ? renderModelle(cfg, loadJson(join(dir, "data", "markt.json"), null), all) : "";
  const dashboard = cfg.modelle?.oben ? mod + dash : dash + mod;

  const page = (root, assets, isIndex) => {
    const nav = [`<a href="${root}../">Alle Dashboards</a>`];
    if (!isIndex) nav.push(`<a href="${root}">Heute</a>`);
    if (older) nav.push(`<a href="${root}archive/${older.file}">← Vortag</a>`);
    nav.push(`<a href="${root}archive/">Archiv</a>`);
    if (SITE.feedback) nav.push(feedbackNav());
    return fill(template, {
      ...base, ...theme(assets), FAN: fan, PAGE_TITLE: `${esc(cfg.title)} · ${esc(shortDate(date))}`, DATE_LONG: esc(longDate(date)), ASSETS: assets,
      STATS: `${all.length} Meldungen aus ${sources.length} Quellen`, NAV: nav.join(""),
      KPIS: kpis, INTRO: content.intro ? `<div class="intro">${esc(content.intro)}</div>` : "",
      TOP_TITLE: "Top 3 des Tages", TOP: renderTop(top), DASHBOARD: dashboard, SECTIONS: renderSections(entries, cfg.categories),
      RUECKBLICK: content.rueckblick ? `<h2>Wochenrückblick</h2><div class="rueckblick">${esc(content.rueckblick)}</div>` : "",
      SOURCES: sources.map(esc).join(", "),
    });
  };
  writeFileSync(join(dir, "archive", `${date}.html`), page("../", "../../assets/", false));
  if (manifest.briefs[0].date === date) writeFileSync(join(dir, "index.html"), page("", "../assets/", true));

  const list = manifest.briefs.map(b => `<li><a href="${esc(b.file)}"><span class="d">${esc(longDate(b.date))}</span>` +
    `<span class="h">${esc(b.headline || `${b.count} Meldungen`)}</span></a></li>`).join("");
  writeFileSync(join(dir, "archive", "index.html"), fill(template, {
    ...base, ...theme("../../assets/"), PAGE_TITLE: `${esc(cfg.title)} · Archiv`, DATE_LONG: "Archiv", ASSETS: "../../assets/",
    STATS: `${manifest.briefs.length} Ausgaben`, NAV: `<a href="../../">Alle Dashboards</a><a href="../">Heute</a>`,
    TOP_TITLE: "Alle Ausgaben", TOP: `<ul class="archive">${list}</ul>`, SOURCES: "siehe einzelne Ausgaben",
  }));
  saveJson(manifestPath, manifest);

  const seenPath = join(dir, "seen.json"), seen = loadJson(seenPath, {});
  for (const e of all) if (e.url && !seen[e.url]) seen[e.url] = { title: e.title, source: e.source || "", first_seen: date };
  saveJson(seenPath, seen);
  console.log(`${name}: ${date}, ${all.length} Meldungen, seen ${Object.keys(seen).length}`);
  return { name, cfg, latest: manifest.briefs[0] };
}

// ---------- Startseite ----------

// Im Browser: "Heute" nach dem Datum des Lesers setzen (die Seite kann von gestern sein)
const HUB_SCRIPT = `<script>(function(){
var t=new Date(),pad=function(n){return(n<10?"0":"")+n},today=t.getFullYear()+"-"+pad(t.getMonth()+1)+"-"+pad(t.getDate());
var wd=["So.","Mo.","Di.","Mi.","Do.","Fr.","Sa."];
function mark(el,d){if(d===today){el.textContent="Heute";el.className="fresh";}else{var x=new Date(d+"T12:00:00");el.textContent=wd[x.getDay()]+", "+pad(x.getDate())+"."+pad(x.getMonth()+1)+"."+x.getFullYear();el.className="";}}
document.querySelectorAll(".hub-meta span[data-date]").forEach(function(el){mark(el,el.getAttribute("data-date"))});})();</script>`;

function buildHub(results, template) {
  const cards = results.map(r => ({ url: `${r.name}/`, title: r.cfg.title, icon: r.cfg.icon || "📰", description: r.cfg.description, latest: r.latest }));
  const html = cards.map(c => {
    const fresh = c.latest && c.latest.date === today();
    return `<a class="hub-card" href="${esc(c.url)}"><div class="hub-icon">${c.icon}</div><div class="hub-body">` +
      `<h3>${esc(c.title)}</h3><p>${esc(c.description)}</p>` +
      (c.latest ? `<div class="hub-top">${esc(c.latest.headline || "")}</div>` +
        `<div class="hub-meta"><span data-date="${esc(c.latest.date)}" class="${fresh ? "fresh" : ""}">${fresh ? "Heute" : esc(shortDate(c.latest.date))}</span> · ${fmt(c.latest.count || 0)} Meldungen</div>`
        : `<div class="hub-meta">Erste Ausgabe folgt</div>`) + `</div></a>`;
  }).join("");
  writeFileSync(join(ROOT, "index.html"), fill(template, {
    LANG: "de", PAGE_TITLE: "News-Dashboards", DESCRIPTION: "Tägliche News-Dashboards: KI, Immobilien, Wirtschaft, Steuern, Hamburg, Startups, HSV, Welt, Autos, Recht",
    SITE_TITLE: "News-Dashboards", DATE_LONG: esc(longDate(today())), ASSETS: "assets/",
    STATS: "Jeden Morgen neu, kurz auf Deutsch zusammengefasst", TOP_TITLE: "Alle Dashboards",
    NAV: feedbackNav(), FEEDBACK: feedbackHtml("Startseite"),
    TOP: `<div class="hub">${html}</div>` + HUB_SCRIPT, SOURCES: "siehe einzelne Dashboards", KENNZAHLEN: "siehe einzelne Dashboards",
  }));
  console.log("index.html (Startseite) geschrieben");
}

const template = readFileSync(join(ROOT, "template.html"), "utf8");
const all = readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(ROOT, d.name, "config.json"))).map(d => d.name)
  .sort((a, b) => (loadJson(join(ROOT, a, "config.json"), {}).order ?? 99) - (loadJson(join(ROOT, b, "config.json"), {}).order ?? 99));
const only = process.argv[2];
const results = all.map(n => (only && n !== only) ? null : buildDashboard(n, template)).filter(Boolean);
if (!only) buildHub(results, template);
