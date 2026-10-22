"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { StatusLine } from "@/components/StatusLine";
import { TopBar } from "@/components/TopBar";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/** The eighth screen: an email, then the six-digit code from the email. No passwords, no tab bar. */
export function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.signInWithOtp({ email: address });
    setBusy(false);
    if (error) {
      setStatus(error.status === 429 ? "Wait a minute before asking for another code." : "Couldn't send a code to that address.");
      return;
    }
    setSent(true);
    setStatus(`We sent a six-digit code to ${address}.`);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) {
      setStatus("That code didn't match. Try again.");
      return;
    }
    router.replace("/board");
    router.refresh();
  }

  return (
    <div className="app">
      <TopBar />
      <main className="app-main signin">
        <form className="form" onSubmit={sent ? verify : sendCode}>
          <label className="field">
            <span className="field-label">Email</span>
            <input type="email" name="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {sent ? (
            <label className="field">
              <span className="field-label">Code</span>
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          ) : null}
          <button type="submit" className="button-primary" disabled={busy}>
            {sent ? "Sign in" : "Send code"}
          </button>
        </form>
        <StatusLine>{status}</StatusLine>
      </main>
    </div>
  );
}
