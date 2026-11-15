// Generates the voiceover (edge-tts), measures every scene, and writes composition.html + voiceover.wav.
// Run: node docs/video/build.mjs   (needs uvx and ffmpeg on PATH)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scenes, VOICE, RATE } from "./scenes.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(DIR, ".build");
fs.mkdirSync(TMP, { recursive: true });
const LEAD = 0.35, TAIL = 0.55;

// ---------------------------------------------------------------- 1. voice + timing
const dur = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const vttTime = (s) => { const [h, m, r] = s.split(":"); return +h * 3600 + +m * 60 + parseFloat(r.replace(",", ".")); };
let t = 0;
const timed = scenes.map((sc, i) => {
  const mp3 = path.join(TMP, `s${i}.mp3`), vtt = path.join(TMP, `s${i}.srt`);
  if (!fs.existsSync(mp3) || fs.readFileSync(path.join(TMP, `s${i}.txt`), { flag: "a+" }).toString() !== sc.say) {
    for (let attempt = 1; ; attempt++) {
      try { execFileSync("uvx", ["edge-tts", "--voice", VOICE, `--rate=${RATE}`, "--text", sc.say, "--write-media", mp3, "--write-subtitles", vtt], { stdio: "ignore" }); break; }
      catch (err) { if (attempt === 4) throw err; execFileSync("sleep", [String(attempt * 2)]); }
    }
    fs.writeFileSync(path.join(TMP, `s${i}.txt`), sc.say);
  }
  const a = dur(mp3);
  const cues = fs.readFileSync(vtt, "utf8").split(/\r?\n\r?\n/).map((b) => b.trim().split(/\r?\n/)).filter((l) => l.length >= 3)
    .map((l) => { const [s, e] = l[1].split(" --> ").map(vttTime); return { s, e, text: l.slice(2).join(" ") }; });
  const d = Math.max(a + LEAD + TAIL, 3.2);
  const out = { ...sc, i, start: t, dur: d, audio: a, cues };
  t += d;
  return out;
});
const TOTAL = t;

// Voiceover: each clip padded to its scene, then concatenated.
const list = timed.map((sc) => {
  const w = path.join(TMP, `p${sc.i}.wav`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(TMP, `s${sc.i}.mp3`), "-af", `adelay=${Math.round(LEAD * 1000)}:all=1,apad,atrim=0:${sc.dur.toFixed(3)}`, "-ar", "48000", "-ac", "2", w]);
  return `file '${w}'`;
});
fs.writeFileSync(path.join(TMP, "list.txt"), list.join("\n"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(TMP, "list.txt"), "-c", "copy", path.join(DIR, "voiceover.wav")]);

// ---------------------------------------------------------------- 2. composition
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const A = (name, at, d = 0.7, ease = "cubic-bezier(.2,.8,.2,1)") => `${name} ${d}s ${ease} ${at.toFixed(3)}s both`;
const S = 0.84, OX = (1920 - 1920 * S) / 2, OY = 58; // screenshot placement
const map = ([x, y]) => [OX + x * S, OY + y * S];

const caption = (sc) => sc.cues.map((c, k) => {
  let txt = esc(c.text);
  for (const w of sc.hl ?? []) txt = txt.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"), "<b>$1</b>");
  const s = sc.start + LEAD + c.s, e = sc.start + LEAD + (sc.cues[k + 1] ? sc.cues[k + 1].s : Math.min(c.e + 0.4, sc.dur - LEAD));
  return `<div class="cap" style="animation:${A("capIn", s, 0.25)},${A("capOut", e - 0.15, 0.15, "linear").replace(" both", " forwards")}"><span>${txt}</span></div>`;
}).join("");

const tagEl = (sc, at) => sc.tag ? `<div class="tag" style="animation:${A("slideR", at)}"><i>${esc(sc.tag.split(" · ")[0])}</i>${esc(sc.tag.split(" · ").slice(1).join(" · ") || sc.tag)}<em>${esc(sc.route ?? "")}</em></div>` : "";

const callouts = (sc, at) => (sc.callouts ?? []).map((c, k) => {
  const d = at + 1.0 + k * Math.min(1.6, (sc.dur - 2.5) / Math.max(1, sc.callouts.length));
  let svg = "";
  if (c.at) {
    const [px, py] = map(c.at), bx = c.box[0] + 210, by = c.box[1] + 4;
    svg = `<svg class="lead" viewBox="0 0 1920 1080"><line x1="${bx}" y1="${by}" x2="${px}" y2="${py}" style="animation:${A("draw", d + 0.2, 0.6)}"/></svg>
      <div class="ring" style="left:${px - 26}px;top:${py - 26}px;animation:${A("pop", d, 0.5)}"></div>`;
  }
  return `${svg}<div class="call" style="left:${c.box[0]}px;top:${c.box[1]}px;animation:${A("callIn", d, 0.55)}"><h4>${esc(c.t)}</h4><p>${esc(c.b)}</p></div>`;
}).join("");

const body = (sc) => {
  const a = sc.start;
  switch (sc.type) {
    case "kinetic":
      return `<div class="kin">${sc.lines.map(([l, cls], k) => `<div class="kl ${cls}" style="animation:${A("rise", a + 0.3 + k * 0.9, 0.9)}">${esc(l)}</div>`).join("")}</div>`;
    case "cards":
      return `<div class="center"><div class="kick" style="animation:${A("fadeUp", a + 0.2)}">${esc(sc.kicker)}</div>
        <h2 class="h2" style="animation:${A("rise", a + 0.35, 0.8)}">${esc(sc.title)}</h2>
        <div class="cards">${sc.cards.map(([h, p], k) => `<div class="card" style="animation:${A("cardIn", a + 0.9 + k * 0.7, 0.7)}"><i>${String(k + 1).padStart(2, "0")}</i><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("")}</div></div>`;
    case "stamps":
      return `<div class="stamps">${sc.stamps.map((w, k) => `<div class="stamp s${k}" style="animation:${A("stamp", a + 0.4 + k * (sc.dur - 1.5) / sc.stamps.length, 0.45, "cubic-bezier(.3,1.6,.5,1)")}">${esc(w)}</div>`).join("")}</div>`;
    case "brand":
      return `<div class="center"><div class="mark" style="animation:${A("pop", a + 0.2, 0.7)}"><span></span></div>
        <h1 class="brand" style="animation:${A("rise", a + 0.5, 0.9)}">OpsDesk <em>Control Tower</em></h1>
        <div class="rule" style="animation:${A("wipe", a + 1.2, 0.8)}"></div>
        <div class="tagline" style="animation:${A("fadeUp", a + 1.6)}">Every ticket is a <em>flight</em>. &nbsp;Tracked · Routed · On time.</div></div>`;
    case "shots": {
      const n = sc.imgs.length, step = (sc.dur - 0.4) / n;
      return `${tagEl(sc, a + 0.1)}<div class="frame">${sc.imgs.map((im, k) => `<img src="shots/${im}.png" style="animation:${A("xfade", a + k * step, 0.6)},${A("kb", a + k * step, step + 0.8, "linear")}">`).join("")}</div>`;
    }
    case "shot":
      return `${tagEl(sc, a + 0.1)}<div class="frame"><img src="shots/${sc.img}.png" style="animation:${A("kb2", a, sc.dur, "linear")}"></div>${callouts(sc, a)}`;
    case "arch": {
      const row = (y, k, color, title, sub) => `<div class="node" style="top:${y}px;border-color:${color};animation:${A("cardIn", a + 0.4 + k * 0.9, 0.6)}"><b style="color:${color}">${title}</b><span>${sub}</span></div>`;
      const arr = (y, k, label) => `<div class="arr" style="top:${y}px;animation:${A("drop", a + 0.85 + k * 0.9, 0.5)}"><i></i><span>${label}</span></div>`;
      return `<div class="kick abs" style="animation:${A("fadeUp", a + 0.1)}">Under the hood · system architecture</div>
        ${row(150, 0, "#0D1117", "CLIENTS", "Landing · Tower · Pilot · Partner · Wall Mode · Tower Radio · ⌘K")}
        ${arr(262, 0, "HTTPS · httpOnly JWT cookie")}
        ${row(330, 1, "#6F4CF6", "EDGE · Next.js 15", "same-origin /api proxy · SSE pass-through · security headers")}
        ${arr(442, 1, "REST + Server-Sent Events")}
        ${row(510, 2, "#FF5A1F", "API · FastAPI + Pydantic v2", "RBAC · tickets · links · frequencies · partner · insights · export · stream")}
        <div class="side" style="animation:${A("cardIn", a + 3.2, 0.6)}"><b>EXTERNAL</b><span>Darwinbox HRMS<br>Supplier partners<br>Holiday calendars</span></div>
        ${arr(622, 2, "pure function calls · SQL")}
        <div class="trio">${[["ENGINES", "#C98F00", "16 pure engines, each returns a reason"], ["DATA", "#2D5BFF", "SQLite WAL / PostgreSQL · Alembic · audit log"], ["JOBS", "#0C9F6A", "SLA tick every 60 s → live push"]].map(([h, c, p], k) => `<div class="node sm" style="border-color:${c};animation:${A("cardIn", a + 3.0 + k * 0.4, 0.6)}"><b style="color:${c}">${h}</b><span>${p}</span></div>`).join("")}</div>`;
    }
    case "engines": {
      const e = ["Vectoring", "Wheels-Up SLA", "Linker", "Intent", "Weather", "Ghosts", "Forecast", "Storms", "Roster", "Follow-the-Sun", "Frustration", "Promises", "Simulator", "Ask the Tower", "Co-pilot", "Tower Radio"];
      return `<div class="center"><div class="kick" style="animation:${A("fadeUp", a + 0.1)}">Pure engines · no database, no network</div>
        <h2 class="h2" style="animation:${A("rise", a + 0.25, 0.8)}">16 engines. <em>Every output has a reason.</em></h2>
        <div class="grid16">${e.map((n, k) => `<div class="eng" style="animation:${A("pop", a + 0.9 + k * 0.22, 0.45)}">${n}</div>`).join("")}</div>
        <div class="why" style="animation:${A("fadeUp", a + Math.min(5.2, sc.dur - 2))}">“Routed to Omar: region match UAE +40 · P1 urgency +30 · on shift +15 · lowest load +8”</div></div>`;
    }
    case "stack": {
      const g = [["Backend", "#FF5A1F", ["Python 3.12", "FastAPI", "Pydantic v2", "SQLAlchemy 2", "Alembic", "APScheduler"]], ["AI / ML", "#6F4CF6", ["MiniLM (ONNX)", "scikit-learn", "VADER", "NumPy", "networkx"]], ["Frontend", "#2D5BFF", ["Next.js 15", "React 19", "Tailwind 4", "React Three Fiber", "GSAP"]], ["Data · Quality", "#0C9F6A", ["SQLite / Postgres", "Darwinbox", "pytest", "Playwright", "Lighthouse 97"]]];
      let k = 0;
      return `<div class="center"><div class="kick" style="animation:${A("fadeUp", a + 0.1)}">Tech stack · free, open source, CPU only</div>
        <div class="stack">${g.map(([h, c, items]) => `<div class="srow"><b style="color:${c}">${h}</b>${items.map((it) => `<span class="chip" style="border-color:${c};animation:${A("pop", a + 0.5 + k++ * 0.17, 0.4)}">${it}</span>`).join("")}</div>`).join("")}</div></div>`;
    }
    case "stats":
      return `<div class="center"><div class="kick" style="animation:${A("fadeUp", a + 0.1)}">Impact · measured on the prototype</div>
        <div class="stats">${[["0", "repeat explanations", "#DF1C47"], ["< 1 s", "to escalate", "#FF5A1F"], ["76 → 88%", "intent accuracy", "#2D5BFF"], ["60K+", "rows per export", "#0C9F6A"]].map(([v, l, c], k) => `<div class="stat" style="animation:${A("cardIn", a + 0.5 + k * 1.2, 0.6)}"><b style="color:${c}">${v}</b><span>${l}</span></div>`).join("")}</div></div>`;
    case "end":
      return `<div class="center"><div class="mark" style="animation:${A("pop", a + 0.1, 0.6)}"><span></span></div>
        <h1 class="brand" style="animation:${A("rise", a + 0.3, 0.8)}">OpsDesk <em>Control Tower</em></h1>
        <div class="stamps2">${["LINKED", "VECTORED", "ON TIME"].map((w, k) => `<div class="stamp sm" style="animation:${A("stamp", a + 1.4 + k * 0.6, 0.45, "cubic-bezier(.3,1.6,.5,1)")}">${w}</div>`).join("")}</div>
        <div class="team" style="animation:${A("fadeUp", a + 3.4)}">Swayam Panchal · Jeevesh Bodhani · Rishit Lahoti · Shreyas Kale</div>
        <div class="college" style="animation:${A("fadeUp", a + 3.8)}">Dept. of AI &amp; Data Science · Dwarkadas J. Sanghvi College of Engineering · TBO VoyageHack · PS3</div>
        <div class="gh" style="animation:${A("fadeUp", a + 4.2)}">github.com/SDP42/OpsDesk</div></div>`;
  }
  return "";
};

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500;600&display=block" rel="stylesheet">
<style>
:root{--ink:#0D1117;--paper:#F4F1EA;--beacon:#FF5A1F;--taxi:#FFC629;--dim:#5A6270;--line:#D8D2C4}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden;background:var(--paper);font-family:Geist,sans-serif;color:var(--ink)}
body{background-image:linear-gradient(rgba(13,17,23,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(13,17,23,.045) 1px,transparent 1px);background-size:48px 48px}
.scene{position:absolute;inset:0;opacity:0}
.progress{position:absolute;left:0;top:0;height:6px;background:var(--beacon);transform-origin:left;animation:grow ${TOTAL}s linear 0s both;z-index:50}
.center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-bottom:90px}
.kick{font:600 22px Geist Mono;letter-spacing:.22em;text-transform:uppercase;color:var(--beacon)}
.kick.abs{position:absolute;top:70px;left:0;right:0;text-align:center}
.h2{font:400 104px/1 'Instrument Serif';margin-top:18px}.h2 em{color:var(--beacon)}
.kin{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 180px 80px}
.kl{font:400 128px/1.05 'Instrument Serif'}.kl.mono{font:600 56px Geist Mono;color:var(--beacon);letter-spacing:.06em;margin-bottom:24px}.kl.accent{font-style:italic;color:var(--beacon)}
.cards{display:flex;gap:36px;margin-top:64px}
.card{width:440px;background:#fff;border:1px solid var(--line);border-top:6px solid var(--beacon);padding:34px 34px 38px;text-align:left;box-shadow:0 18px 40px -24px rgba(13,17,23,.35)}
.card:nth-child(2){border-top-color:#2D5BFF}.card:nth-child(3){border-top-color:#0C9F6A}
.card i{font:600 20px Geist Mono;color:var(--dim)}.card h3{font:600 38px Geist;margin:14px 0 10px}.card p{font:400 26px/1.4 Geist;color:var(--dim)}
.stamps{position:absolute;inset:0}
.stamp{position:absolute;font:700 64px Geist Mono;letter-spacing:.06em;color:#DF1C47;border:7px solid #DF1C47;padding:10px 30px;border-radius:10px;background:rgba(255,255,255,.4)}
.s0{left:180px;top:170px;transform:rotate(-6deg)}.s1{right:170px;top:300px;transform:rotate(4deg)}.s2{left:260px;top:520px;transform:rotate(3deg)}.s3{right:260px;top:640px;transform:rotate(-5deg)}
.stamp.sm{position:static;font-size:40px;border-width:5px;color:var(--beacon);border-color:var(--beacon);padding:6px 22px}
.stamps2{display:flex;gap:34px;margin:34px 0 10px}
.mark{width:120px;height:120px;border-radius:30px;background:var(--ink);display:grid;place-items:center;margin-bottom:30px}
.mark span{width:52px;height:52px;border-radius:50%;border:8px solid var(--taxi);box-shadow:0 0 0 10px rgba(255,198,41,.18)}
.brand{font:400 150px/1 'Instrument Serif'}.brand em{color:var(--beacon)}
.rule{width:220px;height:6px;background:var(--ink);margin:34px 0 26px}
.tagline{font:500 36px Geist;color:var(--dim)}.tagline em{font-family:'Instrument Serif';font-size:46px;color:var(--beacon)}
.frame{position:absolute;left:${OX}px;top:${OY}px;width:${1920 * S}px;height:${1080 * S}px;overflow:hidden;border-radius:18px;border:1px solid var(--line);box-shadow:0 40px 80px -40px rgba(13,17,23,.5);background:#fff}
.frame img{position:absolute;left:0;top:0;width:100%;transform-origin:50% 30%}
.tag{position:absolute;left:${OX}px;top:14px;font:600 20px Geist Mono;letter-spacing:.14em;display:flex;gap:14px;align-items:center;z-index:5}
.tag i{font-style:normal;background:var(--ink);color:var(--taxi);padding:5px 12px;border-radius:6px}.tag em{font-style:normal;color:var(--dim);letter-spacing:.04em}
.call{position:absolute;width:420px;background:var(--ink);color:#fff;padding:20px 24px 22px;border-radius:12px;border-left:6px solid var(--taxi);box-shadow:0 24px 50px -20px rgba(0,0,0,.55);z-index:6}
.call h4{font:600 20px Geist Mono;letter-spacing:.12em;text-transform:uppercase;color:var(--taxi)}.call p{font:400 24px/1.35 Geist;margin-top:8px;color:#E6E9EE}
.lead{position:absolute;inset:0;width:1920px;height:1080px;z-index:5;pointer-events:none}
.lead line{stroke:var(--taxi);stroke-width:4;stroke-dasharray:1400;stroke-dashoffset:1400}
.ring{position:absolute;width:52px;height:52px;border-radius:50%;border:5px solid var(--taxi);background:rgba(255,198,41,.25);z-index:6}
.node{position:absolute;left:330px;width:1260px;height:100px;background:#fff;border:2px solid;border-left-width:12px;border-radius:12px;padding:16px 28px;text-align:left;display:flex;flex-direction:column;justify-content:center}
.node b{font:600 26px Geist Mono;letter-spacing:.1em}.node span{font:400 26px Geist;color:var(--dim);margin-top:4px}
.arr{position:absolute;left:330px;width:1260px;height:60px;display:flex;align-items:center;justify-content:center;gap:18px}
.arr i{width:4px;height:52px;background:var(--ink);position:relative}.arr i:after{content:"";position:absolute;left:-10px;bottom:-6px;border:12px solid transparent;border-top:16px solid var(--ink);border-bottom:0}
.arr span{font:500 22px Geist Mono;color:var(--dim);font-style:italic}
.side{position:absolute;left:1620px;top:500px;width:260px;background:#E2F4EC;border:2px solid #0C9F6A;border-radius:12px;padding:16px 20px;text-align:left}
.side b{font:600 22px Geist Mono;color:#0C9F6A}.side span{display:block;font:400 22px/1.4 Geist;margin-top:6px}
.trio{position:absolute;left:330px;top:690px;width:1260px;display:flex;gap:30px}
.node.sm{position:static;width:400px;height:150px}
.grid16{display:grid;grid-template-columns:repeat(4,330px);gap:18px;margin-top:50px}
.eng{background:#fff;border:2px solid var(--ink);border-radius:12px;padding:18px;font:600 28px Geist;box-shadow:6px 6px 0 var(--taxi)}
.why{margin-top:44px;font:400 30px Geist Mono;color:var(--dim);background:#fff;border:1px dashed var(--beacon);padding:16px 26px;border-radius:10px}
.stack{margin-top:50px;display:flex;flex-direction:column;gap:26px;align-items:flex-start}
.srow{display:flex;gap:16px;align-items:center}.srow b{width:260px;text-align:right;font:600 24px Geist Mono;letter-spacing:.1em;text-transform:uppercase;margin-right:12px}
.chip{background:#fff;border:2px solid;border-radius:999px;padding:12px 26px;font:500 30px Geist}
.stats{display:flex;gap:34px;margin-top:60px}
.stat{width:390px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:36px 30px;box-shadow:0 18px 40px -24px rgba(13,17,23,.35)}
.stat b{display:block;font:400 104px/1 'Instrument Serif'}.stat span{display:block;margin-top:14px;font:500 28px Geist;color:var(--dim)}
.team{font:600 36px Geist;margin-top:20px}.college{font:400 26px Geist;color:var(--dim);margin-top:12px}.gh{font:600 28px Geist Mono;color:#2D5BFF;margin-top:18px}
.cap{position:absolute;left:0;right:0;bottom:30px;text-align:center;opacity:0;z-index:20}
.cap span{display:inline-block;max-width:1500px;background:rgba(13,17,23,.88);color:#fff;font:500 30px/1.35 Geist;padding:10px 24px;border-radius:10px}
.cap b{color:var(--taxi);font-weight:600}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes sIn{from{opacity:0}to{opacity:1}}@keyframes sOut{from{opacity:1}to{opacity:0}}
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes rise{from{opacity:0;transform:translateY(60px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes cardIn{from{opacity:0;transform:translateY(50px) scale(.96)}to{opacity:1;transform:none}}
@keyframes callIn{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
@keyframes slideR{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@keyframes stamp{from{opacity:0;scale:1.8}to{opacity:1;scale:1}}
@keyframes wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes drop{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:none}}
@keyframes xfade{from{opacity:0}to{opacity:1}}
@keyframes kb{from{transform:scale(1.0)}to{transform:scale(1.07)}}
@keyframes kb2{from{transform:scale(1.0)}to{transform:scale(1.04)}}
@keyframes capIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes capOut{from{opacity:1}to{opacity:0}}
</style></head><body><div class="progress"></div>
${timed.map((sc) => `<section class="scene" style="animation:${A("sIn", sc.start, 0.45, "ease")},${A("sOut", sc.start + sc.dur - 0.3, 0.3, "ease").replace(" both", " forwards")}">${body(sc)}</section>${caption(sc)}`).join("\n")}
<script>window.TOTAL=${TOTAL};window.seek=(t)=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t*1000;}};</script>
</body></html>`;
fs.writeFileSync(path.join(DIR, "composition.html"), html);
console.log(`scenes ${timed.length}, total ${TOTAL.toFixed(1)} s`);
