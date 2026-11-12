#!/usr/bin/env node
// Marktdaten für "Modelle im Blick" (config.json → modelle). Wertet öffentliche Inserate auf AutoScout24 aus und
// speichert NUR Kennzahlen (Anzahl, Median, Spanne) je Modell in <ordner>/data/markt.json, keine einzelnen Inserate.
// Läuft höchstens einmal pro Woche (sonst übersprungen), schonend: 1,5 s Pause je Seite, gleiche Suchen nur einmal.
// Abschalten: config.json → modelle.abruf = false. Erzwingen: node scripts/markt.mjs --force
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORCE = process.argv.includes("--force");
const TAGE = 6; // Mindestabstand zwischen zwei Abrufen
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "accept-language": "de-DE" };
const loadJson = (f, fb) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return fb; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

const cache = new Map(); // gleiche Suche (z. B. alle 993) nur einmal abrufen
async function inserate(path, seiten) {
  const key = `${path}|${seiten}`;
  if (cache.has(key)) return cache.get(key);
  const out = new Map();
  for (let p = 1; p <= seiten; p++) {
    const url = `https://www.autoscout24.de/lst/${path}${path.includes("?") ? "&" : "?"}page=${p}`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const m = (await res.text()).match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (!m) throw new Error("Seitenaufbau unbekannt (gesperrt?)");
    const pp = JSON.parse(m[1]).props?.pageProps || {};
    for (const l of pp.listings || []) out.set(l.id, l);
    if (p >= (pp.numberOfPages || 1)) break;
    await sleep(1500);
  }
  const list = [...out.values()];
  cache.set(key, list);
  return list;
}

const quantil = (s, q) => { const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return Math.round(s[lo] + (s[hi] - s[lo]) * (i - lo)); };

async function modell(m) {
  const a = m.as24;
  const mit = a.mit ? new RegExp(a.mit, "i") : null, ohne = a.ohne ? new RegExp(a.ohne, "i") : null;
  const variante = a.variante ? new RegExp(a.variante, "i") : null;
  const passend = (await inserate(a.path, a.seiten || 3)).filter(l => {
    const v = l.vehicle || {}, text = `${v.variant || ""} ${v.modelVersionInput || ""} ${l.title || ""}`;
    if (!(l.price?.priceRaw > 1000) || v.isCurrentlyDamaged) return false;
    if (variante && !variante.test(v.variant || "")) return false;
    if (mit && !mit.test(text)) return false;
    if (ohne && ohne.test(text)) return false;
    return true;
  });
  const preise = passend.map(l => l.price.priceRaw).sort((x, y) => x - y);
  if (!preise.length) return { datum: heute, anzahl: 0 };
  const km = passend.map(l => parseInt(String(l.vehicle?.mileageInKm || "").replace(/\D/g, ""), 10)).filter(n => n > 0).sort((x, y) => x - y);
  return { datum: heute, anzahl: preise.length, median: quantil(preise, 0.5), p25: quantil(preise, 0.25), p75: quantil(preise, 0.75),
    min: preise[0], max: preise.at(-1), ...(km.length ? { kmMedian: quantil(km, 0.5) } : {}) };
}

const ordner = readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(ROOT, d.name, "config.json"))).map(d => d.name);
for (const name of ordner) {
  const cfg = loadJson(join(ROOT, name, "config.json"), {});
  if (!cfg.modelle?.liste?.length) continue;
  if (cfg.modelle.abruf === false) { console.log(`${name}: Marktabruf abgeschaltet (modelle.abruf = false)`); continue; }
  const file = join(ROOT, name, "data", "markt.json");
  const data = loadJson(file, { modelle: {} });
  if (!FORCE && data.abgerufen && (Date.parse(heute) - Date.parse(data.abgerufen)) / 864e5 < TAGE) {
    console.log(`${name}: Marktdaten vom ${data.abgerufen}, nächster Abruf frühestens nach ${TAGE} Tagen`);
    continue;
  }
  console.log(`${name}:`);
  let ok = 0;
  for (const m of cfg.modelle.liste) {
    if (!m.as24) continue;
    try {
      const r = await modell(m);
      const v = (data.modelle[m.id] ??= { verlauf: [] }).verlauf;
      const i = v.findIndex(x => x.datum === heute);
      if (i >= 0) v[i] = r; else v.push(r);
      ok++;
      console.log(`  ${m.id}: ${r.anzahl} Inserate, Median ${r.median ?? "-"}`);
    } catch (e) { console.log(`  ${m.id}: FEHLER ${e.message}`); }
  }
  if (ok) {
    data.abgerufen = heute;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
  }
}
