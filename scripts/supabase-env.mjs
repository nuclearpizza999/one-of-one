// Writes apps/web/.env.local from the running local Supabase stack, so the dev server and the e2e tests talk to it.
// Run: node scripts/supabase-env.mjs   (after `npx supabase start`)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8" });
const get = (name) => {
  const m = new RegExp(`^${name}="?([^"\\n]+)"?$`, "m").exec(out);
  if (!m) throw new Error(`${name} not in supabase status output`);
  return m[1];
};
const url = get("API_URL");
const key = (() => { try { return get("PUBLISHABLE_KEY"); } catch { return get("ANON_KEY"); } })();
const file = fileURLToPath(new URL("../apps/web/.env.local", import.meta.url));
writeFileSync(file, `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${key}\n`);
console.log(`wrote ${file} for ${url}`);
