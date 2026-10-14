// Guard for the browser suites: the fixture serves ui/dist, so a stale build makes journeys fail on
// code that is not in the bundle. Exits 1 when any ui/src file is newer than ui/dist, with the fix.
// Wired into the Playwright webServer command; `make verify` builds first and never trips it.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const newest = dir =>
  readdirSync(dir, { withFileTypes: true }).reduce(
    (max, e) =>
      Math.max(
        max,
        e.isDirectory()
          ? newest(join(dir, e.name))
          : /\.(tsx?|css)$/.test(e.name)
            ? statSync(join(dir, e.name)).mtimeMs
            : 0,
      ),
    0,
  );

let distTime = 0;
try {
  distTime = statSync(join(root, "dist", "index.html")).mtimeMs;
} catch {
  console.error("ui/dist is missing: run `npm run build` before the browser suites.");
  process.exit(1);
}
if (newest(join(root, "src")) > distTime) {
  console.error("ui/dist is older than ui/src: run `npm run build` first — the journeys would test a stale bundle.");
  process.exit(1);
}
