import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { freshEmail, signIn } from "./auth";

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true });
    Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true });
  });
});

test("opens a saved card with its caption, border and intro, goes back, and prints it", async ({ page }) => {
  await signIn(page, freshEmail());
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(path.resolve("apps/web/public/dev/seoul.jpg"));
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const card = page.locator("figure.oo-card");
  const shown = {
    texture: await card.getAttribute("data-texture"),
    tone: await card.getAttribute("data-tone"),
    tier: await card.getAttribute("data-tier"),
    intro: (await page.locator(".oo-frame").getAttribute("class"))!.match(/oo-intro-\w+/)![0],
  };
  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await page.getByRole("link", { name: "Seoul, South Korea" }).click();
  await expect(page).toHaveURL(/\/card\/[0-9a-f-]{36}$/);

  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  await expect(page.locator(".oo-line-date")).toHaveText("July 1st, 2026");
  await expect(page.locator(".oo-line-coords")).toHaveText("37.5563° N, 126.9236° E");
  await expect(page.locator(".oo-num")).toHaveText("");
  await expect(card).toHaveAttribute("data-texture", shown.texture!);
  await expect(card).toHaveAttribute("data-tone", shown.tone!);
  await expect(card).toHaveAttribute("data-tier", shown.tier!);
  await expect(card).toHaveAttribute("data-editable", "false");
  await expect(page.locator(".oo-frame")).toHaveClass(new RegExp(shown.intro));
  await expect(page.getByRole("button", { name: "Add to board" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Replay intro" })).toBeEnabled();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).click();
  const dl = await download;
  expect(dl.suggestedFilename()).toBe("one-of-one-seoul-south-korea.png");
  const png = PNG.sync.read(readFileSync((await dl.path())!));
  expect(png.width).toBe(1000); // seoul.jpg is 900 px wide: the print is the original's size, not the rendition's
  await expect(page.getByRole("status")).toContainText("Print saved.");

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/board$/);
});

test("someone else's card is not found", async ({ page, browser }) => {
  await signIn(page, freshEmail());
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(path.resolve("apps/web/public/dev/portrait.png"));
  await expect(page.locator("img.oo-photo")).toBeVisible();
  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page).toHaveURL(/\/board$/);
  const href = await page.getByRole("link", { name: /./ }).and(page.locator(".tile")).first().getAttribute("href");

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await signIn(page2, freshEmail());
  const r = await page2.goto(href!);
  expect(r?.status()).toBe(404);
  await other.close();
});
