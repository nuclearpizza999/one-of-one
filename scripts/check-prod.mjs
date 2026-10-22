// Proves a production build serves none of the development surfaces:
// /dev/* and /api/dev/* are 404, and the Make page and its scripts carry no dev-panel markup.
// Run after `npm run build`: node scripts/check-prod.mjs
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const port = 3100;
const base = `http://localhost:${port}`;
const markers = ["data-dev-panel", "Variation testing (development only)"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(`${base}/board`)).status === 200) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error("the production server did not start");
}

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// Lazy chunks are not referenced by /make, so scan every built script on disk.
const staticDir = "apps/web/.next/static";
const chunks = readdirSync(staticDir, { recursive: true }).filter((f) => String(f).endsWith(".js"));
check(chunks.length > 0, `no .js files found under ${staticDir}`);
for (const f of chunks) {
  const file = join(staticDir, String(f));
  const js = readFileSync(file, "utf8");
  if (markers.some((m) => js.includes(m))) failures.push(`${file} contains dev panel code`);
}

let server;
try {
  let inUse = false;
  try {
    await fetch(`${base}/board`);
    inUse = true;
  } catch {
    // nothing listening, good
  }
  if (inUse) {
    console.error("port 3100 is already in use; stop that server first");
    process.exit(1);
  }
  server = spawn("npm", ["run", "start", "-w", "apps/web", "--", "--port", String(port)], { stdio: "ignore", detached: true });
  await waitForServer();
  for (const p of ["/dev/variation", "/dev/card", "/api/dev/photos", "/api/dev/photos/seoul.jpg"]) {
    const r = await fetch(`${base}${p}`);
    check(r.status === 404, `${p} should be 404 in production, got ${r.status}`);
  }
  const make = await fetch(`${base}/make`);
  check(make.status === 200, `/make should be 200, got ${make.status}`);
  const html = await make.text();
  check(!html.includes("data-dev-panel"), "/make HTML contains the dev panel");
  const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  check(scripts.length > 0, "no scripts found on /make");
  for (const src of scripts) {
    const js = await (await fetch(src.startsWith("http") ? src : `${base}${src}`)).text();
    check(!js.includes("data-dev-panel") && !js.includes("Variation testing (development only)"), `${src} contains dev panel code`);
  }
} finally {
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already exited
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("production build serves no development surface");
