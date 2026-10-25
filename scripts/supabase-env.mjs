// Writes apps/web/.env.local from the running local Supabase stack, so the dev server and the e2e tests talk to it,
// and creates or updates the local dev account (a founder) that the development sign-in bypass signs into.
// Run: node scripts/supabase-env.mjs   (after `npx supabase start`)
// Local stack only: it refuses any API URL whose host is not 127.0.0.1 or localhost. The service-role key stays
// in this script's memory; only the two public values and the dev password are written to .env.local.
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEV_EMAIL = "dev@one-of-one.local";

const out = execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8" });
const get = (name) => {
  const m = new RegExp(`^${name}="?([^"\\n]+)"?$`, "m").exec(out);
  if (!m) throw new Error(`${name} not in supabase status output`);
  return m[1];
};
const either = (a, b) => { try { return get(a); } catch { return get(b); } };
const url = get("API_URL");
const host = new URL(url).hostname;
if (host !== "127.0.0.1" && host !== "localhost") {
  console.error(`refusing: ${url} is not the local stack (host must be 127.0.0.1 or localhost)`);
  process.exit(1);
}
const key = either("PUBLISHABLE_KEY", "ANON_KEY");
// The JWT service-role key works as both apikey and bearer; the newer sb_secret_ key only as apikey.
const serviceKey = either("SERVICE_ROLE_KEY", "SECRET_KEY");
const adminHeaders = {
  apikey: serviceKey,
  ...(serviceKey.startsWith("sb_") ? {} : { Authorization: `Bearer ${serviceKey}` }),
  "Content-Type": "application/json",
};

const file = fileURLToPath(new URL("../apps/web/.env.local", import.meta.url));
// Derived one way from this stack's service-role key, so every checkout run against the same local stack
// (the main one and each worktree) writes the same password and none signs the others out of the dev account.
const password = createHmac("sha256", serviceKey).update(`one-of-one dev sign-in ${DEV_EMAIL}`).digest("base64url");

async function call(method, path, body, extra = {}) {
  const res = await fetch(`${url}${path}`, { method, headers: { ...adminHeaders, ...extra }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function findDevUser() {
  for (let page = 1; ; page += 1) {
    const { users } = await call("GET", `/auth/v1/admin/users?page=${page}&per_page=200`);
    const found = users.find((u) => u.email === DEV_EMAIL);
    if (found) return found;
    if (users.length < 200) return null;
  }
}

const existing = await findDevUser();
const user = existing
  ? await call("PUT", `/auth/v1/admin/users/${existing.id}`, { password, email_confirm: true })
  : await call("POST", "/auth/v1/admin/users", { email: DEV_EMAIL, password, email_confirm: true });
const rows = await call("PATCH", `/rest/v1/users?id=eq.${user.id}`, { is_founder: true }, { Prefer: "return=representation" });
if (!Array.isArray(rows) || rows.length !== 1 || rows[0].is_founder !== true) {
  throw new Error(`could not make ${DEV_EMAIL} a founder (got ${JSON.stringify(rows)})`);
}

writeFileSync(file, `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${key}\nDEV_SIGNIN_PASSWORD=${password}\n`);
console.log(`wrote ${file} for ${url}; ${existing ? "updated" : "created"} the founder ${DEV_EMAIL}`);
