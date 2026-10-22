import { expect, type Page } from "@playwright/test";

/** The local stack's mail catcher. Every sign-in email lands here. */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function freshEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

interface MailpitSummary { ID: string; Created: string }
interface MailpitMessage { Text: string; HTML: string }

/** The six-digit code in the newest message to `email` created at or after `after` (ms since epoch). Polls for up to ten seconds. */
export async function latestCode(email: string, after: number): Promise<string> {
  for (let i = 0; i < 40; i += 1) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const list = (await res.json()) as { messages?: MailpitSummary[] };
    const msg = (list.messages ?? []).find((m) => new Date(m.Created).getTime() >= after - 1000);
    if (msg) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as MailpitMessage;
      const m = /\b(\d{6})\b/.exec(full.Text || full.HTML);
      if (m) return m[1]!;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no sign-in code arrived for ${email} (is the local stack running?)`);
}

/** Signs in through the screen, as a person would, and lands on the Board. */
export async function signIn(page: Page, email: string): Promise<void> {
  const requestedAt = Date.now();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("status")).toContainText(`We sent a six-digit code to ${email}.`);
  const code = await latestCode(email, requestedAt);
  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/board$/);
}
