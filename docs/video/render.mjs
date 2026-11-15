// Renders composition.html frame by frame (deterministic seek) into OpsDesk_Explainer.mp4.
// Run from e2e/ (for Playwright): node ../docs/video/render.mjs [--stills t1,t2,...] [--workers 4]
import { chromium } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const args = process.argv.slice(2);
const stills = args.includes("--stills") ? args[args.indexOf("--stills") + 1].split(",").map(Number) : null;
const WORKERS = args.includes("--workers") ? +args[args.indexOf("--workers") + 1] : 4;

const open = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("file://" + path.join(DIR, "composition.html"));
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  return page;
};

const browser = await chromium.launch();
if (stills) {
  const page = await open(browser);
  for (const t of stills) { await page.evaluate((x) => window.seek(x), t); await page.screenshot({ path: path.join(DIR, ".build", `still_${t}.jpg`), type: "jpeg", quality: 80 }); }
  await browser.close();
  process.exit(0);
}

const page0 = await open(browser);
const total = await page0.evaluate(() => window.TOTAL);
await page0.close();
const frames = Math.ceil(total * FPS);
const per = Math.ceil(frames / WORKERS);
const t0 = Date.now();
await Promise.all([...Array(WORKERS).keys()].map(async (w) => {
  const page = await open(browser);
  const out = path.join(DIR, ".build", `part${w}.mp4`);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", out]);
  for (let f = w * per; f < Math.min(frames, (w + 1) * per); f++) {
    await page.evaluate((x) => window.seek(x), f / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (w === 0 && f % 300 === 0) console.log(`worker0 ${f}/${per} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
}));
await browser.close();
fs.writeFileSync(path.join(DIR, ".build", "parts.txt"), [...Array(WORKERS).keys()].map((w) => `file '${path.join(DIR, ".build", `part${w}.mp4`)}'`).join("\n"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(DIR, ".build", "parts.txt"), "-i", path.join(DIR, "voiceover.wav"), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", path.join(DIR, "OpsDesk_Explainer.mp4")]);
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
