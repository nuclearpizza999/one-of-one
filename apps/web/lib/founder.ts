"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "./supabase/browser";

/**
 * Whether the signed-in user is a founder (Oct 24, 2026: founders may restyle their own cards).
 * Reads the user's own `users` row once per mount: null while loading, false on any error, including
 * a database that does not have the column yet. A flag change is seen after a reload.
 */
export function useIsFounder(): boolean | null {
  const [isFounder, setIsFounder] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const supabase = createBrowserSupabase();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) return false;
        const { data, error } = await supabase.from("users").select("is_founder").eq("id", auth.user.id).maybeSingle();
        if (error || !data) return false;
        return (data as { is_founder?: unknown }).is_founder === true;
      } catch {
        return false;
      }
    })().then((value) => {
      if (live) setIsFounder(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return isFounder;
}
