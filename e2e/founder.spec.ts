import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { freshEmail, signIn } from "./auth";
import { makeFounder } from "./founder";

test.use({ storageState: { cookies: [], origins: [] } });

const seoul = path.resolve("apps/web/public/dev/seoul.jpg");

/** Picks Seoul on Make, clicks Foil in the design panel, adds the card, and returns the texture the saved card opens with. */
async function saveWithFoil(page: Page): Promise<{ assigned: string; saved: string }> {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const card = page.locator("figure.oo-card");
  const assigned = (await card.getAttribute("data-texture"))!;
  expect(assigned).not.toBe("foil"); // otherwise the pick would prove nothing

  const panel = page.locator("[data-design-panel]");
  await expect(panel).toHaveAttribute("aria-label", "Card design");
  await panel.locator(".design-field", { hasText: "Texture" }).getByRole("button", { name: "Foil" }).click();
  await expect(card).toHaveAttribute("data-texture", "foil");

  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await page.getByRole("link", { name: "Seoul, South Korea" }).click();
  await expect(page).toHaveURL(/\/card\//);
  const saved = page.locator("figure.oo-card");
  await expect(saved).toBeVisible();
  return { assigned, saved: (await saved.getAttribute("data-texture"))! };
}

test("a founder's design picks on Make are what Add to board saves", async ({ page }) => {
  const email = freshEmail();
  await signIn(page, email);
  makeFounder(email);
  await page.reload(); // the flag is read once per page; re-read it after the change
  const { saved } = await saveWithFoil(page);
  expect(saved).toBe("foil");
});

test("anyone else's card is saved with the assigned design, whatever the panel showed", async ({ page }) => {
  await signIn(page, freshEmail());
  const { assigned, saved } = await saveWithFoil(page);
  expect(saved).toBe(assigned);
});
