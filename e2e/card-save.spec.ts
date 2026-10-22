import path from "node:path";
import { expect, test } from "@playwright/test";
import exifr from "exifr";
import { freshEmail, signIn } from "./auth";

test.use({ storageState: { cookies: [], origins: [] } });

const seoul = path.resolve("apps/web/public/dev/seoul.jpg");

test("Add to board saves the card privately and the Board shows it", async ({ page, request }) => {
  await signIn(page, freshEmail());
  await page.goto("/make");
  await expect(page.getByRole("button", { name: "Add to board" })).toBeDisabled();
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const texture = await page.locator("figure.oo-card").getAttribute("data-texture");

  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByLabel("1 card")).toHaveText("1");
  const tile = page.getByRole("link", { name: "Seoul, South Korea" });
  await expect(tile).toBeVisible();

  // The thumbnail the Board shows carries no EXIF: no GPS, no capture date.
  const src = await tile.locator("img").getAttribute("src");
  const res = await request.get(src!);
  expect(res.ok()).toBe(true);
  const bytes = await res.body();
  expect(await exifr.gps(bytes)).toBeUndefined();
  expect(await exifr.parse(bytes, { pick: ["DateTimeOriginal"] })).toBeUndefined();

  // The saved variation is the one Make showed.
  await tile.click();
  await expect(page).toHaveURL(/\/card\//);
  await expect(page.locator("figure.oo-card")).toHaveAttribute("data-texture", texture!);
});

test("a failed save says so and can be retried", async ({ page }) => {
  await signIn(page, freshEmail());
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  await page.route("**/storage/v1/object/**", (route) => route.abort());
  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page.getByRole("status")).toHaveText("Couldn't save the card. Try again.");
  await expect(page.getByRole("button", { name: "Add to board" })).toBeEnabled();
  await page.unroute("**/storage/v1/object/**");
  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page).toHaveURL(/\/board$/);
});
