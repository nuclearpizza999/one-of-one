import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { CARD } from "../packages/card/src/layout";

/**
 * Largest share of differing pixels allowed between the DOM card and the PNG.
 * DOM and canvas anti-alias text slightly differently, so it is not zero.
 * Tuned once on the first run (see the plan, Task 9 step 5) and then frozen:
 * a one-unit caption drift must exceed three times this value.
 */
const MAX_DIFF_RATIO = 0.001;

const FIXTURES = ["portrait", "landscape", "square"] as const;

async function capture(page: Page, query: string) {
  await page.goto(`/dev/card?${query}`);
  await page.waitForSelector('body[data-ready="1"]');
  // The Next dev indicator floats over the card's bottom-left corner; keep it out of the screenshot.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  // Both images must be decoded before a screenshot, or the capture is blank.
  await page.locator("#dom img.oo-photo").evaluate((el) => (el as HTMLImageElement).decode());
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

test("a one-unit caption drift is caught", async ({ page }) => {
  const { dom, png } = await capture(page, "fixture=portrait&coords=1&number=1&drift=1");
  expect(diffRatio(dom, png, "drift")).toBeGreaterThan(MAX_DIFF_RATIO * 3);
});

test("CARD.baselineFromBottom is the DOM's measured baseline", async ({ page }) => {
  await page.goto("/dev/card?fixture=portrait&coords=1&number=1");
  await page.waitForSelector('body[data-ready="1"]');
  const measured = Number(await page.locator("#baseline").textContent());
  console.log(`measured baselineFromBottom: ${measured.toFixed(4)} (CARD has ${CARD.baselineFromBottom})`);
  expect(Math.abs(measured - CARD.baselineFromBottom)).toBeLessThan(0.006);
});
