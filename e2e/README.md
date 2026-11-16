# End-to-end journeys

Playwright tests for the demo journeys in [`docs/journeys`](../docs/journeys/README.md).

```bash
make seed && make dev   # in one terminal
make e2e                # in another
```

`global-setup.ts` reseeds the database before the run so every journey starts from the same state. Reports land in `reports/`; screenshots from failures in `test-results/`.

`capture-video-shots.mjs` is not a test: it captures the screens used in the demo video.
