import { execSync } from "node:child_process";
import path from "node:path";

/** Fresh, deterministic demo world before the journeys (the running API keeps working). */
export default function globalSetup() {
  if (process.env.E2E_SKIP_SEED) return;
  execSync("uv run python -m app.db.seed.seed", {
    cwd: path.resolve(__dirname, "../apps/api"),
    stdio: "inherit",
  });
}
