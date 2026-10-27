import { execFileSync } from "node:child_process";

/** Marks a signed-up user as a founder in the local stack's database (tests only); throws unless exactly one user matched. */
export function makeFounder(email: string): void {
  const sql = `update public.users set is_founder = true where id = (select id from auth.users where email = '${email.replace(/'/g, "''")}');`;
  const out = execFileSync(
    "docker",
    ["exec", "supabase_db_one-of-one", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { stdio: "pipe", encoding: "utf8" },
  );
  if (!/^UPDATE 1$/m.test(out)) throw new Error(`makeFounder: no single user matched ${email} (psql said: ${out.trim()})`);
}

/** Writes a motion straight into a saved card's stored variation (tests only), as a card saved before that motion was retired would hold it. */
export function setStoredMotion(cardId: string, motion: string): void {
  const sql = `update public.cards set variation = jsonb_set(variation, '{motion}', to_jsonb('${motion.replace(/'/g, "''")}'::text)) where id = '${cardId.replace(/'/g, "''")}';`;
  const out = execFileSync(
    "docker",
    ["exec", "supabase_db_one-of-one", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { stdio: "pipe", encoding: "utf8" },
  );
  if (!/^UPDATE 1$/m.test(out)) throw new Error(`setStoredMotion: no single card matched ${cardId} (psql said: ${out.trim()})`);
}
