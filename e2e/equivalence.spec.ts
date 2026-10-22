import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { CARD } from "../packages/card/src/layout";
import { TEXTURES } from "../packages/card/src/textures";

/**
 * Largest share of differing pixels allowed between the DOM card and the PNG.
 * DOM and canvas anti-alias text slightly differently, so it is not zero.
 * Tuned once on the first run (see the plan, Task 9 step 5) and then frozen:
 * a one-unit caption drift must exceed three times this value.
 */
const MAX_DIFF_RATIO = 0.001;

// Textured cards: the two painters rasterise the SVG grain with slightly more difference than
// text anti-aliasing alone (largest observed 0.00094 on macOS Chromium), so they get their own
// tolerance by the same rule. A one-unit border drift on the foil texture must exceed three times it.
// The border drift is exercised on the foil texture only; a sub-unit shift on another texture would pass.
const MAX_TEXTURE_DIFF_RATIO = 0.002;

const FIXTURES = ["portrait", "landscape", "square"] as const;

async function capture(page: Page, query: string) {
  await page.goto(`/dev/card?${query}`);
  await page.waitForSelector('body[data-ready="1"]');
  // Both images must be decoded before a screenshot, or the capture is blank.
  await page.locator("#dom img.oo-photo").evaluate((el) => (el as HTMLImageElement).decode());
  const border = page.locator("#dom img.oo-border-img");
  if ((await border.count()) > 0) await border.evaluate((el) => (el as HTMLImageElement).decode());
  await page.locator("#png").evaluate((el) => (el as HTMLImageElement).decode());
  const dom = PNG.sync.read(await page.locator("#dom .oo-card").screenshot());
  const png = PNG.sync.read(await page.locator("#png").screenshot());
  return { dom, png };
}

function diffRatio(dom: PNG, png: PNG, name: string): number {
  expect(png.width, "PNG width").toBe(dom.width);
  expect(png.height, "PNG height").toBe(dom.height);
  const diff = new PNG({ width: dom.width, height: dom.height });
  const differing = pixelmatch(dom.data, png.data, diff.data, dom.width, dom.height, { threshold: 0.1 });
  writeFileSync(test.info().outputPath(`${name}-diff.png`), PNG.sync.write(diff));
  const ratio = differing / (dom.width * dom.height);
  console.log(`${name}: ${differing} differing pixels, ratio ${ratio.toFixed(5)}`);
  return ratio;
}

for (const fixture of FIXTURES) {
  for (const coords of [1, 0]) {
    for (const number of [1, 0]) {
      const name = `${fixture}-coords${coords}-number${number}`;
      test(`${name}: the DOM card and the PNG match`, async ({ page }) => {
        const { dom, png } = await capture(page, `fixture=${fixture}&coords=${coords}&number=${number}`);
        expect(diffRatio(dom, png, name)).toBeLessThan(MAX_DIFF_RATIO);
      });
    }
  }
}

// What these two cases prove: the whole-card ratio catches geometry drift of one unit of
// card width, and shows a long place line and a multi-digit number render without gross
// divergence (no wrapped line, no clipped or misplaced number). It cannot resolve a
// single-glyph shift: figure spacing (tabular vs proportional digits) and the exact
// ellipsis cut are below its tolerance. A direct width probe is the tool for those.
const MULTI_DIGIT_CASES = [
  ["portrait-number11", "fixture=portrait&coords=1&number=11"],
  ["portrait-long-place-number1111", "fixture=portrait&coords=1&number=1111&place=long"],
] as const;

for (const [name, query] of MULTI_DIGIT_CASES) {
  test(`${name}: the DOM card and the PNG match`, async ({ page }) => {
    const { dom, png } = await capture(page, query);
    expect(diffRatio(dom, png, name)).toBeLessThan(MAX_DIFF_RATIO);
  });
}

test("a one-unit caption drift is caught", async ({ page }) => {
  const { dom, png } = await capture(page, "fixture=portrait&coords=1&number=1&drift=1");
  expect(diffRatio(dom, png, "drift")).toBeGreaterThan(MAX_DIFF_RATIO * 3);
});

// Every registered texture, so adding one adds its screen-versus-print case.
for (const id of Object.keys(TEXTURES)) {
  const tier = id === "foil" ? "foil" : "fine";
  const name = `portrait-texture-${id}`;
  test(`${name}: the DOM card and the PNG match`, async ({ page }) => {
    const { dom, png } = await capture(page, `fixture=portrait&coords=1&number=1&texture=${id}&tier=${tier}`);
    expect(diffRatio(dom, png, name)).toBeLessThan(MAX_TEXTURE_DIFF_RATIO);
  });
}

test("a one-unit border drift on the foil texture is caught", async ({ page }) => {
  const { dom, png } = await capture(page, "fixture=portrait&coords=1&number=1&texture=foil&tier=foil&driftBorder=1");
  expect(diffRatio(dom, png, "border-drift")).toBeGreaterThan(MAX_TEXTURE_DIFF_RATIO * 3);
});

test("CARD.baselineFromBottom is the DOM's measured baseline", async ({ page }) => {
  await page.goto("/dev/card?fixture=portrait&coords=1&number=1");
  await page.waitForSelector('body[data-ready="1"]');
  const measured = Number(await page.locator("#baseline").textContent());
  console.log(`measured baselineFromBottom: ${measured.toFixed(4)} (CARD has ${CARD.baselineFromBottom})`);
  // 0.006 of a 34 px font is about 0.2 px at the 34 px test size, chosen so a one-pixel baseline error fails.
  expect(Math.abs(measured - CARD.baselineFromBottom)).toBeLessThan(0.006);
});
