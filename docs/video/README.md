# Demo video

The 4-minute narrated explainer ([watch on Google Drive](https://drive.google.com/drive/folders/1E1uyaZgydQRglXeVXrytohNdNHtkvjsT?usp=sharing)) is generated, not hand-edited.

| Step | File | What it does |
| --- | --- | --- |
| 1 | `e2e/capture-video-shots.mjs` | Signs in as each persona and captures 1080p screens of the running app into `shots/` |
| 2 | `scenes.mjs` | The script: 30 scenes with narration, highlighted caption words and callouts |
| 3 | `build.mjs` | Generates the voiceover with edge-tts (en-US-AndrewNeural), reads word timings, and writes `composition.html` |
| 4 | `render.mjs` | Seeks the composition frame by frame in Playwright and pipes JPEGs into ffmpeg, then muxes the voiceover |

```bash
make dev                                   # app running for the screen captures
cd e2e && node capture-video-shots.mjs
node ../docs/video/build.mjs
node ../docs/video/render.mjs --workers 5  # writes docs/video/OpsDesk_Explainer.mp4
```

Animations are CSS keyframes with absolute delays, paused and seeked with `document.getAnimations()`, so every frame is deterministic.
