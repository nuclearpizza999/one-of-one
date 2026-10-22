// Proves a production build serves none of the development surfaces:
// /dev/* and /api/dev/* are 404, and the Make page and its scripts carry no dev-panel markup.
// Run after `npm run build`: node scripts/check-prod.mjs
import { spawn } from "node:child_process";

const port = 3100;
const base = `http://localhost:${port}`;
const server = spawn("npm", ["run", "start", "-w", "apps/web", "--", "--port", String(port)], { stdio: "ignore" });
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

try {
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
  server.kill();
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("production build serves no development surface");
