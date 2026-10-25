import { execFileSync } from "node:child_process";

/** Marks a signed-up user as a founder in the local stack's database (tests only). */
export function makeFounder(email: string): void {
  const sql = `update public.users set is_founder = true where id = (select id from auth.users where email = '${email.replace(/'/g, "''")}');`;
  execFileSync("docker", ["exec", "-i", "supabase_db_one-of-one", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}
