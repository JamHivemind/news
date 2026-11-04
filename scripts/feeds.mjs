#!/usr/bin/env node
// Holt alle RSS/Atom-Feeds der Dashboards und schreibt die Einträge der letzten Tage nach <dashboard>/feeds.json.
// Läuft in der GitHub Action, weil die Cloud-Umgebung der Routine Nachrichtenseiten nicht erreichen darf.
// Die Routine liest danach nur noch feeds.json. Ohne Abhängigkeiten.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = { "user-agent": "Mozilla/5.0 (News-Dashboards; +https://jamhivemind.github.io/news/)" };
const MAX_PER_SOURCE = 30;
// montags das Wochenende mitnehmen
const HOURS = new Date().getUTCDay() === 1 ? 80 : 48;

// Erst Entitäten auflösen, dann HTML entfernen: manche Feeds liefern HTML als &lt;a …&gt;
const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ").trim();
// Tracking-Parameter aus Links entfernen
const cleanUrl = u => {
  try {
    const x = new URL(u);
    [...x.searchParams.keys()].filter(k => /^(utm_|wt_|cid$|ref$)/i.test(k)).forEach(k => x.searchParams.delete(k));
    return x.toString();
  } catch { return u; }
};
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
};

// Einträge aus RSS 2.0 und Atom
export function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map(b => {
    let link = tag(b, "link");
    if (!/^https?:/.test(link)) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)/i) || b.match(/<link[^>]*href=["']([^"']+)/i);
      link = alt ? alt[1].replace(/&amp;/g, "&") : "";
    }
    const date = tag(b, "pubDate") || tag(b, "dc:date") || tag(b, "published") || tag(b, "updated");
    const src = b.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    return {
      title: tag(b, "title"),
      url: cleanUrl(link.trim()),
      date: date ? new Date(date).toISOString() : null,
      text: (tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content")).slice(0, 500),
      ...(src ? { via: decode(src[1]) } : {}),
    };
  }).filter(i => i.title && i.url);
}

export async function fetchSources(sources) {
  const since = Date.now() - HOURS * 36e5;
  const out = { fetched: new Date().toISOString(), hours: HOURS, sources: [] };
  for (const s of sources) {
    if (s.type !== "rss" || !s.url) continue;
    try {
      const res = await fetch(s.url, { headers: UA, signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseFeed(await res.text())
        .filter(i => !i.date || Date.parse(i.date) >= since)
        .slice(0, MAX_PER_SOURCE);
      out.sources.push({ name: s.name, ...(s.focus ? { focus: s.focus } : {}), ok: true, items });
      console.log(`  ${s.name}: ${items.length}`);
    } catch (e) {
      out.sources.push({ name: s.name, ok: false, error: e.message, items: [] });
      console.log(`  ${s.name}: FEHLER ${e.message}`);
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("feeds.mjs")) {
  const dashboards = readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(ROOT, d.name, "config.json"))).map(d => d.name);
  for (const name of dashboards) {
    console.log(`${name}:`);
    const cfg = JSON.parse(readFileSync(join(ROOT, name, "config.json"), "utf8"));
    const data = await fetchSources(cfg.sources || []);
    writeFileSync(join(ROOT, name, "feeds.json"), JSON.stringify(data, null, 1) + "\n");
  }
}
