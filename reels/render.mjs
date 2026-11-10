// Rendert einen Reel (1080x1920, 30 fps, MP4) aus reels/specs/<name>.json.
// Aufruf: node reels/render.mjs bruecken   → reels/out/bruecken.mp4 (+ Vorschaubild .jpg)
// Braucht Playwright (Chromium) und ffmpeg. Das ist bewusst getrennt vom News-Build,
// der weiterhin ohne Abhängigkeiten läuft.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// require statt import: findet auch global installiertes Playwright (NODE_PATH)
const { chromium } = createRequire(import.meta.url)("playwright");
const dir = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) { console.error("Aufruf: node reels/render.mjs <spec-name>"); process.exit(1); }
const fps = Number(process.env.FPS || 30);
const spec = JSON.parse(await readFile(path.join(dir, "specs", `${name}.json`), "utf8"));
const outDir = path.join(dir, "out");
await mkdir(outDir, { recursive: true });
const mp4 = path.join(outDir, `${name}.mp4`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(dir, "template.html")).href);
await page.evaluate(s => setup(s), spec);
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.DURATION);
const frames = Math.ceil(duration * fps);

const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg",
  "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-movflags", "+faststart", mp4],
  { stdio: ["pipe", "inherit", "inherit"] });
const done = new Promise((res, rej) => ff.on("close", c => (c ? rej(new Error(`ffmpeg ${c}`)) : res())));

for (let f = 0; f < frames; f++) {
  await page.evaluate(t => renderAt(t), f / fps);
  const buf = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
  if (f % fps === 0) process.stdout.write(`\r${Math.round((f / frames) * 100)} %`);
}
ff.stdin.end();
await done;

// Vorschaubild (Cover) aus dem Moment, in dem die Antwort steht
await page.evaluate(() => renderAt(7.5));
await page.screenshot({ path: path.join(outDir, `${name}.jpg`), type: "jpeg", quality: 90 });
await browser.close();
console.log(`\r100 % → ${path.relative(process.cwd(), mp4)}  (${duration}s, ${frames} Frames)`);
