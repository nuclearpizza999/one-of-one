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
  expect(png.height).toBe(1410);
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
  expect(png.height).toBe(1410);
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
  expect(png.height).toBe(1410);
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

test("says so when the lookup answers with an error", async ({ page }) => {
  await page.route("**/api/place**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.getByRole("status")).toHaveText("Couldn't look up the place. Tap the top line to type it.");
  await expect(page.locator(".oo-line-place")).toHaveText("");
  await expect(page.locator(".oo-line-coords")).toHaveText("37.5563° N, 126.9236° E");
  await expect(page.locator(".oo-line-date")).toHaveText("July 1st, 2026");
});

test("the design panel switches the live card's variation and returns to the assigned one", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(nogps); // FUJIFILM: the rule assigns "worn"
  const card = page.locator("figure.oo-card");
  await expect(card).toHaveAttribute("data-texture", "worn");
  await expect(page.locator("img.oo-border-img")).toHaveCount(1);
  await expect(page.locator("[data-design-assigned]")).toContainText("Assigned: worn");

  const texture = page.locator(".design-field", { hasText: "Texture" });
  await texture.getByRole("button", { name: "Foil" }).click();
  await expect(card).toHaveAttribute("data-texture", "foil");
  await texture.getByRole("button", { name: "Assigned" }).click();
  await expect(card).toHaveAttribute("data-texture", "worn");

  const tone = page.locator(".design-field", { hasText: "Tone" });
  await tone.getByRole("button", { name: "Cool" }).click();
  await expect(card).toHaveAttribute("data-tone", "cool");

  const tier = page.locator(".design-field", { hasText: "Tier" });
  await tier.getByRole("button", { name: "Animated" }).click();
  await expect(card).toHaveAttribute("data-motion", "sheen");
  await expect(page.locator(".oo-frame")).toHaveClass(/oo-motion-sheen/);
  await expect(card).toHaveAttribute("data-texture", "foil"); // a foil tier always carries the foil texture
  await tier.getByRole("button", { name: "Standard" }).click();
  await expect(card).toHaveAttribute("data-texture", "worn"); // and leaving it restores the camera rule
  await expect(card).toHaveAttribute("data-motion", "none");

  const intro = page.locator(".design-field", { hasText: "Intro" });
  await intro.getByRole("button", { name: "Flip" }).click();
  await expect(page.locator(".oo-frame")).toHaveClass(/oo-intro-flip/);
});

test("the printed PNG carries the border, differs between textures, and can leave it off", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  const texture = page.locator(".design-field", { hasText: "Texture" });
  const borderOnPrint = page.locator(".design-field", { hasText: "Border on print" });
  const print = async () => {
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "Print" }).click();
    return readFileSync((await (await dl).path())!);
  };

  await texture.getByRole("button", { name: "Foil" }).click();
  const foil = await print();
  await expect(page.getByRole("status")).toContainText("Print saved.");
  await expect(page.getByRole("status")).not.toContainText("without the border");
  expect(PNG.sync.read(foil).width).toBe(1000);

  await texture.getByRole("button", { name: "Paper" }).click();
  const paper = await print();
  expect(foil.equals(paper)).toBe(false);

  await borderOnPrint.getByRole("button", { name: "Off" }).click();
  const plain = await print();
  expect(plain.equals(paper)).toBe(false);
});

/** The pieces each motion's light layer holds. None has no layer. */
const LIGHT_PIECES: Record<string, number> = { Sheen: 0, Wave: 1, Visor: 1, Breathe: 1, Ripple: 2, Glint: 1, Starlight: 10, Cross: 2, Sway: 1 };

test("each motion lights the card in a layer under the photo, and None takes it away", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const motion = page.locator(".design-field", { hasText: "Motion" });
  const frame = page.locator(".oo-frame");
  const layer = page.locator("figure.oo-card > .oo-light");
  for (const [label, count] of Object.entries(LIGHT_PIECES)) {
    await motion.getByRole("button", { name: label, exact: true }).click();
    await expect(frame).toHaveClass(new RegExp(`\\boo-motion-${label.toLowerCase()}\\b`));
    await expect(layer).toBeVisible();
    await expect(layer.locator("span")).toHaveCount(count);
    if (label !== "Sheen") {
      // The light moves: every piece's animation, pseudo-elements included (Glint's and Starlight's ::before), is running.
      const running = await layer.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length);
      expect(running).toBeGreaterThan(0);
    }
  }
  await motion.getByRole("button", { name: "None", exact: true }).click();
  await expect(layer).toHaveCount(0);
  await expect(frame).not.toHaveClass(/\boo-motion-/);
});

test("with reduced motion the light is not shown", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  await page.locator(".design-field", { hasText: "Motion" }).getByRole("button", { name: "Wave", exact: true }).click();
  await expect(page.locator(".oo-frame")).toHaveClass(/\boo-motion-wave\b/);
  await expect(page.locator(".oo-light")).toBeHidden();
});

test("every choice in the design panel fits on a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const panel = page.locator("[data-design-panel]");
  await expect(panel.locator(".design-field", { hasText: "Motion" }).locator(".strip-cell")).toHaveCount(11);
  const misfits = await panel.evaluate((p) => {
    const box = p.getBoundingClientRect();
    return [...p.querySelectorAll<HTMLElement>(".strip-cell")]
      .filter((c) => {
        const cell = c.getBoundingClientRect();
        const text = document.createRange();
        text.selectNodeContents(c);
        return cell.left < box.left - 0.5 || cell.right > box.right + 0.5 || text.getBoundingClientRect().width > cell.width;
      })
      .map((c) => c.textContent);
  });
  expect(misfits).toEqual([]);
});

test("a tap on a card with a motion blooms the light from the finger, and the bloom fades away", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const card = page.locator("figure.oo-card");
  const bloom = page.locator(".oo-light .oo-light-bloom");

  await page.locator(".design-field", { hasText: "Motion" }).getByRole("button", { name: "Sheen", exact: true }).click();
  await card.click({ position: { x: 6, y: 6 } });
  await expect(bloom).toHaveCount(1);
  // At the tap, in card units: 6 px into a card 100 units wide.
  const width = (await card.boundingBox())!.width;
  const cx = Number(await bloom.evaluate((el) => getComputedStyle(el).getPropertyValue("--oo-cx")));
  expect(Math.abs(cx - (6 * 100) / width)).toBeLessThan(0.5);
  await expect(bloom).toHaveCount(0, { timeout: 2500 });

  // A tap in a caption line being typed does not bloom; the next tap on the mat does, so one bloom shows.
  await page.locator(".oo-line-place").click();
  expect(await bloom.count()).toBe(0);
  await card.click({ position: { x: 6, y: 6 } });
  await expect(bloom).toHaveCount(1);
  await expect(bloom).toHaveCount(0, { timeout: 2500 });

  // At most four at once: five taps in one go, so none can fade before the count.
  await card.evaluate((el) => {
    const b = el.getBoundingClientRect();
    for (let i = 0; i < 5; i += 1) {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: b.left + 6 + i, clientY: b.top + 6 }));
    }
  });
  await expect(bloom).toHaveCount(4);
  expect(await bloom.count()).toBe(4);
});

test("with reduced motion a tap adds no bloom", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  await page.locator(".design-field", { hasText: "Motion" }).getByRole("button", { name: "Wave", exact: true }).click();
  const card = page.locator("figure.oo-card");
  await card.click({ position: { x: 6, y: 6 } });
  // A bloom added here would never end (the layer is hidden), so it would still be counted after motion returns.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".oo-light")).toBeVisible();
  await card.click({ position: { x: 6, y: 6 } });
  await expect(page.locator(".oo-light-bloom")).toHaveCount(1);
});

test("the strength slider shifts a warm or cool card, and Assigned returns the card's own strength", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const card = page.locator("figure.oo-card");
  const border = page.locator("img.oo-border-img");
  const tone = page.locator(".design-field", { hasText: "Tone" });
  const field = page.locator(".design-field", { hasText: "Strength" });
  const slider = page.getByRole("slider", { name: "Tone strength" });

  // The fixture records no time zone, so its sun is unknown and its strength is the middle.
  await expect(card).toHaveAttribute("data-tone-strength", "13");
  await tone.getByRole("button", { name: "Photo", exact: true }).click();
  await expect(slider).toBeDisabled();
  await tone.getByRole("button", { name: "Warm", exact: true }).click();
  await expect(slider).toBeEnabled();
  const before = (await border.getAttribute("src"))!;
  await slider.fill("20");
  await expect(card).toHaveAttribute("data-tone-strength", "20");
  await expect(field.locator("output")).toHaveText("20");
  await expect(border).not.toHaveAttribute("src", before);
  await field.getByRole("button", { name: "Assigned" }).click();
  await expect(card).toHaveAttribute("data-tone-strength", "13");
  await expect(border).toHaveAttribute("src", before);
});
