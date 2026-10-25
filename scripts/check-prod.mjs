// Proves a production build serves none of the development surfaces:
// /dev/* and /api/dev/* are 404, the built scripts and styles carry no gallery or dev-card markup,
// and no built file (browser or server) carries the local sign-in bypass.
// The design panel ships by design (founders only, Oct 24, 2026); a signed-out page never renders it.
// Run after `npm run build`: node scripts/check-prod.mjs
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const port = 3100;
const base = `http://localhost:${port}`;
const MARKERS = ["data-dev-gallery", "drift-border", ".gallery-cell", "/api/dev/photos", "/api/dev/signin", "dev@one-of-one.local", "DEV_SIGNIN_PASSWORD"];
// The sign-in bypass must be absent from the server bundles too (proxy, pages, route handlers), not only from the browser's.
// The route's own path is left out of this list: the build keeps an /api/dev/signin entry (answering 404) in its manifests.
const SERVER_MARKERS = ["dev@one-of-one.local", "DEV_SIGNIN_PASSWORD"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      // Signed out, /board redirects; do not follow it, so the wait does not depend on /signin existing.
      const r = await fetch(`${base}/board`, { redirect: "manual" });
      if (r.ok || r.status === 307) return;
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

const serverDir = fileURLToPath(new URL("../apps/web/.next/server", import.meta.url));
const serverBuilt = readdirSync(serverDir, { recursive: true }).filter((f) => /\.(js|json|html|rsc)$/.test(String(f)));
check(serverBuilt.length > 0, `no server files found under ${serverDir}`);
for (const f of serverBuilt) {
  const file = join(serverDir, String(f));
  const text = readFileSync(file, "utf8");
  for (const m of SERVER_MARKERS) if (text.includes(m)) failures.push(`${file} contains dev marker ${JSON.stringify(m)}`);
}

let server;
let stopping = false;
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
  server = spawn("npm", ["run", "start", "-w", "apps/web", "--", "--port", String(port)], {
    stdio: "ignore",
    detached: true,
    env: {
      ...process.env,
      // The production server must boot to be probed; it never talks to Supabase during this check.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-for-the-production-check",
    },
  });
  const exited = new Promise((resolve) => {
    server.on("exit", (code) => {
      if (!stopping) failures.push(`production server exited early (code ${code})`);
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
  const devSignin = await fetch(`${base}/api/dev/signin`, { method: "POST" });
  check(devSignin.status === 404, `POST /api/dev/signin should be 404 in production, got ${devSignin.status}`);
  check(devSignin.headers.getSetCookie().length === 0, "POST /api/dev/signin set a cookie in production");
  const make = await fetch(`${base}/make`);
  check(make.redirected && new URL(make.url).pathname === "/signin", `/make should redirect to /signin when signed out, got ${make.status} at ${make.url}`);
  const place = await fetch(`${base}/api/place`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  check(place.status === 401, `/api/place should be 401 when signed out, got ${place.status}`);
  const signin = await fetch(`${base}/signin`);
  check(signin.status === 200, `/signin should be 200, got ${signin.status}`);
  const html = await signin.text();
  check(!html.includes("data-design-panel"), "/signin HTML contains the design panel");
  const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  check(scripts.length > 0, "no scripts found on /signin");
  for (const src of scripts) {
    const js = await (await fetch(src.startsWith("http") ? src : `${base}${src}`)).text();
    for (const m of MARKERS) check(!js.includes(m), `${src} contains dev marker ${JSON.stringify(m)}`);
  }
} catch (e) {
  failures.push(String(e.message ?? e));
} finally {
  if (server) {
    stopping = true;
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
