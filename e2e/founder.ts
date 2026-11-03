import { execFileSync } from "node:child_process";

/** Runs SQL as postgres in the local stack's database (tests only), bypassing row-level security and the design guard. */
function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "supabase_db_one-of-one", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { stdio: "pipe", encoding: "utf8" },
  );
}

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Marks a signed-up user as a founder in the local stack's database (tests only); throws unless exactly one user matched. */
export function makeFounder(email: string): void {
  const out = psql(`update public.users set is_founder = true where id = (select id from auth.users where email = ${quote(email)});`);
  if (!/^UPDATE 1$/m.test(out)) throw new Error(`makeFounder: no single user matched ${email} (psql said: ${out.trim()})`);
}

/** Writes a motion straight into a saved card's stored variation (tests only), as a card saved before that motion was retired would hold it. */
export function setStoredMotion(cardId: string, motion: string): void {
  const out = psql(`update public.cards set variation = jsonb_set(variation, '{motion}', to_jsonb(${quote(motion)}::text)) where id = ${quote(cardId)};`);
  if (!/^UPDATE 1$/m.test(out)) throw new Error(`setStoredMotion: no single card matched ${cardId} (psql said: ${out.trim()})`);
}

/** Removes the tone strength from a saved card's stored variation (tests only), as a card saved before strengths existed holds it. */
export function clearStoredToneStrength(cardId: string): void {
  const out = psql(`update public.cards set variation = variation - 'toneStrength' where id = ${quote(cardId)};`);
  if (!/^UPDATE 1$/m.test(out)) throw new Error(`clearStoredToneStrength: no single card matched ${cardId} (psql said: ${out.trim()})`);
}
