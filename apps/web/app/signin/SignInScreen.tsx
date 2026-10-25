"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Icon } from "@/components/Icon";
import { StatusLine } from "@/components/StatusLine";
import { TopBar } from "@/components/TopBar";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { isCodeword } from "@/lib/supabase/dev-bypass";

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
    if (process.env.NODE_ENV !== "production" && isCodeword(address)) {
      await devSignIn();
      return;
    }
    setBusy(true);
    let error: { status?: number } | null;
    try {
      ({ error } = await createBrowserSupabase().auth.signInWithOtp({ email: address }));
    } catch {
      error = {};
    } finally {
      setBusy(false);
    }
    if (error) {
      setStatus(error.status === 429 ? "Wait a minute before asking for another code." : "Couldn't send a code to that address.");
      return;
    }
    setSent(true);
    setStatus(`We sent a six-digit code to ${address}.`);
  }

  /** Development only: the codeword signs into the local dev account through /api/dev/signin. */
  async function devSignIn() {
    if (process.env.NODE_ENV === "production") return;
    setBusy(true);
    let ok = false;
    try {
      ok = (await fetch("/api/dev/signin", { method: "POST" })).ok;
    } catch {
      ok = false;
    } finally {
      setBusy(false);
    }
    if (!ok) {
      setStatus("Dev sign-in is off. Run npm run supabase:env against the local stack.");
      return;
    }
    router.replace("/board");
    router.refresh();
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    let error: unknown;
    try {
      ({ error } = await createBrowserSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" }));
    } catch (thrown) {
      error = thrown;
    } finally {
      setBusy(false);
    }
    if (error) {
      setStatus("That code didn't match. Try again.");
      return;
    }
    router.replace("/board");
    router.refresh();
  }

  function backToEmail() {
    setSent(false);
    setCode("");
    setStatus("");
  }

  return (
    <div className="app">
      <TopBar
        right={
          sent ? (
            <button type="button" className="icon-target" aria-label="Back" onClick={backToEmail}>
              <Icon name="back" size={20} />
            </button>
          ) : undefined
        }
      />
      <main className="app-main signin">
        <form className="form" onSubmit={sent ? verify : sendCode}>
          <label className="field">
            <span className="field-label">Email</span>
            {/* Development builds take the codeword `dev` here; the field turns plain text for it so the browser's email check lets it through. */}
            <input type={process.env.NODE_ENV !== "production" && isCodeword(email) ? "text" : "email"} name="email" autoComplete="email" inputMode="email" required readOnly={sent} value={email} onChange={(e) => setEmail(e.target.value)} />
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
