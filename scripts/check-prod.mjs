// Proves a production build serves none of the development surfaces:
// /dev/* and /api/dev/* are 404, and the Make page and its scripts carry no dev-panel markup.
// Run after `npm run build`: node scripts/check-prod.mjs
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const port = 3100;
const base = `http://localhost:${port}`;
const MARKERS = ["data-dev-panel", "Variation testing (development only)", "data-dev-gallery", "drift-border", ".dev-panel", ".gallery-cell", "/api/dev/photos"];
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

// Lazy chunks are not referenced by /make, so scan every built script and stylesheet on disk.
const staticDir = fileURLToPath(new URL("../apps/web/.next/static", import.meta.url));
const built = readdirSync(staticDir, { recursive: true }).filter((f) => /\.(js|css)$/.test(String(f)));
check(built.length > 0, `no .js or .css files found under ${staticDir}`);
for (const f of built) {
  const file = join(staticDir, String(f));
  const text = readFileSync(file, "utf8");
  for (const m of MARKERS) if (text.includes(m)) failures.push(`${file} contains dev marker ${JSON.stringify(m)}`);
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
  const exited = new Promise((resolve) => {
    server.on("exit", (code) => {
      failures.push(`production server exited early (code ${code})`);
      resolve();
    });
  });
  let died = false;
  exited.then(() => { died = true; });
  await Promise.race([waitForServer(), exited]);
  if (died) throw new Error("the production server exited before it was ready");
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
    for (const m of MARKERS) check(!js.includes(m), `${src} contains dev marker ${JSON.stringify(m)}`);
  }
} catch (e) {
  failures.push(String(e.message ?? e));
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
