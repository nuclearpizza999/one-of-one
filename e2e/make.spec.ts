import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

const portrait = path.resolve("apps/web/public/dev/portrait.png");
const seoul = path.resolve("apps/web/public/dev/seoul.jpg");
const nogps = path.resolve("apps/web/public/dev/nogps.jpg");
const rotated = path.resolve("apps/web/public/dev/rotated.jpg");

test.beforeEach(async ({ page }) => {
  // Force the download path: headless Chromium on macOS would otherwise open the share sheet.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true });
    Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true });
  });
});

test("makes a card from a photo, edits the caption and saves the PNG", async ({ page }) => {
  await page.goto("/make");
  await expect(page.getByRole("button", { name: "Add a photo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print" })).toBeDisabled();

  await page.getByTestId("photo-input").setInputFiles(portrait);

  const img = page.locator("img.oo-photo");
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("width", "900");
  await expect(img).toHaveAttribute("height", "1200");
  await expect(page.getByRole("status")).toHaveText("No location or date in this photo's data. Tap the caption lines to type them.");
  await expect(page.locator(".oo-line-date")).toHaveText(/^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th), \d{4}$/);
  await expect(page.locator(".oo-num")).toHaveText("");
  await expect(page.locator(".oo-frame")).toHaveClass(/oo-intro-(rise|develop|flip)/);

  const place = page.locator(".oo-line-place");
  await place.click();
  await page.keyboard.type("Seoul, South Korea");
  await page.keyboard.press("Enter");
  await expect(place).toHaveText("Seoul, South Korea");
  await expect(place).not.toBeFocused();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).click();
  const dl = await download;
  expect(dl.suggestedFilename()).toBe("one-of-one-seoul-south-korea.png");
  const png = PNG.sync.read(readFileSync((await dl.path())!));
  expect(png.width).toBe(1000);
  expect(png.height).toBe(1442);
  await expect(page.getByRole("status")).toContainText("Print saved.");
});

test("replay restarts the intro", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(portrait);
  const frame = page.locator(".oo-frame");
  await expect(frame).toHaveClass(/oo-intro-/);
  const before = await frame.evaluate((el) => el.getAnimations({ subtree: true }).map((a) => a.startTime));
  expect(before.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Replay intro" }).click();
  await expect
    .poll(() => frame.evaluate((el) => el.getAnimations({ subtree: true }).map((a) => a.startTime)))
    .not.toEqual(before);
});

test("prints the caption that is being typed, without pressing Enter", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(portrait);
  await expect(page.locator("img.oo-photo")).toBeVisible();
  const place = page.locator(".oo-line-place");
  await place.click();
  await page.keyboard.type("Seoul, South Korea");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).click();
  expect((await download).suggestedFilename()).toBe("one-of-one-seoul-south-korea.png");
  await expect(place).toHaveText("Seoul, South Korea");
});

test("prints the caption being typed when the click does not move focus", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(portrait);
  await expect(page.locator("img.oo-photo")).toBeVisible();
  const place = page.locator(".oo-line-place");
  await place.click();
  await page.keyboard.type("Seoul, South Korea");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).dispatchEvent("click");
  expect((await download).suggestedFilename()).toBe("one-of-one-seoul-south-korea.png");
  await expect(place).toHaveText("Seoul, South Korea");
});

test("an unreadable file gets a plain status line", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("status")).toHaveText("This photo format can't be shown here. Try a JPEG or PNG.");
  await expect(page.getByText("Tap to add a photo")).toBeVisible();
});

test("Cancel returns to the Board", async ({ page }) => {
  await page.goto("/make");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/board$/);
});

test("reads the place, date and coordinates from a photo with EXIF", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator("img.oo-photo")).toHaveAttribute("width", "900");
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  await expect(page.locator(".oo-line-date")).toHaveText("July 1st, 2026");
  await expect(page.locator(".oo-line-coords")).toHaveText("37.5563° N, 126.9236° E");
  await expect(page.getByRole("status")).toHaveText("Read location and date from the photo.");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).click();
  const dl = await download;
  expect(dl.suggestedFilename()).toBe("one-of-one-seoul-south-korea.png");
  const png = PNG.sync.read(readFileSync((await dl.path())!));
  expect(png.width).toBe(1000);
  expect(png.height).toBe(1442);
});

test("leaves the place blank with a hint when the photo has a date but no GPS", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(nogps);
  await expect(page.locator(".oo-line-date")).toHaveText("July 1st, 2026");
  const place = page.locator(".oo-line-place");
  await expect(place).toHaveText("");
  await expect(place).toHaveAttribute("data-hint", "Where was this?");
  await expect(page.locator(".oo-line-coords")).toHaveText("");
  await expect(page.getByRole("status")).toContainText("No location in this photo's data.");
});

test("shows a sideways-stored camera photo upright in both painters", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(rotated);
  const img = page.locator("img.oo-photo");
  await expect(img).toHaveAttribute("width", "900");
  await expect(img).toHaveAttribute("height", "1200");
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).click();
  const png = PNG.sync.read(readFileSync((await (await download).path())!));
  expect(png.width).toBe(1000);
  expect(png.height).toBe(1442);
});

test("says so when the place lookup fails, and keeps the coordinates", async ({ page }) => {
  await page.route("**/api/place**", (route) => route.abort());
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.getByRole("status")).toHaveText("Couldn't look up the place. Tap the top line to type it.");
  await expect(page.locator(".oo-line-place")).toHaveText("");
  await expect(page.locator(".oo-line-coords")).toHaveText("37.5563° N, 126.9236° E");
  await expect(page.locator(".oo-line-date")).toHaveText("July 1st, 2026");
});
