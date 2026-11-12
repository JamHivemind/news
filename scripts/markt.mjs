#!/usr/bin/env node
// Marktdaten für "Modelle im Blick" (config.json → modelle). Wertet öffentliche Inserate auf AutoScout24 aus und
// speichert je Modell Kennzahlen (Anzahl, Median, Spanne) in <ordner>/data/markt.json, keine Inseratsliste.
// Dazu "In Hamburg angeboten": Händlerangebote (nie Privatverkäufer) aus Hamburg und Umgebung, aus denselben
// AutoScout24-Daten und von den Elferspot-Seiten der Hamburger Händler in modelle.haendler.
// Läuft höchstens einmal pro Woche (sonst übersprungen), schonend: Pausen zwischen den Seiten, gleiche Seiten nur einmal.
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
const get = async url => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};
const re = s => s ? new RegExp(s, "i") : null;

// ---------- AutoScout24 ----------
const cache = new Map(); // gleiche Suche (z. B. alle 993) nur einmal abrufen
async function inserate(path, seiten) {
  const key = `${path}|${seiten}`;
  if (cache.has(key)) return cache.get(key);
  const out = new Map();
  for (let p = 1; p <= seiten; p++) {
    const m = (await get(`https://www.autoscout24.de/lst/${path}${path.includes("?") ? "&" : "?"}page=${p}`))
      .match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
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
const text = l => `${l.vehicle?.variant || ""} ${l.vehicle?.modelVersionInput || ""} ${l.title || ""}`;
const km = l => parseInt(String(l.vehicle?.mileageInKm || "").replace(/\D/g, ""), 10) || null;
function filter(list, { mit, ohne, variante }) {
  const M = re(mit), O = re(ohne), V = re(variante);
  return list.filter(l => {
    if (!(l.price?.priceRaw > 1000) || l.vehicle?.isCurrentlyDamaged) return false;
    if (V && !V.test(l.vehicle?.variant || "")) return false;
    if (M && !M.test(text(l))) return false;
    if (O && O.test(text(l))) return false;
    return true;
  });
}
const quantil = (s, q) => { const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return Math.round(s[lo] + (s[hi] - s[lo]) * (i - lo)); };
function kennzahlen(passend) {
  const preise = passend.map(l => l.price.priceRaw).sort((x, y) => x - y);
  if (!preise.length) return { datum: heute, anzahl: 0 };
  const kms = passend.map(km).filter(Boolean).sort((x, y) => x - y);
  return { datum: heute, anzahl: preise.length, median: quantil(preise, 0.5), p25: quantil(preise, 0.25), p75: quantil(preise, 0.75),
    min: preise[0], max: preise.at(-1), ...(kms.length ? { kmMedian: quantil(kms, 0.5) } : {}) };
}

// Hamburg und Umgebung: PLZ 20000–22999 sowie 253xx/254xx (Kreis Pinneberg)
const HAMBURG = /^(2[0-2]\d{3}|25[34]\d{2})$/;
// Lesbarer Titel: Porsche "911 Turbo Coupe", AMG "AMG GT Coupé", SL "SL 560"
const titelAS24 = l => { const v = l.vehicle || {}; return `${v.make || ""} ${v.variant && v.variant.length > 8 ? v.variant : `${v.model || ""} ${v.variant || ""}`}`.replace(/\s+/g, " ").trim(); };
const jahr = s => (String(s || "").match(/(19|20)\d{2}/) || [])[0] || null;
function hamburgAS24(list) {
  return list.filter(l => l.seller?.type === "Dealer" && HAMBURG.test(String(l.location?.zip || ""))).map(l => ({
    haendler: l.seller?.companyName || "Händler", ort: l.location?.city || "", titel: titelAS24(l),
    jahr: jahr(l.tracking?.firstRegistration), km: km(l), preis: l.price.priceRaw, url: `https://www.autoscout24.de${l.url}`, quelle: "AutoScout24",
  }));
}

// ---------- Elferspot-Seiten der Hamburger Händler ----------
const ES = "https://www.elferspot.com/de/";
const esHaendler = new Map(), esFahrzeug = new Map();
async function haendlerLinks(slug) {
  if (!esHaendler.has(slug)) {
    const t = await get(`${ES}haendler/${slug}/`);
    esHaendler.set(slug, [...new Set([...t.matchAll(/href="(https:\/\/www\.elferspot\.com\/de\/fahrzeug\/[^"]+\/)"/g)].map(m => m[1]))]);
    await sleep(1200);
  }
  return esHaendler.get(slug);
}
async function fahrzeug(url, h) {
  if (!esFahrzeug.has(url)) {
    const t = await get(url);
    await sleep(1200);
    // Nur Fahrzeuge, die wirklich diesem Händler gehören (Händlerseiten zeigen auch fremde Empfehlungen)
    const eigen = t.includes(`/haendler/${h.elferspot}/`) || t.includes(`/dealer/${h.elferspot}/`);
    const preis = Number((t.match(/"price":"(\d+)"/) || [])[1]) || null;
    const plain = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const kmTreffer = plain.match(/Laufleistung:\s*([\d.]+)\s*km/);
    const titel = (t.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1]?.trim() || url.split("/fahrzeug/")[1].replace(/-\d+\/$/, "").replace(/-/g, " ");
    esFahrzeug.set(url, eigen && preis ? { haendler: h.name, ort: h.ort, titel, jahr: jahr(url.match(/-((19|20)\d{2})-\d+\/$/)?.[1]),
      km: kmTreffer ? Number(kmTreffer[1].replace(/\./g, "")) : null, preis, url, quelle: "Elferspot" } : null);
  }
  return esFahrzeug.get(url);
}

// ---------- Ein Modell ----------
async function modell(m, haendler) {
  const a = m.as24, lok = m.lokal || {};
  const alle = await inserate(a.path, a.seiten || 3);
  const r = kennzahlen(filter(alle, a));
  // In Hamburg angeboten: eigener Filter (lokal.mit/ohne), z. B. beim Turbo S auch andere 993 Turbo zum Vergleich
  const lokalFilter = lok.mit || lok.ohne ? { mit: lok.mit, ohne: lok.ohne } : a;
  let angebote = [];
  if (lok.elferspot) {
    const slugRe = new RegExp(lok.elferspot, "i");
    for (const h of haendler.filter(h => h.elferspot)) {
      try {
        for (const url of (await haendlerLinks(h.elferspot)).filter(u => slugRe.test(u.split("/fahrzeug/")[1] || ""))) {
          const f = await fahrzeug(url, h);
          if (f) angebote.push(f);
        }
      } catch (e) { console.log(`  Elferspot ${h.name}: FEHLER ${e.message}`); }
    }
  }
  // Elferspot zuerst (genauere Titel); dasselbe Auto über AutoScout24 dann nur einmal (gleicher Preis, Jahr, km)
  angebote.push(...hamburgAS24(filter(alle, lokalFilter)));
  const seen = new Set();
  angebote = angebote.filter(o => { const k = `${o.preis}|${o.jahr}|${o.km}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => x.preis - y.preis);
  return { r, angebote };
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
      const { r, angebote } = await modell(m, cfg.modelle.haendler || []);
      const d = (data.modelle[m.id] ??= { verlauf: [] });
      const i = d.verlauf.findIndex(x => x.datum === heute);
      if (i >= 0) d.verlauf[i] = r; else d.verlauf.push(r);
      d.hamburg = { datum: heute, angebote };
      ok++;
      console.log(`  ${m.id}: ${r.anzahl} Inserate, Median ${r.median ?? "-"}, Hamburg ${angebote.length}`);
    } catch (e) { console.log(`  ${m.id}: FEHLER ${e.message}`); }
  }
  if (ok) {
    data.abgerufen = heute;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
  }
}
