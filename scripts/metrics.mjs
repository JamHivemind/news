#!/usr/bin/env node
// Holt täglich die Kennzahlen jedes Dashboards (Börse über Yahoo Finance, Zinsen und Preise über die EZB, Fußball über OpenLigaDB)
// und schreibt sie nach <dashboard>/data/metrics.json. Dazu die Kopfdaten der KI-News für die Startseite.
// Ohne Abhängigkeiten und ohne Schlüssel. Fällt eine Quelle aus, bleibt der alte Wert stehen.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = { "user-agent": "Mozilla/5.0 (News-Dashboards; +https://jamhivemind.github.io/news/)" };
const load = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };

async function get(url, type = "json") {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return type === "json" ? res.json() : res.text();
}
async function attempt(name, fn) {
  try { return await fn(); } catch (e) { console.log(`  ${name} übersprungen: ${e.message}`); return undefined; }
}

// Schlusskurse der letzten 3 Monate
async function stock(sym) {
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=3mo&interval=1d`);
  const r = j.chart.result[0], close = r.indicators.quote[0].close;
  return r.timestamp
    .map((t, i) => [new Date(t * 1000).toISOString().slice(0, 10), close[i]])
    .filter(([, c]) => typeof c === "number")
    .map(([d, c]) => [d, Math.round(c * 100) / 100]);
}

// EZB-Datenportal: Reihe als [[JJJJ-MM, Wert]], Tageswerte auf den letzten Wert im Monat verdichtet
async function ecb(key) {
  const [flow, ...rest] = key.split(".");
  const start = new Date(Date.now() - 3 * 365 * 864e5).toISOString().slice(0, 7);
  const csv = await get(`https://data-api.ecb.europa.eu/service/data/${flow}/${rest.join(".")}?format=csvdata&detail=dataonly&startPeriod=${start}`, "text");
  const [head, ...rows] = csv.trim().split(/\r?\n/);
  const cols = head.split(","), ti = cols.indexOf("TIME_PERIOD"), vi = cols.indexOf("OBS_VALUE");
  const byMonth = new Map();
  for (const r of rows) {
    const c = r.split(","), v = Number(c[vi]);
    if (c[ti] && !Number.isNaN(v)) byMonth.set(c[ti].slice(0, 7), Math.round(v * 1000) / 1000);
  }
  if (!byMonth.size) throw new Error("keine Werte");
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// Fußball über OpenLigaDB (frei, ohne Schlüssel): Spiele des Vereins und Tabelle
async function football(f) {
  const all = await get(`https://api.openligadb.de/getmatchdata/${f.league}/${f.season}`);
  const end = m => (m.matchResults || []).find(r => r.resultTypeID === 2) || null;
  const matches = all.filter(m => m.team1.teamId === f.teamId || m.team2.teamId === f.teamId).map(m => ({
    day: m.group.groupOrderID, utc: m.matchDateTimeUTC, done: !!m.matchIsFinished,
    home: m.team1.teamName, homeShort: m.team1.shortName, homeId: m.team1.teamId,
    away: m.team2.teamName, awayShort: m.team2.shortName, awayId: m.team2.teamId,
    g1: end(m)?.pointsTeam1 ?? null, g2: end(m)?.pointsTeam2 ?? null,
    stadium: m.location?.locationStadium || null,
  })).sort((a, b) => a.utc.localeCompare(b.utc));
  if (!matches.length) throw new Error("keine Spiele");
  const tab = await get(`https://api.openligadb.de/getbltable/${f.league}/${f.season}`);
  const table = tab.map((t, i) => ({ pos: i + 1, id: t.teamInfoId, team: t.teamName, short: t.shortName,
    pts: t.points, sp: t.matches, w: t.won, d: t.draw, l: t.lost, g: t.goals, o: t.opponentGoals, diff: t.goalDiff }));
  return { matches, table, fetched: new Date().toISOString() };
}

const dashboards = readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(ROOT, d.name, "config.json")))
  .map(d => d.name);

for (const name of dashboards) {
  const cfg = load(join(ROOT, name, "config.json"), {});
  const file = join(ROOT, name, "data", "metrics.json");
  const m = load(file, {});
  console.log(`${name}:`);
  for (const [sym] of Object.entries(cfg.metrics?.stocks || {})) {
    const v = await attempt(`Aktie ${sym}`, () => stock(sym));
    if (v) (m.stocks ??= {})[sym] = v;
  }
  for (const s of cfg.metrics?.ecb || []) {
    const v = await attempt(`EZB ${s.key}`, () => ecb(s.key));
    if (v) (m.ecb ??= {})[s.key] = v;
  }
  if (cfg.football) {
    const v = await attempt("Fußball", () => football(cfg.football));
    if (v) m.football = v;
  }
  m.updated = new Date().toISOString();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(m, null, 1) + "\n");
  console.log(`  Aktien ${Object.keys(m.stocks || {}).length}, EZB-Reihen ${Object.keys(m.ecb || {}).length}`);
}

// KI-News (eigenes Repo) für die Startseite
const ki = await attempt("KI-News", () => get("https://jamhivemind.github.io/ki-news/archive/manifest.json"));
if (ki) {
  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(join(ROOT, "data", "ki-news.json"), JSON.stringify(ki.briefs?.[0] || {}, null, 1) + "\n");
}
