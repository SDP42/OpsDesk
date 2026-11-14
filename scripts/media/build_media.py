"""Media pipeline (spec section 12): fetch licensed clips, cut frames, write manifest/palette/credits.

    make media                 # download (if needed) and build everything
    make media ARGS=--offline  # only use clips already in scripts/media/raw/

Only clips whose licence allows free commercial use without a watermark are used.
If a download is blocked, put the files listed in SOURCES into scripts/media/raw/
by hand (same filenames) and run `make media` again. If nothing is available the
landing page falls back to the procedural GLSL night-runway scene.
"""

from __future__ import annotations

import base64
import io
import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "scripts/media/raw"
PUBLIC = ROOT / "apps/web/public"
VIDEO = PUBLIC / "video"
FRAMES = PUBLIC / "frames"

MIXKIT_LICENSE = "https://mixkit.co/license/#videoFree"

# role, raw filename, Mixkit id, page slug, title
SOURCES = [
    ("hero", "hero.mp4", 7374, "airplane-landing-in-illuminated-airport-tracks-7374",
     "Airplane landing in illuminated airport tracks"),
    ("seqA", "seqA.mp4", 28019, "taking-off-into-the-night-28019", "Taking off into the night"),
    ("seqB", "seqB.mp4", 40102, "panorama-from-the-window-of-an-airplane-at-dusk-40102",
     "Panorama from the window of an airplane at dusk"),
    ("radar", "radar.mp4", 28009, "radar-at-the-edge-of-an-airport-28009",
     "Radar at the edge of an airport"),
    # One full-bleed scroll-scrubbed backdrop per landing scene (Problems 1-6).
    ("gate", "gate.mp4", 23269, "angry-passengers-in-the-airplane-boarding-gates-23269",
     "Angry passengers in the airplane boarding gates"),
    ("city", "city.mp4", 42342, "aerial-shot-of-a-city-at-night-42342", "Aerial shot of a city at night"),
    ("taxi", "taxi.mp4", 27993, "busy-runway-in-the-evening-27993", "Busy runway in the evening"),
    ("sunrise", "sunrise.mp4", 27989, "airplane-taking-off-from-an-airport-at-sunrise-27989",
     "Airplane taking off from an airport at sunrise"),
    ("cockpit", "cockpit.mp4", 6753, "cockpit-view-of-pilot-landing-commercial-plane-6753",
     "Cockpit view of pilot landing commercial plane"),
    ("clouds", "clouds.mp4", 17999, "plane-flying-through-clouds-17999", "Plane flying through clouds"),
    ("baggage", "baggage.mp4", 27752, "baggage-claim-inside-a-modern-airport-27752",
     "Baggage claim inside a modern airport"),
    ("checkin", "checkin.mp4", 23976, "checking-in-at-the-airport-counter-23976",
     "Checking in at the airport counter"),
]

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) OpsDeskMedia/1.0"
MAX_FRAMES = 110


def log(msg: str) -> None:
    print(f"  [media] {msg}", flush=True)


def ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        sys.exit("ffmpeg not found: install it (brew install ffmpeg / apt install ffmpeg)")
    return exe


def run(*args: str) -> None:
    subprocess.run([ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def has_libwebp() -> bool:
    out = subprocess.run([ffmpeg(), "-hide_banner", "-encoders"], capture_output=True, text=True)
    return "libwebp" in out.stdout


def png_to_webp(src_dir: Path, dest_dir: Path, quality: int) -> None:
    """Convert extracted PNG frames to WebP with Pillow (fallback when ffmpeg lacks libwebp)."""
    from PIL import Image

    for png in sorted(src_dir.glob("*.png")):
        with Image.open(png) as im:
            im.convert("RGB").save(dest_dir / (png.stem + ".webp"), "WEBP", quality=quality, method=6)
        png.unlink()


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip() or 10)


def download(clip_id: int, dest: Path) -> bool:
    for quality in (720, 1080):
        url = f"https://assets.mixkit.co/videos/{clip_id}/{clip_id}-{quality}.mp4"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r, dest.open("wb") as f:
                shutil.copyfileobj(r, f)
            if dest.stat().st_size > 100_000:
                log(f"downloaded {dest.name} ({quality}p, {dest.stat().st_size / 1e6:.1f} MB)")
                return True
        except Exception as exc:  # noqa: BLE001
            log(f"download failed for {url}: {exc}")
    dest.unlink(missing_ok=True)
    return False


def build_hero(src: Path) -> None:
    VIDEO.mkdir(parents=True, exist_ok=True)
    run("-i", str(src), "-t", "12", "-an", "-vf", "scale=1920:-2,fps=30", "-c:v", "libx264",
        "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(VIDEO / "hero.mp4"))
    run("-i", str(src), "-t", "12", "-an", "-vf", "scale=1920:-2,fps=30", "-c:v", "libvpx-vp9",
        "-crf", "36", "-b:v", "0", "-row-mt", "1", str(VIDEO / "hero.webm"))
    if has_libwebp():
        run("-ss", "1", "-i", str(src), "-frames:v", "1", "-vf", "scale=1280:-2", "-c:v", "libwebp",
            "-quality", "62", str(VIDEO / "hero-poster.webp"))
    else:
        run("-ss", "1", "-i", str(src), "-frames:v", "1", "-vf", "scale=1280:-2",
            str(VIDEO / "hero-poster.png"))
        png_to_webp(VIDEO, VIDEO, 62)
    log(f"hero: mp4 {(VIDEO / 'hero.mp4').stat().st_size / 1e6:.1f} MB, poster "
        f"{(VIDEO / 'hero-poster.webp').stat().st_size / 1e3:.0f} KB")


def build_sequence(name: str, src: Path) -> dict[str, object]:
    out = FRAMES / name
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    duration = min(probe_duration(src), 14.0)
    fps = max(4.0, min(12.0, MAX_FRAMES / duration))
    if has_libwebp():
        run("-t", f"{duration:.2f}", "-i", str(src), "-vf", f"fps={fps:.3f},scale=1280:-2",
            "-c:v", "libwebp", "-quality", "60", str(out / "f_%04d.webp"))
    else:
        run("-t", f"{duration:.2f}", "-i", str(src), "-vf", f"fps={fps:.3f},scale=1280:-2",
            str(out / "f_%04d.png"))
        png_to_webp(out, out, 58)
    files = sorted(out.glob("f_*.webp"))
    from PIL import Image

    with Image.open(files[0]) as im:
        width, height = im.size
        thumb = im.copy()
        thumb.thumbnail((24, 24))
        buf = io.BytesIO()
        thumb.save(buf, "WEBP", quality=40)
    total = sum(f.stat().st_size for f in files)
    log(f"{name}: {len(files)} frames @ {fps:.1f} fps, {total / 1e6:.1f} MB")
    return {
        "id": name, "count": len(files), "width": width, "height": height,
        "pattern": f"/frames/{name}/f_{{i}}.webp", "pad": 4,
        "blur": "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode(),
    }


def palette(paths: list[Path]) -> dict[str, object]:
    """Sample frames, extract dominant colours and suggest --ink-* tints."""
    from PIL import Image

    pixels: list[tuple[int, int, int]] = []
    for p in paths:
        with Image.open(p) as im:
            small = im.convert("RGB").resize((64, 36))
            pixels.extend(small.get_flattened_data())  # type: ignore[attr-defined]
    img = Image.new("RGB", (len(pixels), 1))
    img.putdata(pixels)
    quant = img.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    pal = quant.getpalette() or []
    counts = sorted(quant.getcolors() or [], reverse=True)
    colours = []
    for count, idx in counts:
        r, g, b = pal[idx * 3 : idx * 3 + 3]
        colours.append({"hex": f"#{r:02x}{g:02x}{b:02x}", "share": round(count / len(pixels), 3)})
    darkest = min(colours, key=lambda c: sum(int(c["hex"][i : i + 2], 16) for i in (1, 3, 5)))
    return {"dominant": colours, "ink_tint": darkest["hex"],
            "css": f":root {{ --footage-ink: {darkest['hex']}; }}"}


def main() -> None:
    offline = "--offline" in sys.argv
    RAW.mkdir(parents=True, exist_ok=True)
    FRAMES.mkdir(parents=True, exist_ok=True)
    credits = []
    available: dict[str, Path] = {}
    for role, filename, clip_id, slug, title in SOURCES:
        dest = RAW / filename
        if not dest.exists() and not offline:
            download(clip_id, dest)
        if dest.exists():
            available[role] = dest
            credits.append({"role": role, "title": title, "source": "Mixkit",
                            "url": f"https://mixkit.co/free-stock-video/{slug}/",
                            "license": "Mixkit Stock Video Free License", "license_url": MIXKIT_LICENSE})
        else:
            log(f"MISSING {filename}: download https://mixkit.co/free-stock-video/{slug}/ "
                f"and save it as scripts/media/raw/{filename}")

    manifest: dict[str, object] = {"sequences": []}
    if "hero" in available:
        build_hero(available["hero"])
    for name, role in (("a", "seqA"), ("b", "seqB"), ("radar", "radar"), ("gate", "gate"), ("city", "city"),
                       ("taxi", "taxi"), ("sunrise", "sunrise"), ("cockpit", "cockpit"), ("clouds", "clouds"),
                       ("baggage", "baggage"), ("checkin", "checkin")):
        if role in available:
            manifest["sequences"].append(build_sequence(name, available[role]))  # type: ignore[union-attr]
    if not available:
        log("no footage available: the landing page will use the procedural GLSL night runway")

    samples = []
    for seq in manifest["sequences"]:  # type: ignore[union-attr]
        files = sorted((FRAMES / seq["id"]).glob("f_*.webp"))
        samples += files[:: max(1, len(files) // 3)][:3]
    if samples:
        (PUBLIC / "palette.json").write_text(json.dumps(palette(samples[:5]), indent=2))
    (FRAMES / "manifest.json").write_text(json.dumps(manifest, indent=2))
    (PUBLIC / "credits.json").write_text(json.dumps(credits, indent=2))
    log(f"wrote manifest ({len(manifest['sequences'])} sequences), palette and credits")  # type: ignore[arg-type]


if __name__ == "__main__":
    main()
