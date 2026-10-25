import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CARD_FONT_FAMILY, cardFont, loadCardFonts } from "../src/fonts";

const cssPath = fileURLToPath(new URL("../src/card.css", import.meta.url));

describe("card.css fonts", () => {
  const css = readFileSync(cssPath, "utf8");
  // Inline SVG data (the motion tiles) is not a file; every other url is.
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]!).filter((u) => !u.startsWith("data:image/svg+xml"));

  it("declares exactly four font files, 400 and 600 in latin and latin-ext", () => {
    expect(urls.sort()).toEqual([
      "../fonts/eb-garamond-latin-400-normal.woff2",
      "../fonts/eb-garamond-latin-600-normal.woff2",
      "../fonts/eb-garamond-latin-ext-400-normal.woff2",
      "../fonts/eb-garamond-latin-ext-600-normal.woff2",
    ]);
  });

  it("points every url at a bundled file", () => {
    for (const u of urls) expect(existsSync(resolve(dirname(cssPath), u))).toBe(true);
  });

  it("ships the OFL licence next to the files", () => {
    expect(existsSync(resolve(dirname(cssPath), "../fonts/OFL.txt"))).toBe(true);
  });
});

describe("cardFont", () => {
  it("builds a canvas font string with the card family list", () => {
    expect(CARD_FONT_FAMILY).toBe('"EB Garamond", Garamond, Georgia, "Times New Roman", serif');
    expect(cardFont(600, 34)).toBe('600 34px "EB Garamond", Garamond, Georgia, "Times New Roman", serif');
    expect(cardFont(400, 12.5)).toBe('400 12.5px "EB Garamond", Garamond, Georgia, "Times New Roman", serif');
  });
});

describe("loadCardFonts", () => {
  it("resolves false outside a browser", async () => {
    expect(await loadCardFonts()).toBe(false);
  });
});
