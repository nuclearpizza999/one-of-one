import { expect, test } from "@playwright/test";
import { freshEmail, latestCode, signIn } from "./auth";

test.use({ storageState: { cookies: [], origins: [] } });

test("signs in with a six-digit code and lands on the Board", async ({ page }) => {
  const email = freshEmail();
  await signIn(page, email);
  await expect(page.getByText("No cards yet.")).toBeVisible();
  await page.goto("/signin");
  // Already signed in: the screen still renders, and the Board is a tab away.
  await page.goto("/board");
  await expect(page).toHaveURL(/\/board$/);
});

test("says so when the code is wrong, then accepts the right one", async ({ page }) => {
  const email = freshEmail();
  const requestedAt = Date.now();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("status")).toContainText("We sent a six-digit code");
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("status")).toHaveText("That code didn't match. Try again.");
  await page.getByLabel("Code").fill(await latestCode(email, requestedAt));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/board$/);
});

test("says so when the address is not an email", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("not-an-address");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("Email")).toHaveJSProperty("validity.valid", false);
  // The browser's own validation blocks the submit; nothing was sent.
  await expect(page.getByRole("status")).toHaveText("");
  await expect(page.getByLabel("Code")).toHaveCount(0);
});

test("Back returns to the email step, and a corrected address gets its own code", async ({ page }) => {
  const wrong = freshEmail();
  const right = freshEmail();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(wrong);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("status")).toHaveText(`We sent a six-digit code to ${wrong}.`);
  await expect(page.getByLabel("Email")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("Code")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Code")).toHaveCount(0);
  await expect(page.getByLabel("Email")).not.toHaveAttribute("readonly", /.*/);
  await expect(page.getByLabel("Email")).toBeEditable();
  await expect(page.getByRole("status")).toHaveText("");
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
  await page.getByLabel("Email").fill(right);
  const requestedAt = Date.now();
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("Code")).toBeVisible();
  await page.getByLabel("Code").fill(await latestCode(right, requestedAt));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/board$/);
});
