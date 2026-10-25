import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Development only: the local sign-in bypass. On this Mac, against the local Supabase stack,
 * the proxy signs straight into a local founder account, and the codeword `dev` on /signin does too.
 * `npm run supabase:env` creates the account and writes its password to apps/web/.env.local.
 * Every call site also checks `process.env.NODE_ENV !== "production"` so a production build drops it.
 */

/** The local test account. It exists only on the local stack. */
export const DEV_EMAIL = "dev@one-of-one.local";

type Env = Partial<Record<string, string | undefined>>;

/** On only in a development build, against a local stack, with a dev password, and not switched off by DEV_AUTO_SIGNIN=0. */
export function devBypassEnabled(env: Env = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.DEV_AUTO_SIGNIN === "0") return false;
  if (!env.DEV_SIGNIN_PASSWORD) return false;
  let host: string;
  try {
    host = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return false;
  }
  return host === "127.0.0.1" || host === "localhost";
}

/** The codeword typed into the email field on /signin. */
export function isCodeword(value: string): boolean {
  return value.trim().toLowerCase() === "dev";
}

/** Signs `supabase` into the dev account; the client's cookie handler stores the session. */
export async function devSignIn(supabase: SupabaseClient): Promise<boolean> {
  const password = process.env.DEV_SIGNIN_PASSWORD;
  if (!devBypassEnabled() || !password) return false;
  const { data, error } = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password });
  return !error && Boolean(data.user);
}
