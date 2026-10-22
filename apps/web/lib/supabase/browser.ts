"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/** The browser client. Sessions live in cookies, so server components see the same sign-in. */
export function createBrowserSupabase() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
