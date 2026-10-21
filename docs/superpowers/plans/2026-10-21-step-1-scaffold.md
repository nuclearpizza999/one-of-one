# Step 1 Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the handoff folder into a working monorepo: a standalone card renderer package (layout, DOM painter, canvas PNG painter, fonts, intros) with unit tests, and a Next.js app shell with a Make screen that makes a card and saves its PNG, enforced by a Playwright screenshot-diff test proving screen and print match.

**Architecture:** One pure `layoutCard()` returns every box and baseline in units of card width (card = 100 units). Two painters consume it: `Card` (React, CSS container-query units) for the screen and `renderPng()` (Canvas 2D on the phone) for the PNG. The app imports the package as TypeScript source through `transpilePackages`. A dev-only route renders both painters side by side so Playwright can diff them.

**Tech Stack:** Node 24, npm 11 workspaces, TypeScript 5.9, React 19.3, Next.js 16.4 (App Router), Vitest 5, Playwright 1.64, pixelmatch 8, pngjs 7, EB Garamond woff2 from `@fontsource/eb-garamond` 5.3.0 (OFL).

Spec: `docs/superpowers/specs/2026-10-21-step-1-scaffold-design.md`. Product rules: `SPEC.md` and `CLAUDE.md`. Prototype to port: `prototype/one-of-one.html` (never read it whole; line 171 is a 397 KB line).

## Global Constraints

- Card geometry in units of card width (W = 100): mat 5 top/left/right; photo x 5, y 5, w 90; caption strip height 19.2 below the photo; caption font size 3.4, line height 1.32; text inset 3 from the photo edges (text spans x 8 to x 92); last caption line sits 3.6 above the card bottom; place line max width 72% of photo width = 64.8; card height = 5 + photo height + 19.2.
- Caption: EB Garamond 600, color #111; coordinates line weight 400, color #333, omitted when empty; number is `#` plus the count, right-aligned on the last line's baseline, tabular figures; number slot empty when the number is null.
- Print PNG: photo at native resolution capped at 4800 px wide; `W = round(min(photoW, 4800) / 0.90)`; white mat; no hairline, no shadow.
- Screen card on the light wall: 1px #e6e6e6 hairline and shadow `0 2% 7% of W, black at 14%`; on the dark wall nothing. The card is otherwise identical in both themes.
- Chrome tokens: ground #ffffff light / #000000 dark; ink #000000 / #ffffff; muted #6b6b6b / #8d8d8d; rules 1px solid ink. Archivo 500; 11px uppercase 0.12em letter-spacing for strip and bar text; 13px uppercase 0.1em for place names; wordmark 13px 0.06em. Top bar 48px. Tab bar 84px with 1px top rule, three 48 × 44 slots: grid, empty, plus. Strips: equal cells inside a 1px rule, 52px for action strips, 44px for option strips; selected cell fills with ink and inverts. Icons: inline SVG, 24 viewBox drawn at 22px, 1.5px stroke, round caps, ink color, `aria-hidden` on the svg and `aria-label` on every icon-only control.
- Aria-label vocabulary: Make, Board, Cancel, Back, Replay intro, Add to board, Print, Add cards, Copy share link, Order print, Location shown as.
- The photo is never cropped on the card. Status messages are plain words in a status line, never a modal.
- No EXIF, place lookup, numbering, accounts, storage, variation textures or server rendering in this step.
- Commit after every task with the message shown. All commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Pin `typescript` to 5.9.x (TypeScript 7 is out but the toolchain is verified on 5.9). Pin `@types/node` to 24.x to match the runtime.

## File structure

```
package.json                         npm workspaces root, root scripts, e2e devDependencies
tsconfig.base.json                   shared compiler options
playwright.config.ts                 Playwright: testDir e2e, starts the Next dev server
.github/workflows/ci.yml             lint, typecheck, unit, e2e on push
packages/card/package.json           @one-of-one/card; exports ./src/index.ts and ./card.css
packages/card/tsconfig.json
packages/card/vitest.config.ts
packages/card/fonts/                 4 woff2 files + OFL.txt
packages/card/src/index.ts           re-exports
packages/card/src/format.ts          ordinal, fmtDate, fmtCoords
packages/card/src/layout.ts          CARD constants, CardSpec, CardLayout, layoutCard
packages/card/src/intros.ts          INTROS registry, seedFromPhoto, assignIntro
packages/card/src/fonts.ts           CARD_FONT_FAMILY, cardFont, loadCardFonts
packages/card/src/card.css           @font-face rules, card CSS, intro CSS, reduced motion
packages/card/src/Card.tsx           DOM painter (React)
packages/card/src/renderPng.ts       printDimensions, ellipsize, drawCard, renderPng
packages/card/test/*.test.ts(x)      Vitest unit tests, one file per module
apps/web/package.json                Next app
apps/web/tsconfig.json
apps/web/next.config.ts              transpilePackages
apps/web/eslint.config.mjs
apps/web/app/layout.tsx              html/body, fonts, global CSS, card CSS
apps/web/app/globals.css             chrome tokens and chrome classes
apps/web/app/page.tsx                redirect to /board
apps/web/app/board/page.tsx          Board empty state
apps/web/app/make/page.tsx           Make route (server) rendering MakeScreen
apps/web/app/make/MakeScreen.tsx     Make screen (client)
apps/web/app/dev/card/page.tsx       dev-only route, 404 in production
apps/web/app/dev/card/DevCard.tsx    renders Card and the PNG side by side (client)
apps/web/components/Icon.tsx         icon set from the mockups
apps/web/components/TopBar.tsx
apps/web/components/TabBar.tsx       client, active slot from pathname
apps/web/components/Strip.tsx
apps/web/components/StatusLine.tsx
apps/web/public/dev/*.png            three fixture photos (generated, committed)
e2e/fixtures/make-fixtures.mjs       writes the fixture photos with pngjs
e2e/board.spec.ts                    shell smoke test
e2e/make.spec.ts                     make a card and download its PNG
e2e/equivalence.spec.ts              DOM vs PNG screenshot diff, baseline constant, drift sensitivity
```

---

### Task 1: Workspace root and the card package with `format`

**Files:**
- Create: `package.json`, `tsconfig.base.json`
- Modify: `.gitignore`
- Create: `packages/card/package.json`, `packages/card/tsconfig.json`, `packages/card/vitest.config.ts`
- Create: `packages/card/src/format.ts`, `packages/card/src/index.ts`
- Test: `packages/card/test/format.test.ts`

**Interfaces:**
- Produces: `ordinal(n: number): string`, `fmtDate(d: Date): string` ("July 1st, 2026"), `fmtCoords(lat: number, lng: number): string` ("37.5563° N, 126.9236° E"), all exported from `@one-of-one/card`.

- [ ] **Step 1: Create the workspace root**

`package.json`:

```json
{
  "name": "one-of-one",
  "private": true,
  "engines": { "node": ">=24" },
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "npm run dev -w apps/web",
    "test": "npm test --workspaces --if-present",
    "test:e2e": "playwright test",
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "fixtures": "node e2e/fixtures/make-fixtures.mjs"
  },
  "devDependencies": {
    "@playwright/test": "^1.64.1",
    "@types/node": "^24.19.2",
    "@types/pngjs": "^6.0.5",
    "pixelmatch": "^8.0.0",
    "pngjs": "^7.0.0",
    "typescript": "~5.9.3"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

Append to `.gitignore`:

```
# playwright
test-results/
playwright-report/
```

- [ ] **Step 2: Create the card package skeleton**

`packages/card/package.json`:

```json
{
  "name": "@one-of-one/card",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./card.css": "./src/card.css"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "typescript": "~5.9.3",
    "vitest": "^5.0.5"
  }
}
```

`packages/card/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test", "vitest.config.ts"]
}
```

`packages/card/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
```

Run: `npm install`
Expected: completes, creates `node_modules` and `package-lock.json`, prints no peer-dependency errors.

- [ ] **Step 3: Write the failing format tests**

`packages/card/test/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fmtCoords, fmtDate, ordinal } from "../src/format";

describe("ordinal", () => {
  it.each([
    [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"],
    [11, "11th"], [12, "12th"], [13, "13th"],
    [21, "21st"], [22, "22nd"], [23, "23rd"], [31, "31st"],
    [101, "101st"], [111, "111th"],
  ])("formats %i as %s", (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe("fmtDate", () => {
  it("writes full month, ordinal day, four-digit year", () => {
    expect(fmtDate(new Date(2026, 6, 1))).toBe("July 1st, 2026");
    expect(fmtDate(new Date(2024, 11, 23))).toBe("December 23rd, 2024");
  });
});

describe("fmtCoords", () => {
  it("writes four decimals with hemisphere letters", () => {
    expect(fmtCoords(37.5563, 126.9236)).toBe("37.5563° N, 126.9236° E");
  });
  it("uses S and W for negative values", () => {
    expect(fmtCoords(-33.8568, -70.6483)).toBe("33.8568° S, 70.6483° W");
  });
  it("rounds to four decimals", () => {
    expect(fmtCoords(37.81990001, -122.47834)).toBe("37.8199° N, 122.4783° W");
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -w packages/card -- format`
Expected: FAIL, "Failed to resolve import "../src/format"".

- [ ] **Step 5: Implement format**

`packages/card/src/format.ts`:

```ts
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 1 → "1st", 22 → "22nd", 13 → "13th". */
export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

/** "July 1st, 2026": full month, ordinal day, four-digit year. */
export function fmtDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${ordinal(d.getDate())}, ${d.getFullYear()}`;
}

/** "37.5563° N, 126.9236° E": four decimals, hemisphere letters. */
export function fmtCoords(lat: number, lng: number): string {
  const part = (v: number, pos: string, neg: string) =>
    `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
  return `${part(lat, "N", "S")}, ${part(lng, "E", "W")}`;
}
```

`packages/card/src/index.ts`:

```ts
export { fmtCoords, fmtDate, ordinal } from "./format";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w packages/card -- format`
Expected: PASS, 17 tests.

Run: `npm run typecheck -w packages/card`
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json .gitignore packages/card
git commit -m "Scaffold npm workspace and card package with caption formatters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `layoutCard`, the shared geometry

**Files:**
- Create: `packages/card/src/layout.ts`
- Modify: `packages/card/src/index.ts`
- Test: `packages/card/test/layout.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const CARD: { width: 100; mat: 5; photoWidth: 90; stripHeight: 19.2; fontSize: 3.4; lineHeight: 1.32; inset: 3; bottom: 3.6; placeMaxWidthRatio: 0.72; baselineFromBottom: number };
  export interface CardSpec { photoW: number; photoH: number; place: string; date: string; coords: string; number: number | null }
  export type LineKind = "place" | "date" | "coords";
  export interface CaptionLine { kind: LineKind; text: string; weight: 400 | 600; color: "#111" | "#333"; baselineY: number }
  export interface CardLayout { width: 100; height: number; photo: { x; y; w; h }; strip: { y; h }; text: { left: number; right: number; fontSize: number; lineHeight: number; placeMaxWidth: number }; lines: CaptionLine[]; number: { text: string; baselineY: number } | null }
  export function layoutCard(spec: CardSpec): CardLayout
  ```
  All numbers are in units of card width (card = 100). `baselineFromBottom` is the distance from the last line box's bottom to its baseline, as a fraction of font size; Task 9 measures and freezes it.

- [ ] **Step 1: Write the failing layout tests**

`packages/card/test/layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CARD, layoutCard } from "../src/layout";

const full = {
  place: "Seoul, South Korea",
  date: "July 1st, 2026",
  coords: "37.5563° N, 126.9236° E",
  number: 3,
};

describe("layoutCard geometry", () => {
  it("places the photo inside a 5-unit mat at 90 units wide", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(l.width).toBe(100);
    expect(l.photo).toEqual({ x: 5, y: 5, w: 90, h: 120 });
  });

  it("puts a 19.2-unit strip under the photo and sizes the card to it", () => {
    const portrait = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(portrait.strip).toEqual({ y: 125, h: 19.2 });
    expect(portrait.height).toBeCloseTo(144.2, 6);

    const landscape = layoutCard({ photoW: 900, photoH: 600, ...full });
    expect(landscape.photo.h).toBe(60);
    expect(landscape.height).toBeCloseTo(84.2, 6);

    const square = layoutCard({ photoW: 900, photoH: 900, ...full });
    expect(square.photo.h).toBe(90);
    expect(square.height).toBeCloseTo(114.2, 6);
  });

  it("insets text 3 units from the photo edges and caps the place line at 72% of the photo", () => {
    const l = layoutCard({ photoW: 900, photoH: 900, ...full });
    expect(l.text).toMatchObject({ left: 8, right: 92, fontSize: 3.4 });
    expect(l.text.lineHeight).toBeCloseTo(3.4 * 1.32, 6);
    expect(l.text.placeMaxWidth).toBeCloseTo(64.8, 6);
  });
});

describe("layoutCard caption lines", () => {
  it("bottom-aligns three lines so the last sits 3.6 units above the bottom", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    const lastBaseline = 144.2 - 3.6 - 3.4 * CARD.baselineFromBottom;
    const lineHeight = 3.4 * 1.32;
    expect(l.lines.map((x) => x.kind)).toEqual(["place", "date", "coords"]);
    expect(l.lines[2]!.baselineY).toBeCloseTo(lastBaseline, 6);
    expect(l.lines[1]!.baselineY).toBeCloseTo(lastBaseline - lineHeight, 6);
    expect(l.lines[0]!.baselineY).toBeCloseTo(lastBaseline - 2 * lineHeight, 6);
  });

  it("styles place and date at 600 #111 and coords at 400 #333", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(l.lines[0]).toMatchObject({ weight: 600, color: "#111", text: full.place });
    expect(l.lines[1]).toMatchObject({ weight: 600, color: "#111", text: full.date });
    expect(l.lines[2]).toMatchObject({ weight: 400, color: "#333", text: full.coords });
  });

  it("omits empty lines and keeps the remaining ones bottom-aligned", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full, coords: "" });
    const lastBaseline = 144.2 - 3.6 - 3.4 * CARD.baselineFromBottom;
    expect(l.lines.map((x) => x.kind)).toEqual(["place", "date"]);
    expect(l.lines[1]!.baselineY).toBeCloseTo(lastBaseline, 6);
  });

  it("treats whitespace-only text as empty", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full, place: "   " });
    expect(l.lines.map((x) => x.kind)).toEqual(["date", "coords"]);
  });

  it("puts the number on the last baseline, or omits it when null", () => {
    const withNumber = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(withNumber.number).toEqual({
      text: "#3",
      baselineY: withNumber.lines[2]!.baselineY,
    });
    const without = layoutCard({ photoW: 900, photoH: 1200, ...full, number: null });
    expect(without.number).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w packages/card -- layout`
Expected: FAIL, "Failed to resolve import "../src/layout"".

- [ ] **Step 3: Implement layout**

`packages/card/src/layout.ts`:

```ts
/**
 * Card geometry. Every number is in units of the card's outer width,
 * where the card is exactly 100 units wide. The screen painter multiplies
 * by 1cqw; the print painter multiplies by W / 100 pixels.
 */
export const CARD = {
  width: 100,
  mat: 5,
  photoWidth: 90,
  stripHeight: 19.2,
  fontSize: 3.4,
  lineHeight: 1.32,
  inset: 3,
  bottom: 3.6,
  placeMaxWidthRatio: 0.72,
  /**
   * Distance from the bottom of a line box to its baseline, as a fraction
   * of font size, for EB Garamond at line-height 1.32. Measured once by the
   * equivalence test (e2e/equivalence.spec.ts) and frozen here.
   */
  baselineFromBottom: 0.3,
} as const;

export interface CardSpec {
  photoW: number;
  photoH: number;
  place: string;
  date: string;
  coords: string;
  number: number | null;
}

export type LineKind = "place" | "date" | "coords";

export interface CaptionLine {
  kind: LineKind;
  text: string;
  weight: 400 | 600;
  color: "#111" | "#333";
  baselineY: number;
}

export interface CardLayout {
  width: 100;
  height: number;
  photo: { x: number; y: number; w: number; h: number };
  strip: { y: number; h: number };
  text: {
    left: number;
    right: number;
    fontSize: number;
    lineHeight: number;
    placeMaxWidth: number;
  };
  lines: CaptionLine[];
  number: { text: string; baselineY: number } | null;
}

export function layoutCard(spec: CardSpec): CardLayout {
  const photoH = (CARD.photoWidth * spec.photoH) / spec.photoW;
  const photo = { x: CARD.mat, y: CARD.mat, w: CARD.photoWidth, h: photoH };
  const strip = { y: CARD.mat + photoH, h: CARD.stripHeight };
  const height = strip.y + strip.h;

  const fontSize = CARD.fontSize;
  const lineHeight = fontSize * CARD.lineHeight;
  const lastBaseline = height - CARD.bottom - fontSize * CARD.baselineFromBottom;

  const candidates: Array<Omit<CaptionLine, "baselineY">> = [
    { kind: "place", text: spec.place.trim(), weight: 600, color: "#111" },
    { kind: "date", text: spec.date.trim(), weight: 600, color: "#111" },
    { kind: "coords", text: spec.coords.trim(), weight: 400, color: "#333" },
  ];
  const present = candidates.filter((l) => l.text.length > 0);
  const lines: CaptionLine[] = present.map((l, i) => ({
    ...l,
    baselineY: lastBaseline - (present.length - 1 - i) * lineHeight,
  }));

  return {
    width: 100,
    height,
    photo,
    strip,
    text: {
      left: CARD.mat + CARD.inset,
      right: CARD.mat + CARD.photoWidth - CARD.inset,
      fontSize,
      lineHeight,
      placeMaxWidth: CARD.photoWidth * CARD.placeMaxWidthRatio,
    },
    lines,
    number:
      spec.number === null ? null : { text: `#${spec.number}`, baselineY: lastBaseline },
  };
}
```

Add to `packages/card/src/index.ts`:

```ts
export { CARD, layoutCard } from "./layout";
export type { CaptionLine, CardLayout, CardSpec, LineKind } from "./layout";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w packages/card -- layout`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/card/src/layout.ts packages/card/src/index.ts packages/card/test/layout.test.ts
git commit -m "Add layoutCard: card geometry in units of card width

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Bundled fonts and the card stylesheet

**Files:**
- Create: `packages/card/fonts/eb-garamond-latin-400-normal.woff2`, `packages/card/fonts/eb-garamond-latin-600-normal.woff2`, `packages/card/fonts/eb-garamond-latin-ext-400-normal.woff2`, `packages/card/fonts/eb-garamond-latin-ext-600-normal.woff2`, `packages/card/fonts/OFL.txt`
- Create: `packages/card/src/card.css`, `packages/card/src/fonts.ts`
- Modify: `packages/card/src/index.ts`
- Test: `packages/card/test/fonts.test.ts`

**Interfaces:**
- Produces: `CARD_FONT_FAMILY` (the CSS family list), `cardFont(weight: 400 | 600, px: number): string` (a canvas `ctx.font` string), `loadCardFonts(): Promise<boolean>` (true when both weights are loaded in `document.fonts`; false outside a browser or when the faces are missing). The stylesheet `@one-of-one/card/card.css` with classes `oo-frame`, `oo-card`, `oo-photo-wrap`, `oo-photo`, `oo-empty`, `oo-plate`, `oo-lines`, `oo-line`, `oo-line-place`, `oo-line-date`, `oo-line-coords`, `oo-num`, `oo-border`, intro classes `oo-intro-rise`, `oo-intro-develop`, `oo-intro-flip`, and data attributes `data-wall`, `data-empty`, `data-editable` on `oo-card`.

- [ ] **Step 1: Copy the font files from the fontsource package**

The files come from `@fontsource/eb-garamond` 5.3.0 (SIL OFL 1.1). Unpack it in a temporary directory outside the repo and copy four woff2 files and the licence:

```bash
D=$(mktemp -d)
( cd "$D" && npm pack @fontsource/eb-garamond@5.3.0 >/dev/null && tar -xzf fontsource-eb-garamond-5.3.0.tgz )
mkdir -p packages/card/fonts
for f in latin-400 latin-600 latin-ext-400 latin-ext-600; do
  cp "$D/package/files/eb-garamond-$f-normal.woff2" packages/card/fonts/
done
cp "$D/package/LICENSE" packages/card/fonts/OFL.txt
ls -la packages/card/fonts
```

Expected: five files; the woff2 files are 24, 28, 56 and 64 KB; `OFL.txt` starts with "Copyright 2017 The EB Garamond Project Authors".

- [ ] **Step 2: Write the failing fonts tests**

`packages/card/test/fonts.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CARD_FONT_FAMILY, cardFont, loadCardFonts } from "../src/fonts";

const cssPath = fileURLToPath(new URL("../src/card.css", import.meta.url));

describe("card.css fonts", () => {
  const css = readFileSync(cssPath, "utf8");
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]!);

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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -w packages/card -- fonts`
Expected: FAIL, "Failed to resolve import "../src/fonts"".

- [ ] **Step 4: Write the stylesheet**

`packages/card/src/card.css`:

```css
/* EB Garamond 400 and 600, latin and latin-ext subsets. SIL OFL 1.1, see ../fonts/OFL.txt. */
@font-face {
  font-family: "EB Garamond";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("../fonts/eb-garamond-latin-400-normal.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: "EB Garamond";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("../fonts/eb-garamond-latin-ext-400-normal.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: "EB Garamond";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("../fonts/eb-garamond-latin-600-normal.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: "EB Garamond";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("../fonts/eb-garamond-latin-ext-600-normal.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}

/*
 * The card. Every dimension is in cqw of .oo-frame, so the card is one CSS
 * block at any width. The numbers are the CARD table in layout.ts.
 */
.oo-frame {
  container-type: inline-size;
  width: 100%;
}
.oo-card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 5cqw 5cqw 0;
  background: #fff;
  color: #111;
}
/* Hairline and shadow are drawn as box-shadow so they never change the box. */
.oo-card[data-wall="light"] {
  box-shadow: 0 0 0 1px #e6e6e6, 0 2cqw 7cqw rgba(0, 0, 0, 0.14);
}
.oo-card[data-empty="true"] {
  cursor: pointer;
  outline: none;
}
.oo-card[data-empty="true"]:focus-visible {
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px #111;
}
.oo-border {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.oo-photo-wrap {
  position: relative;
  width: 100%;
  background: #f2f2f2;
  overflow: hidden;
}
.oo-card[data-empty="true"] .oo-photo-wrap {
  aspect-ratio: 3 / 4;
}
.oo-photo {
  display: block;
  width: 100%;
  height: auto;
}
.oo-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10cqw;
  font: italic 400 4cqw/1.3 "EB Garamond", Garamond, Georgia, "Times New Roman", serif;
  color: #777;
  text-align: center;
}
.oo-plate {
  box-sizing: border-box;
  height: 19.2cqw;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 3cqw 3.6cqw;
  font-family: "EB Garamond", Garamond, Georgia, "Times New Roman", serif;
  font-size: 3.4cqw;
  font-weight: 600;
  line-height: 1.32;
  color: #111;
}
.oo-lines {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.oo-line {
  display: block;
  min-height: 1em;
  outline: none;
}
.oo-line-place {
  max-width: 64.8cqw;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oo-line-coords {
  font-weight: 400;
  color: #333;
}
.oo-card[data-editable="true"] .oo-line:empty::before {
  content: attr(data-hint);
  color: #9a9a9a;
  font-weight: 400;
  font-style: italic;
}
.oo-card[data-editable="true"] .oo-line:focus {
  background: #f4f1e6;
}
.oo-num {
  white-space: nowrap;
  padding-left: 3cqw;
  font-variant-numeric: tabular-nums;
}

/* Intros: one class on .oo-frame. They move the frame, reveal the photo and fade the caption; nothing else. */
.oo-intro-rise {
  animation: oo-rise 1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.oo-intro-rise .oo-photo-wrap {
  clip-path: inset(100% 0 0 0);
  animation: oo-reveal-up 1.1s cubic-bezier(0.6, 0, 0.2, 1) 0.55s forwards;
}
.oo-intro-rise .oo-lines,
.oo-intro-rise .oo-num {
  opacity: 0;
  animation: oo-fade-in 0.6s ease-out 1.55s forwards;
}
@keyframes oo-rise {
  from { transform: translateY(64px); opacity: 0; }
  to { transform: none; opacity: 1; }
}
@keyframes oo-reveal-up {
  to { clip-path: inset(0 0 0 0); }
}
@keyframes oo-fade-in {
  to { opacity: 1; }
}

.oo-intro-develop .oo-photo {
  filter: brightness(2.4) contrast(0.15) saturate(0);
  animation: oo-develop 2.6s cubic-bezier(0.3, 0, 0.1, 1) 0.2s forwards;
}
.oo-intro-develop .oo-lines,
.oo-intro-develop .oo-num {
  opacity: 0;
  animation: oo-fade-in 0.7s ease-out 2.1s forwards;
}
@keyframes oo-develop {
  60% { filter: brightness(1.25) contrast(0.75) saturate(0.4); }
  to { filter: none; }
}

/* Flip: the card starts face down (a blank white back) and turns over on its vertical axis. */
.oo-intro-flip {
  perspective: 1400px;
}
.oo-intro-flip .oo-card {
  transform-style: preserve-3d;
  backface-visibility: hidden;
  animation: oo-flip 1.3s cubic-bezier(0.45, 0, 0.15, 1) 0.15s both;
}
.oo-intro-flip .oo-card > * {
  backface-visibility: hidden;
}
.oo-intro-flip .oo-card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: #fff;
  transform: rotateY(180deg);
  backface-visibility: hidden;
}
.oo-intro-flip .oo-card[data-wall="light"]::after {
  box-shadow: 0 0 0 1px #e6e6e6, 0 2cqw 7cqw rgba(0, 0, 0, 0.14);
}
.oo-intro-flip .oo-lines,
.oo-intro-flip .oo-num {
  opacity: 0;
  animation: oo-fade-in 0.5s ease-out 1.35s forwards;
}
@keyframes oo-flip {
  from { transform: rotateY(180deg); }
  to { transform: rotateY(0deg); }
}

@media (prefers-reduced-motion: reduce) {
  .oo-intro-rise,
  .oo-intro-rise .oo-photo-wrap,
  .oo-intro-rise .oo-lines,
  .oo-intro-rise .oo-num,
  .oo-intro-develop .oo-photo,
  .oo-intro-develop .oo-lines,
  .oo-intro-develop .oo-num,
  .oo-intro-flip .oo-card,
  .oo-intro-flip .oo-lines,
  .oo-intro-flip .oo-num {
    animation: none !important;
    clip-path: none !important;
    filter: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .oo-intro-flip .oo-card::after {
    display: none;
  }
}
```

- [ ] **Step 5: Write fonts.ts**

`packages/card/src/fonts.ts`:

```ts
export const CARD_FONT_FAMILY = '"EB Garamond", Garamond, Georgia, "Times New Roman", serif';

/** A canvas ctx.font string for the caption at the given pixel size. */
export function cardFont(weight: 400 | 600, px: number): string {
  return `${weight} ${px}px ${CARD_FONT_FAMILY}`;
}

/** Characters from both subsets, so fonts.load fetches latin and latin-ext. */
const SAMPLE_TEXT = "a°Ā";

/**
 * Resolves true when EB Garamond 400 and 600 are loaded and usable by
 * canvas text. Resolves false outside a browser, when the @font-face rules
 * from card.css are not in the document, or when loading fails.
 */
export async function loadCardFonts(): Promise<boolean> {
  if (typeof document === "undefined" || !("fonts" in document)) return false;
  try {
    const faces = await Promise.all([
      document.fonts.load(cardFont(600, 32), SAMPLE_TEXT),
      document.fonts.load(cardFont(400, 32), SAMPLE_TEXT),
    ]);
    return faces.every((f) => f.length > 0);
  } catch {
    return false;
  }
}
```

Add to `packages/card/src/index.ts`:

```ts
export { CARD_FONT_FAMILY, cardFont, loadCardFonts } from "./fonts";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w packages/card -- fonts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/card/fonts packages/card/src/card.css packages/card/src/fonts.ts packages/card/src/index.ts packages/card/test/fonts.test.ts
git commit -m "Bundle EB Garamond and add the card stylesheet with intros

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Intro registry and assignment

**Files:**
- Create: `packages/card/src/intros.ts`
- Modify: `packages/card/src/index.ts`
- Test: `packages/card/test/intros.test.ts`

**Interfaces:**
- Produces: `type IntroId = "rise" | "develop" | "flip"`, `interface Intro { id: IntroId; label: string; numberAt: number; total: number }`, `INTROS: readonly Intro[]`, `seedFromPhoto(sizeBytes: number, width: number, height: number): number` (a 32-bit unsigned hash), `assignIntro(seed: number): Intro`.

- [ ] **Step 1: Write the failing intros tests**

`packages/card/test/intros.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { INTROS, assignIntro, seedFromPhoto } from "../src/intros";

describe("INTROS registry", () => {
  it("lists rise, develop and flip with the prototype's timings", () => {
    expect(INTROS).toEqual([
      { id: "rise", label: "Rise", numberAt: 1700, total: 2300 },
      { id: "develop", label: "Develop", numberAt: 2300, total: 3000 },
      { id: "flip", label: "Flip", numberAt: 1500, total: 2000 },
    ]);
  });
  it("counts up before it settles", () => {
    for (const i of INTROS) expect(i.numberAt).toBeLessThan(i.total);
  });
});

describe("seedFromPhoto", () => {
  it("is deterministic", () => {
    expect(seedFromPhoto(123456, 3024, 4032)).toBe(seedFromPhoto(123456, 3024, 4032));
  });
  it("is a 32-bit unsigned integer", () => {
    const s = seedFromPhoto(1, 1, 1);
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
  });
  it("changes when any input changes", () => {
    const base = seedFromPhoto(123456, 3024, 4032);
    expect(seedFromPhoto(123457, 3024, 4032)).not.toBe(base);
    expect(seedFromPhoto(123456, 4032, 3024)).not.toBe(base);
  });
});

describe("assignIntro", () => {
  it("maps a seed onto the registry in order", () => {
    expect(assignIntro(0).id).toBe("rise");
    expect(assignIntro(1).id).toBe("develop");
    expect(assignIntro(2).id).toBe("flip");
    expect(assignIntro(3).id).toBe("rise");
  });
  it("gives the same intro for the same seed", () => {
    const seed = seedFromPhoto(99, 900, 1200);
    expect(assignIntro(seed)).toBe(assignIntro(seed));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w packages/card -- intros`
Expected: FAIL, "Failed to resolve import "../src/intros"".

- [ ] **Step 3: Implement intros**

`packages/card/src/intros.ts`:

```ts
export type IntroId = "rise" | "develop" | "flip";

export interface Intro {
  id: IntroId;
  label: string;
  /** ms after the intro starts when the number count-up begins (used from step 5). */
  numberAt: number;
  /** ms after the intro starts when the card is settled and controls enable. */
  total: number;
}

/** Adding an intro is one entry here plus one CSS class in card.css. */
export const INTROS: readonly Intro[] = [
  { id: "rise", label: "Rise", numberAt: 1700, total: 2300 },
  { id: "develop", label: "Develop", numberAt: 2300, total: 3000 },
  { id: "flip", label: "Flip", numberAt: 1500, total: 2000 },
];

/**
 * Placeholder seed until step 2's variation seed exists: FNV-1a over the
 * photo's byte size and pixel dimensions, so the same photo always gets
 * the same intro.
 */
export function seedFromPhoto(sizeBytes: number, width: number, height: number): number {
  const input = `${sizeBytes}:${width}:${height}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function assignIntro(seed: number): Intro {
  return INTROS[Math.abs(seed) % INTROS.length]!;
}
```

Add to `packages/card/src/index.ts`:

```ts
export { INTROS, assignIntro, seedFromPhoto } from "./intros";
export type { Intro, IntroId } from "./intros";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w packages/card -- intros`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/card/src/intros.ts packages/card/src/index.ts packages/card/test/intros.test.ts
git commit -m "Add the intro registry with placeholder seed assignment

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `Card`, the DOM painter

**Files:**
- Create: `packages/card/src/Card.tsx`
- Modify: `packages/card/src/index.ts`, `packages/card/vitest.config.ts`
- Test: `packages/card/test/Card.test.tsx`

**Interfaces:**
- Consumes: `IntroId` (Task 4), `LineKind` (Task 2), the classes in `card.css` (Task 3).
- Produces:
  ```ts
  export interface CardPhoto { src: string; width: number; height: number; alt?: string }
  export interface CardProps {
    photo?: CardPhoto | null;            // null renders the empty state
    place: string; date: string; coords: string; number: number | null;
    editable?: boolean;                  // caption lines become contenteditable with hints
    onCaptionChange?: (field: LineKind, text: string) => void;   // fired on blur
    intro?: IntroId | null;              // adds oo-intro-<id> to the frame
    replayKey?: number;                  // change it to restart the intro
    wall?: "light" | "dark";             // light: hairline and shadow; dark: nothing
    border?: ReactNode;                  // step 2 slot, rendered inside .oo-border
    onPick?: () => void;                 // tap or Enter on the empty mat
    id?: string;
  }
  export function Card(props: CardProps): JSX.Element
  ```

- [ ] **Step 1: Let Vitest compile JSX**

Replace `packages/card/vitest.config.ts` with:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
```

- [ ] **Step 2: Write the failing Card tests**

`packages/card/test/Card.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card } from "../src/Card";

const caption = {
  place: "Seoul, South Korea",
  date: "July 1st, 2026",
  coords: "37.5563° N, 126.9236° E",
  number: 3 as number | null,
};
const photo = { src: "blob:photo", width: 900, height: 1200 };

describe("Card with a photo", () => {
  it("renders the photo whole at its natural dimensions", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} />);
    expect(html).toContain('<img class="oo-photo" src="blob:photo" alt="" width="900" height="1200"/>');
    expect(html).toContain('data-empty="false"');
  });

  it("renders the three caption lines and the number", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} />);
    expect(html).toContain('<span class="oo-line oo-line-place">Seoul, South Korea</span>');
    expect(html).toContain('<span class="oo-line oo-line-date">July 1st, 2026</span>');
    expect(html).toContain('<span class="oo-line oo-line-coords">37.5563° N, 126.9236° E</span>');
    expect(html).toContain('<span class="oo-num">#3</span>');
  });

  it("omits empty lines and leaves the number slot empty when null", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} coords="" number={null} />);
    expect(html).not.toContain("oo-line-coords");
    expect(html).toContain('<span class="oo-num"></span>');
  });

  it("keeps empty lines with hints when editable", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} place="" coords="" editable />);
    expect(html).toContain('data-editable="true"');
    expect(html).toContain('data-hint="Where was this?"');
    expect(html).toContain('data-hint="Coordinates"');
    expect(html).toContain('contenteditable="plaintext-only"');
  });

  it("escapes caption text in editable lines", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} place="<b>&" editable />);
    expect(html).toContain("&lt;b&gt;&amp;");
    expect(html).not.toContain("<b>");
  });

  it("applies the intro class on the frame and the wall on the card", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} intro="flip" wall="dark" id="c" />);
    expect(html).toContain('<div class="oo-frame oo-intro-flip" id="c">');
    expect(html).toContain('data-wall="dark"');
  });

  it("defaults to the light wall and no intro", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} />);
    expect(html).toContain('<div class="oo-frame">');
    expect(html).toContain('data-wall="light"');
  });

  it("renders the border slot inside the card", () => {
    const html = renderToStaticMarkup(
      <Card photo={photo} {...caption} border={<i data-texture="grain" />} />,
    );
    expect(html).toContain('<div class="oo-border"><i data-texture="grain"></i></div>');
  });
});

describe("Card empty state", () => {
  it("is a button labelled Add a photo", () => {
    const html = renderToStaticMarkup(<Card photo={null} place="" date="" coords="" number={null} onPick={() => {}} />);
    expect(html).toContain('data-empty="true"');
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Add a photo"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('<div class="oo-empty">Tap to add a photo</div>');
    expect(html).not.toContain('class="oo-photo"');
  });

  it("is not a button without onPick", () => {
    const html = renderToStaticMarkup(<Card photo={null} place="" date="" coords="" number={null} />);
    expect(html).not.toContain('role="button"');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -w packages/card -- Card`
Expected: FAIL, "Failed to resolve import "../src/Card"".

- [ ] **Step 4: Implement Card**

`packages/card/src/Card.tsx`:

```tsx
"use client";

import type { FocusEvent, KeyboardEvent, ReactNode } from "react";
import type { IntroId } from "./intros";
import type { LineKind } from "./layout";

export interface CardPhoto {
  src: string;
  width: number;
  height: number;
  alt?: string;
}

export interface CardProps {
  /** null renders the empty mat. */
  photo?: CardPhoto | null;
  place: string;
  date: string;
  coords: string;
  number: number | null;
  /** Caption lines become contenteditable with hints; empty lines stay visible. */
  editable?: boolean;
  /** Fired when an editable line loses focus. */
  onCaptionChange?: (field: LineKind, text: string) => void;
  /** Adds oo-intro-<id> on the frame so card.css plays it. */
  intro?: IntroId | null;
  /** Change the value to remount the frame and replay the intro. */
  replayKey?: number;
  /** light: hairline and shadow around the card. dark: nothing. The card itself never changes. */
  wall?: "light" | "dark";
  /** Reserved for the step 2 border variation layer. */
  border?: ReactNode;
  /** Tap or Enter on the empty mat. */
  onPick?: () => void;
  id?: string;
}

const HINTS: Record<LineKind, string> = {
  place: "Where was this?",
  date: "When?",
  coords: "Coordinates",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function Card({
  photo = null,
  place,
  date,
  coords,
  number,
  editable = false,
  onCaptionChange,
  intro = null,
  replayKey = 0,
  wall = "light",
  border,
  onPick,
  id,
}: CardProps) {
  const empty = photo === null;
  const pickable = empty && onPick !== undefined;
  const frameClass = intro ? `oo-frame oo-intro-${intro}` : "oo-frame";

  const lines: Array<{ kind: LineKind; text: string }> = [
    { kind: "place", text: place },
    { kind: "date", text: date },
    { kind: "coords", text: coords },
  ].filter((l) => editable || l.text.trim().length > 0);

  const onPickKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick?.();
    }
  };
  const onLineKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };
  const onLineBlur = (kind: LineKind) => (e: FocusEvent<HTMLSpanElement>) => {
    onCaptionChange?.(kind, e.currentTarget.textContent ?? "");
  };

  return (
    <div className={frameClass} id={id} key={replayKey}>
      <figure
        className="oo-card"
        data-wall={wall}
        data-empty={empty ? "true" : "false"}
        data-editable={editable ? "true" : "false"}
        role={pickable ? "button" : undefined}
        tabIndex={pickable ? 0 : undefined}
        aria-label={pickable ? "Add a photo" : undefined}
        onClick={pickable ? onPick : undefined}
        onKeyDown={pickable ? onPickKey : undefined}
      >
        {border ? <div className="oo-border">{border}</div> : null}
        <div className="oo-photo-wrap">
          {photo ? (
            <img
              className="oo-photo"
              src={photo.src}
              alt={photo.alt ?? ""}
              width={photo.width}
              height={photo.height}
            />
          ) : (
            <div className="oo-empty">Tap to add a photo</div>
          )}
        </div>
        <figcaption className="oo-plate">
          <div className="oo-lines">
            {lines.map((l) =>
              editable ? (
                <span
                  key={l.kind}
                  className={`oo-line oo-line-${l.kind}`}
                  data-hint={HINTS[l.kind]}
                  contentEditable="plaintext-only"
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={onLineBlur(l.kind)}
                  onKeyDown={onLineKey}
                  dangerouslySetInnerHTML={{ __html: escapeHtml(l.text) }}
                />
              ) : (
                <span key={l.kind} className={`oo-line oo-line-${l.kind}`}>
                  {l.text}
                </span>
              ),
            )}
          </div>
          <span className="oo-num">{number === null ? "" : `#${number}`}</span>
        </figcaption>
      </figure>
    </div>
  );
}
```

Why `dangerouslySetInnerHTML` on editable lines: React only rewrites the element when the `__html` string changes, so the user's typing is never clobbered mid-edit, and a blur that commits the same text is a no-op. The text is escaped first.

Add to `packages/card/src/index.ts`:

```ts
export { Card } from "./Card";
export type { CardPhoto, CardProps } from "./Card";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w packages/card -- Card`
Expected: PASS, 10 tests.

Run: `npm run typecheck -w packages/card`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/card/src/Card.tsx packages/card/src/index.ts packages/card/vitest.config.ts packages/card/test/Card.test.tsx
git commit -m "Add Card, the DOM painter with editable captions and intro classes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `renderPng`, the canvas painter

**Files:**
- Create: `packages/card/src/renderPng.ts`
- Modify: `packages/card/src/index.ts`
- Test: `packages/card/test/renderPng.test.ts`

**Interfaces:**
- Consumes: `layoutCard`, `CARD` (Task 2); `cardFont`, `loadCardFonts` (Task 3).
- Produces:
  ```ts
  export const PRINT_CAP = 4800;
  export interface PrintDims { photoW: number; photoH: number; scale: number; W: number; H: number; u: number }
  export function printDimensions(naturalW: number, naturalH: number, cap?: number): PrintDims
  export interface Ctx2D { fillStyle; font; textAlign; textBaseline; fillRect; drawImage; fillText; measureText }   // subset of CanvasRenderingContext2D
  export interface CanvasTarget { width: number; height: number; getContext(id: "2d"): Ctx2D | null }
  export function ellipsize(ctx: Pick<Ctx2D, "measureText">, text: string, maxWidth: number): string
  export interface DrawSpec { place: string; date: string; coords: string; number: number | null }
  export function drawCard(ctx: Ctx2D, image: CanvasImageSource, dims: PrintDims, spec: DrawSpec): void
  export interface RenderPngInput extends DrawSpec { image: CanvasImageSource; naturalWidth: number; naturalHeight: number; cap?: number; createCanvas?: (w: number, h: number) => CanvasTarget; toBlob?: (c: CanvasTarget) => Promise<Blob> }
  export interface RenderPngResult { blob: Blob; width: number; height: number; fontsLoaded: boolean; reduced: boolean }
  export function renderPng(input: RenderPngInput): Promise<RenderPngResult>
  ```

- [ ] **Step 1: Write the failing renderPng tests**

`packages/card/test/renderPng.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CARD } from "../src/layout";
import {
  type CanvasTarget,
  type Ctx2D,
  drawCard,
  ellipsize,
  printDimensions,
  renderPng,
} from "../src/renderPng";

type Call = [name: string, ...args: unknown[]];

function fakeCtx() {
  const calls: Call[] = [];
  const ctx: Ctx2D = {
    fillStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillRect: (x, y, w, h) => {
      calls.push(["fillRect", x, y, w, h, ctx.fillStyle]);
    },
    drawImage: (img, x, y, w, h) => {
      calls.push(["drawImage", img, x, y, w, h]);
    },
    fillText: (text, x, y, maxWidth) => {
      calls.push(["fillText", text, x, y, maxWidth, ctx.font, ctx.fillStyle, ctx.textAlign]);
    },
    measureText: (text) => ({ width: text.length * 10 }),
  };
  return { ctx, calls };
}

const image = {} as CanvasImageSource;

describe("printDimensions", () => {
  it("uses the native width below the cap", () => {
    expect(printDimensions(900, 1200)).toEqual({
      photoW: 900, photoH: 1200, scale: 1, W: 1000, u: 10, H: 1442,
    });
  });
  it("caps the photo at 4800 px wide and scales the height", () => {
    expect(printDimensions(6000, 4000)).toEqual({
      photoW: 4800, photoH: 3200, scale: 0.8, W: 5333, u: 53.33, H: 4491,
    });
  });
  it("accepts a smaller cap", () => {
    expect(printDimensions(6000, 4000, 2400)).toMatchObject({ photoW: 2400, photoH: 1600, W: 2667 });
  });
});

describe("ellipsize", () => {
  const { ctx } = fakeCtx();
  it("returns text that fits unchanged", () => {
    expect(ellipsize(ctx, "Seoul", 100)).toBe("Seoul");
  });
  it("trims to an ellipsis within the width", () => {
    expect(ellipsize(ctx, "Seoul, South Korea", 80)).toBe("Seoul,…");
  });
  it("returns just the ellipsis when nothing fits", () => {
    expect(ellipsize(ctx, "Seoul", 5)).toBe("…");
  });
});

describe("drawCard", () => {
  const spec = {
    place: "Seoul, South Korea",
    date: "July 1st, 2026",
    coords: "37.5563° N, 126.9236° E",
    number: 3,
  };
  const dims = printDimensions(900, 1200);
  const fs = 34;
  const lastBaseline = 1442 - 36 - fs * CARD.baselineFromBottom;
  const lineHeight = fs * 1.32;

  it("fills the mat white and draws the photo inside it", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, spec);
    expect(calls[0]).toEqual(["fillRect", 0, 0, 1000, 1442, "#fff"]);
    expect(calls[1]).toEqual(["drawImage", image, 50, 50, 900, 1200]);
  });

  it("draws each line at its baseline, bottom-aligned, in the right weight and color", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, spec);
    const texts = calls.filter((c) => c[0] === "fillText");
    expect(texts).toHaveLength(4);
    expect(texts[0]!.slice(1, 4)).toEqual(["Seoul, South Korea", 80, expect.closeTo(lastBaseline - 2 * lineHeight, 6)]);
    expect(texts[0]!.slice(5)).toEqual(['600 34px "EB Garamond", Garamond, Georgia, "Times New Roman", serif', "#111", "left"]);
    expect(texts[1]!.slice(1, 4)).toEqual(["July 1st, 2026", 80, expect.closeTo(lastBaseline - lineHeight, 6)]);
    expect(texts[2]!.slice(1, 4)).toEqual(["37.5563° N, 126.9236° E", 80, expect.closeTo(lastBaseline, 6)]);
    expect(texts[2]!.slice(5)).toEqual(['400 34px "EB Garamond", Garamond, Georgia, "Times New Roman", serif', "#333", "left"]);
    expect(ctx.textBaseline).toBe("alphabetic");
  });

  it("right-aligns the number on the last baseline", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, spec);
    const num = calls.filter((c) => c[0] === "fillText")[3]!;
    expect(num.slice(1, 4)).toEqual(["#3", 920, expect.closeTo(lastBaseline, 6)]);
    expect(num.slice(5)).toEqual(['600 34px "EB Garamond", Garamond, Georgia, "Times New Roman", serif', "#111", "right"]);
  });

  it("ellipsizes a long place line at 72% of the photo width", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, { ...spec, place: "A".repeat(100) });
    const place = calls.filter((c) => c[0] === "fillText")[0]!;
    expect(place[1]).toBe(`${"A".repeat(63)}…`);
  });

  it("omits the number when null and keeps two lines bottom-aligned", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, { ...spec, coords: "", number: null });
    const texts = calls.filter((c) => c[0] === "fillText");
    expect(texts).toHaveLength(2);
    expect(texts[1]!.slice(1, 4)).toEqual(["July 1st, 2026", 80, expect.closeTo(lastBaseline, 6)]);
  });
});

describe("renderPng", () => {
  const spec = { place: "Seoul", date: "July 1st, 2026", coords: "", number: null };

  function fakeCanvasFactory(maxWidth: number) {
    const made: Array<{ w: number; h: number }> = [];
    const createCanvas = (w: number, h: number): CanvasTarget => {
      if (w > maxWidth) throw new Error("canvas too large");
      made.push({ w, h });
      return { width: w, height: h, getContext: () => fakeCtx().ctx };
    };
    return { createCanvas, made };
  }
  const toBlob = async () => new Blob(["png"], { type: "image/png" });

  it("returns a blob at full size when the canvas is allowed", async () => {
    const { createCanvas, made } = fakeCanvasFactory(10_000);
    const r = await renderPng({ ...spec, image, naturalWidth: 900, naturalHeight: 1200, createCanvas, toBlob });
    expect(made).toEqual([{ w: 1000, h: 1442 }]);
    expect(r).toMatchObject({ width: 1000, height: 1442, reduced: false, fontsLoaded: false });
    expect(r.blob.type).toBe("image/png");
  });

  it("retries at half the cap when the canvas cannot be made", async () => {
    const { createCanvas, made } = fakeCanvasFactory(3000);
    const r = await renderPng({ ...spec, image, naturalWidth: 6000, naturalHeight: 4000, createCanvas, toBlob });
    expect(made).toEqual([{ w: 2667, h: 2245 }]);
    expect(r).toMatchObject({ width: 2667, height: 2245, reduced: true });
  });

  it("throws when both attempts fail", async () => {
    const { createCanvas } = fakeCanvasFactory(100);
    await expect(
      renderPng({ ...spec, image, naturalWidth: 6000, naturalHeight: 4000, createCanvas, toBlob }),
    ).rejects.toThrow("canvas too large");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w packages/card -- renderPng`
Expected: FAIL, "Failed to resolve import "../src/renderPng"".

- [ ] **Step 3: Implement renderPng**

`packages/card/src/renderPng.ts`:

```ts
import { cardFont, loadCardFonts } from "./fonts";
import { layoutCard } from "./layout";

/** Photo width cap for the print PNG, in pixels. 300 dpi at 12 inches needs 3600. */
export const PRINT_CAP = 4800;

export interface PrintDims {
  photoW: number;
  photoH: number;
  scale: number;
  W: number;
  H: number;
  u: number;
}

/** Pixel dimensions of the print: the photo at native width up to the cap, the card around it. */
export function printDimensions(naturalW: number, naturalH: number, cap = PRINT_CAP): PrintDims {
  const photoW = Math.min(naturalW, cap);
  const scale = photoW / naturalW;
  const photoH = Math.round(naturalH * scale);
  const W = Math.round(photoW / 0.9);
  const u = W / 100;
  const H = Math.round(5 * u + photoH + 19.2 * u);
  return { photoW, photoH, scale, W, H, u };
}

/** The part of CanvasRenderingContext2D the painter uses, so a Node canvas or a test fake can stand in. */
export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
}

export interface CanvasTarget {
  width: number;
  height: number;
  getContext(contextId: "2d"): Ctx2D | null;
}

/** Trim text to an ellipsis so it fits maxWidth, matching the screen's text-overflow. */
export function ellipsize(ctx: Pick<Ctx2D, "measureText">, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  for (let end = text.length - 1; end > 0; end -= 1) {
    const candidate = text.slice(0, end).trimEnd() + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) return candidate;
  }
  return ellipsis;
}

export interface DrawSpec {
  place: string;
  date: string;
  coords: string;
  number: number | null;
}

/** Draw the card onto a context whose canvas is dims.W by dims.H. Pure: no fonts loading, no blob. */
export function drawCard(ctx: Ctx2D, image: CanvasImageSource, dims: PrintDims, spec: DrawSpec): void {
  const { photoW, photoH, W, H, u } = dims;
  const layout = layoutCard({ photoW, photoH, ...spec });
  const fs = layout.text.fontSize * u;
  // Positions are measured up from the bottom edge so rounding in H never moves the caption.
  const yFromBottom = (baselineY: number) => H - (layout.height - baselineY) * u;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(image, layout.photo.x * u, layout.photo.y * u, photoW, photoH);

  ctx.textBaseline = "alphabetic";
  for (const line of layout.lines) {
    ctx.font = cardFont(line.weight, fs);
    ctx.fillStyle = line.color;
    ctx.textAlign = "left";
    const text =
      line.kind === "place" ? ellipsize(ctx, line.text, layout.text.placeMaxWidth * u) : line.text;
    ctx.fillText(text, layout.text.left * u, yFromBottom(line.baselineY));
  }
  if (layout.number) {
    ctx.font = cardFont(600, fs);
    ctx.fillStyle = "#111";
    ctx.textAlign = "right";
    ctx.fillText(layout.number.text, layout.text.right * u, yFromBottom(layout.number.baselineY));
  }
}

export interface RenderPngInput extends DrawSpec {
  image: CanvasImageSource;
  naturalWidth: number;
  naturalHeight: number;
  cap?: number;
  /** Defaults to document.createElement("canvas"). Pass a Node canvas factory on a server. */
  createCanvas?: (width: number, height: number) => CanvasTarget;
  /** Defaults to HTMLCanvasElement.toBlob as image/png. */
  toBlob?: (canvas: CanvasTarget) => Promise<Blob>;
}

export interface RenderPngResult {
  blob: Blob;
  width: number;
  height: number;
  /** false when EB Garamond was not available and the fallback serif was drawn. */
  fontsLoaded: boolean;
  /** true when the full-size canvas failed and the PNG was drawn at half the cap. */
  reduced: boolean;
}

function domCanvas(width: number, height: number): CanvasTarget {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function domToBlob(canvas: CanvasTarget): Promise<Blob> {
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/png",
    );
  });
}

/** Render the print PNG. Retries once at half the cap if the phone cannot allocate the full canvas. */
export async function renderPng(input: RenderPngInput): Promise<RenderPngResult> {
  const cap = input.cap ?? PRINT_CAP;
  const createCanvas = input.createCanvas ?? domCanvas;
  const toBlob = input.toBlob ?? domToBlob;
  const fontsLoaded = await loadCardFonts();
  const fullPhotoW = Math.min(input.naturalWidth, cap);

  let lastError: unknown;
  for (const attemptCap of [cap, Math.floor(cap / 2)]) {
    const dims = printDimensions(input.naturalWidth, input.naturalHeight, attemptCap);
    try {
      const canvas = createCanvas(dims.W, dims.H);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get a 2d context");
      drawCard(ctx, input.image, dims, input);
      const blob = await toBlob(canvas);
      return {
        blob,
        width: dims.W,
        height: dims.H,
        fontsLoaded,
        reduced: dims.photoW < fullPhotoW,
      };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not render the card");
}
```

Add to `packages/card/src/index.ts`:

```ts
export { PRINT_CAP, drawCard, ellipsize, printDimensions, renderPng } from "./renderPng";
export type { CanvasTarget, Ctx2D, DrawSpec, PrintDims, RenderPngInput, RenderPngResult } from "./renderPng";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w packages/card -- renderPng`
Expected: PASS, 14 tests.

Run: `npm test -w packages/card` then `npm run typecheck -w packages/card`
Expected: all six test files pass (61 tests); typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/card/src/renderPng.ts packages/card/src/index.ts packages/card/test/renderPng.test.ts
git commit -m "Add renderPng, the canvas painter with cap, ellipsis and half-size retry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Next.js app shell, Board, and the Playwright harness

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/eslint.config.mjs`
- Create: `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/app/page.tsx`, `apps/web/app/board/page.tsx`, `apps/web/app/make/page.tsx`
- Create: `apps/web/components/Icon.tsx`, `apps/web/components/TopBar.tsx`, `apps/web/components/TabBar.tsx`, `apps/web/components/Strip.tsx`, `apps/web/components/StatusLine.tsx`, `apps/web/components/AppFrame.tsx`
- Create: `playwright.config.ts`, `tsconfig.json` (root, for e2e)
- Modify: `package.json` (root typecheck script)
- Test: `e2e/board.spec.ts`

**Interfaces:**
- Consumes: `Card` from `@one-of-one/card` (Task 5), `@one-of-one/card/card.css` (Task 3).
- Produces (all under `apps/web/components`):
  ```ts
  type IconName = "grid" | "plus" | "close" | "back" | "replay" | "grid-plus" | "printer" | "bag" | "pin" | "link" | "navigation";
  function Icon({ name, size = 22 }: { name: IconName; size?: number }): JSX.Element
  function TopBar({ right }: { right?: ReactNode }): JSX.Element           // 48px bar, "1/1" left, one slot right
  function TabBar(): JSX.Element                                            // client; Board, empty, Make; aria-current from pathname
  interface StripCell { label: string; icon?: IconName; text?: string; selected?: boolean; disabled?: boolean; onClick?: () => void; href?: string }
  function Strip({ cells, size = "action" }: { cells: StripCell[]; size?: "action" | "option" }): JSX.Element
  function StatusLine({ children }: { children?: ReactNode }): JSX.Element // <p class="status" role="status" aria-live="polite">
  function AppFrame({ top, children }: { top: ReactNode; children: ReactNode }): JSX.Element  // .app > top, <main class="app-main">, <TabBar/>
  ```
  CSS classes in `globals.css`: `app`, `app-main`, `topbar`, `wordmark`, `topbar-count`, `icon-target`, `tabbar`, `tab`, `strip`, `strip-cell`, `status`, `card-area`, `actions`, `empty-board`.

- [ ] **Step 1: Create the app package**

`apps/web/package.json`:

```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@one-of-one/card": "*",
    "next": "^16.4.2",
    "react": "^19.3.1",
    "react-dom": "^19.3.1"
  },
  "devDependencies": {
    "@types/node": "^24.19.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "eslint": "^10.13.0",
    "eslint-config-next": "^16.4.2",
    "typescript": "~5.9.3"
  }
}
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "allowJs": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The card package ships TypeScript source; Next compiles it.
  transpilePackages: ["@one-of-one/card"],
};

export default nextConfig;
```

`apps/web/eslint.config.mjs`:

```js
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "next-env.d.ts"] },
];
```

Run: `npm install`
Expected: adds next, react, eslint; no peer errors. Then `npx playwright install chromium` (one-time, downloads the browser).

- [ ] **Step 2: Write the root Playwright config and e2e tsconfig**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1200, height: 1700 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: "npm run dev -w apps/web -- --port 3000",
    url: "http://localhost:3000/board",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

Root `tsconfig.json` (typechecks the e2e folder and this config):

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["e2e", "playwright.config.ts"]
}
```

In the root `package.json`, change the typecheck script to:

```json
"typecheck": "tsc -p tsconfig.json && npm run typecheck --workspaces --if-present"
```

- [ ] **Step 3: Write the failing Board test**

`e2e/board.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("the root redirects to the Board, which shows the empty shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByText("1/1")).toBeVisible();
  await expect(page.getByLabel("0 cards")).toHaveText("0");
  await expect(page.getByText("No cards yet.")).toBeVisible();

  const tabs = page.getByRole("navigation", { name: "Tabs" });
  await expect(tabs.getByRole("link", { name: "Board" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Make" })).not.toHaveAttribute("aria-current", "page");
});

test("the Make tab opens the Make screen with the empty mat", async ({ page }) => {
  await page.goto("/board");
  await page.getByRole("link", { name: "Make" }).click();
  await expect(page).toHaveURL(/\/make$/);
  await expect(page.getByText("Tap to add a photo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Make" })).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx playwright test board`
Expected: FAIL. The web server cannot start because `apps/web/app` does not exist yet (or the page 404s).

- [ ] **Step 5: Write the layout, global CSS and the root redirect**

`apps/web/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import type { ReactNode } from "react";
import "@one-of-one/card/card.css";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = { title: "One of One" };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/app/globals.css`:

```css
/* Chrome tokens from SPEC.md. The card never uses these. */
:root {
  --ground: #ffffff;
  --ink: #000000;
  --muted: #6b6b6b;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ground: #000000;
    --ink: #ffffff;
    --muted: #8d8d8d;
  }
}

html,
body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
}
body {
  font-family: var(--font-archivo), "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 500;
  -webkit-font-smoothing: antialiased;
}
a {
  color: inherit;
  text-decoration: none;
}
button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}
button:disabled {
  cursor: default;
}
:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}

/* Frame: one phone-width column. */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: 430px;
  margin: 0 auto;
  padding-top: env(safe-area-inset-top, 0px);
}
.app-main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

/* Top bar: 48px, wordmark left, one 44px target right. */
.topbar {
  height: 48px;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid var(--ink);
}
.wordmark {
  font-size: 13px;
  letter-spacing: 0.06em;
}
.topbar-count {
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding-right: 4px;
}
.icon-target {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
}

/* Tab bar: 84px, three 48 × 44 slots, the middle one empty. */
.tabbar {
  margin-top: auto;
  height: 84px;
  box-sizing: border-box;
  border-top: 1px solid var(--ink);
  background: var(--ground);
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
  padding-top: 10px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.tab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 44px;
  color: var(--muted);
}
.tab[aria-current="page"] {
  color: var(--ink);
  border-bottom: 1px solid var(--ink);
}

/* Strips: equal cells inside a rule; the selected cell inverts. */
.strip {
  display: flex;
  border: 1px solid var(--ink);
}
.strip-cell {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink);
}
.strip-cell + .strip-cell {
  border-left: 1px solid var(--ink);
}
.strip-cell[data-selected="true"] {
  background: var(--ink);
  color: var(--ground);
}
.strip[data-size="option"] .strip-cell {
  height: 44px;
}

/* Screen regions. */
.card-area {
  display: flex;
  justify-content: center;
  padding: 36px 20px 28px;
}
.card-area > * {
  width: 100%;
  max-width: 310px;
}
.status {
  margin: 0 20px 18px;
  min-height: 1.4em;
  font-size: 13px;
  font-weight: 400;
  color: var(--muted);
}
.actions {
  padding: 0 20px;
}
.empty-board {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

`apps/web/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/board");
}
```

- [ ] **Step 6: Write the chrome components**

`apps/web/components/Icon.tsx`:

```tsx
import type { ReactNode } from "react";

export type IconName =
  | "grid" | "plus" | "close" | "back" | "replay" | "grid-plus"
  | "printer" | "bag" | "pin" | "link" | "navigation";

/* Paths copied from the mockups in screens/. 24 viewBox, 1.5 stroke, round caps. */
const PATHS: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <rect x="13.5" y="13.5" width="7" height="7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M15 5l-7 7 7 7" />,
  replay: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8" />
      <path d="M4 3v5h5" />
    </>
  ),
  "grid-plus": (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <path d="M17 14v7M13.5 17.5h7" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V3.5h10V9" />
      <rect x="3.5" y="9" width="17" height="7.5" />
      <path d="M7 16.5v4h10v-4" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 13H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.5s-7-5.8-7-11.5a7 7 0 0 1 14 0c0 5.7-7 11.5-7 11.5z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3" />
    </>
  ),
  navigation: <path d="M20 4L4 11l7 2 2 7z" />,
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
```

`apps/web/components/TopBar.tsx`:

```tsx
import type { ReactNode } from "react";

export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="topbar">
      <span className="wordmark">1/1</span>
      {right ?? <span className="icon-target" />}
    </header>
  );
}
```

`apps/web/components/TabBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

export function TabBar() {
  const path = usePathname();
  const tab = (href: string, label: string, icon: IconName) => (
    <Link
      href={href}
      aria-label={label}
      className="tab"
      aria-current={path.startsWith(href) ? "page" : undefined}
    >
      <Icon name={icon} />
    </Link>
  );
  return (
    <nav className="tabbar" aria-label="Tabs">
      {tab("/board", "Board", "grid")}
      <div className="tab" aria-hidden="true" />
      {tab("/make", "Make", "plus")}
    </nav>
  );
}
```

`apps/web/components/Strip.tsx`:

```tsx
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export interface StripCell {
  /** aria-label; for a text cell, the same words as the text. */
  label: string;
  icon?: IconName;
  text?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
}

export function Strip({ cells, size = "action" }: { cells: StripCell[]; size?: "action" | "option" }) {
  return (
    <div className="strip" data-size={size}>
      {cells.map((c) => {
        const content = c.icon ? <Icon name={c.icon} /> : c.text;
        const selected = c.selected ? "true" : "false";
        return c.href ? (
          <Link key={c.label} href={c.href} className="strip-cell" aria-label={c.label} data-selected={selected}>
            {content}
          </Link>
        ) : (
          <button
            key={c.label}
            type="button"
            className="strip-cell"
            aria-label={c.label}
            data-selected={selected}
            disabled={c.disabled}
            onClick={c.onClick}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
```

`apps/web/components/StatusLine.tsx`:

```tsx
import type { ReactNode } from "react";

export function StatusLine({ children }: { children?: ReactNode }) {
  return (
    <p className="status" role="status" aria-live="polite">
      {children}
    </p>
  );
}
```

`apps/web/components/AppFrame.tsx`:

```tsx
import type { ReactNode } from "react";
import { TabBar } from "./TabBar";

export function AppFrame({ top, children }: { top: ReactNode; children: ReactNode }) {
  return (
    <div className="app">
      {top}
      <main className="app-main">{children}</main>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 7: Write the Board page and a placeholder Make page**

`apps/web/app/board/page.tsx`:

```tsx
import { AppFrame } from "@/components/AppFrame";
import { TopBar } from "@/components/TopBar";

export default function BoardPage() {
  return (
    <AppFrame top={<TopBar right={<span className="topbar-count" aria-label="0 cards">0</span>} />}>
      <div className="empty-board">
        <p className="status">No cards yet.</p>
      </div>
    </AppFrame>
  );
}
```

`apps/web/app/make/page.tsx` (replaced in Task 8):

```tsx
import { Card } from "@one-of-one/card";
import { AppFrame } from "@/components/AppFrame";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";

export default function MakePage() {
  return (
    <AppFrame
      top={
        <TopBar
          right={
            <span className="icon-target" aria-label="Cancel">
              <Icon name="close" size={20} />
            </span>
          }
        />
      }
    >
      <div className="card-area">
        <Card photo={null} place="" date="" coords="" number={null} />
      </div>
    </AppFrame>
  );
}
```

- [ ] **Step 8: Run the Board test to verify it passes**

Run: `npx playwright test board`
Expected: PASS, 2 tests. The first run starts `next dev`, which writes `apps/web/next-env.d.ts` and may rewrite `apps/web/tsconfig.json`; keep whatever it writes.

Open http://localhost:3000/board in a browser (run `npm run dev` if the Playwright server is gone) and check in the Network panel that EB Garamond is served from `/_next/static/media/` and that the tab icons invert when the system theme is dark.

Run: `npm run lint` and `npm run typecheck`
Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json playwright.config.ts apps/web e2e/board.spec.ts
git commit -m "Add the Next.js app shell with Board, chrome components and Playwright

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The Make screen and the fixture photos

**Files:**
- Create: `e2e/fixtures/make-fixtures.mjs`, `apps/web/public/dev/portrait.png`, `apps/web/public/dev/landscape.png`, `apps/web/public/dev/square.png`
- Create: `apps/web/components/useWall.ts`, `apps/web/app/make/MakeScreen.tsx`
- Modify: `apps/web/app/make/page.tsx` (replace the Task 7 placeholder)
- Test: `e2e/make.spec.ts`

**Interfaces:**
- Consumes: `Card`, `renderPng`, `assignIntro`, `seedFromPhoto`, `fmtDate`, `IntroId`, `LineKind` from `@one-of-one/card`; `AppFrame`, `TopBar`, `Strip`, `StatusLine`, `Icon` (Task 7).
- Produces: `useWall(): "light" | "dark"` (follows `prefers-color-scheme`); `MakeScreen()` client component; fixture photos at `/dev/portrait.png` (900 × 1200), `/dev/landscape.png` (900 × 600), `/dev/square.png` (900 × 900), each a flat colour with a white diagonal. Task 9 reuses the fixtures.

- [ ] **Step 1: Write and run the fixture script**

`e2e/fixtures/make-fixtures.mjs`:

```js
// Writes three fixture photos for the e2e tests: flat colour plus a white
// diagonal so a photo that is cropped, stretched or shifted is visible in a diff.
// 900 px wide so the card is exactly 1000 px wide (900 / 0.9) and every
// card dimension is a whole number of pixels.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const out = path.resolve("apps/web/public/dev");
mkdirSync(out, { recursive: true });

const fixtures = {
  portrait: { w: 900, h: 1200, rgb: [196, 120, 80] },
  landscape: { w: 900, h: 600, rgb: [80, 140, 196] },
  square: { w: 900, h: 900, rgb: [110, 160, 110] },
};

for (const [name, { w, h, rgb }] of Object.entries(fixtures)) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const onLine = Math.abs(x / w - y / h) < 0.01;
      png.data[i] = onLine ? 255 : rgb[0];
      png.data[i + 1] = onLine ? 255 : rgb[1];
      png.data[i + 2] = onLine ? 255 : rgb[2];
      png.data[i + 3] = 255;
    }
  }
  writeFileSync(path.join(out, `${name}.png`), PNG.sync.write(png));
  console.log(`${name}.png ${w}x${h}`);
}
```

Run: `npm run fixtures`
Expected output:

```
portrait.png 900x1200
landscape.png 900x600
square.png 900x900
```

- [ ] **Step 2: Write the failing Make tests**

`e2e/make.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

const portrait = path.resolve("apps/web/public/dev/portrait.png");

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
  await expect(page.getByRole("status")).toContainText("The date is the file's.");
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
  await page.getByRole("button", { name: "Replay intro" }).click();
  await expect
    .poll(() => frame.evaluate((el) => el.getAnimations({ subtree: true }).map((a) => a.startTime)))
    .not.toEqual(before);
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx playwright test make`
Expected: FAIL on all four; the placeholder page has no file input, no Print button and Cancel is not a button.

- [ ] **Step 4: Write useWall**

`apps/web/components/useWall.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

/** The wall behind the card follows the system theme; the card itself never changes. */
export function useWall(): "light" | "dark" {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return dark ? "dark" : "light";
}
```

- [ ] **Step 5: Write MakeScreen**

`apps/web/app/make/MakeScreen.tsx`:

```tsx
"use client";

import {
  Card,
  assignIntro,
  fmtDate,
  renderPng,
  seedFromPhoto,
  type IntroId,
  type LineKind,
} from "@one-of-one/card";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Icon } from "@/components/Icon";
import { StatusLine } from "@/components/StatusLine";
import { Strip } from "@/components/Strip";
import { TopBar } from "@/components/TopBar";
import { useWall } from "@/components/useWall";

interface Photo {
  file: File;
  src: string;
  width: number;
  height: number;
  element: HTMLImageElement;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "card";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image could not be decoded"));
    img.src = src;
  });
}

export function MakeScreen() {
  const router = useRouter();
  const wall = useWall();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [place, setPlace] = useState("");
  const [date, setDate] = useState("");
  const [coords, setCoords] = useState("");
  const [intro, setIntro] = useState<IntroId | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // Release the previous photo's object URL when it is replaced or the screen unmounts.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.src);
    };
  }, [photo]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("Reading the photo…");
    const src = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await loadImage(src);
    } catch {
      URL.revokeObjectURL(src);
      setStatus("This photo format can't be shown here. Try a JPEG or PNG.");
      return;
    }
    setPhoto({ file, src, width: img.naturalWidth, height: img.naturalHeight, element: img });
    setPlace("");
    setCoords("");
    setDate(file.lastModified ? fmtDate(new Date(file.lastModified)) : "");
    setIntro(assignIntro(seedFromPhoto(file.size, img.naturalWidth, img.naturalHeight)).id);
    setReplayKey((k) => k + 1);
    setStatus("The date is the file's. Tap the caption lines to type the place and fix the date.");
  }

  function onCaptionChange(field: LineKind, text: string) {
    if (field === "place") setPlace(text);
    else if (field === "date") setDate(text);
    else setCoords(text);
  }

  async function onPrint() {
    if (!photo || busy) return;
    setBusy(true);
    setStatus("Rendering the print…");
    try {
      const r = await renderPng({
        image: photo.element,
        naturalWidth: photo.width,
        naturalHeight: photo.height,
        place,
        date,
        coords,
        number: null,
      });
      const name = `one-of-one-${slug(place)}.png`;
      const file = new File([r.blob], name, { type: "image/png" });
      const notes = [
        r.fontsLoaded ? "" : "Printed with a fallback font.",
        r.reduced ? "Saved at a smaller size than full print resolution." : "",
      ].filter(Boolean);

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          setStatus(["Print shared.", ...notes].join(" "));
        } catch (err) {
          setStatus(err instanceof Error && err.name === "AbortError" ? "Share cancelled." : "Couldn't share the print.");
        }
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(r.blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        setStatus(["Print saved.", ...notes].join(" "));
      }
    } catch {
      setStatus("Couldn't render the print. Try another photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFrame
      top={
        <TopBar
          right={
            <button type="button" className="icon-target" aria-label="Cancel" onClick={() => router.push("/board")}>
              <Icon name="close" size={20} />
            </button>
          }
        />
      }
    >
      <div className="card-area">
        <Card
          photo={photo ? { src: photo.src, width: photo.width, height: photo.height } : null}
          place={place}
          date={date}
          coords={coords}
          number={null}
          editable={photo !== null}
          onCaptionChange={onCaptionChange}
          intro={intro}
          replayKey={replayKey}
          wall={wall}
          onPick={() => fileInput.current?.click()}
        />
      </div>
      <StatusLine>{status}</StatusLine>
      <div className="actions">
        <Strip
          cells={[
            { label: "Replay intro", icon: "replay", disabled: !photo, onClick: () => setReplayKey((k) => k + 1) },
            { label: "Add to board", icon: "grid-plus", selected: true, disabled: true },
            { label: "Print", icon: "printer", disabled: !photo || busy, onClick: onPrint },
          ]}
        />
      </div>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} data-testid="photo-input" />
    </AppFrame>
  );
}
```

Replace `apps/web/app/make/page.tsx` with:

```tsx
import { MakeScreen } from "./MakeScreen";

export default function MakePage() {
  return <MakeScreen />;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx playwright test make board`
Expected: PASS, 6 tests.

Open http://localhost:3000/make in a browser, pick a real phone photo, type a place, tap Print: the PNG downloads (desktop) or the share sheet opens (phone). Check the saved PNG opens and the caption sits on the strip as in `screens/1-make-light.html`.

Run: `npm run lint && npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add e2e/fixtures e2e/make.spec.ts apps/web/public/dev apps/web/components/useWall.ts apps/web/app/make
git commit -m "Add the Make screen: pick a photo, edit the caption, save the PNG

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: The dev route and the equivalence test

**Files:**
- Create: `apps/web/app/dev/card/page.tsx`, `apps/web/app/dev/card/DevCard.tsx`
- Modify: `packages/card/src/layout.ts` (freeze `CARD.baselineFromBottom` to the measured value)
- Test: `e2e/equivalence.spec.ts`

**Interfaces:**
- Consumes: `Card`, `renderPng`, `CARD` from `@one-of-one/card`; fixtures from Task 8.
- Produces: `/dev/card?fixture=<portrait|landscape|square>&coords=<1|0>&number=<1|0>&drift=<0|1>`. The page renders the DOM card in `#dom` at exactly 1000 px wide on a dark wall, the PNG from `renderPng` in `<img id="png">`, writes the DOM's measured baseline fraction into `<output id="baseline">`, and sets `data-ready="1"` on `<body>` when both are in place. `drift=1` pushes the DOM caption up by one unit so the test can prove it notices. The route returns 404 in production.

- [ ] **Step 1: Write the failing equivalence tests**

`e2e/equivalence.spec.ts`:

```ts
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
const MAX_DIFF_RATIO = 0.005;

const FIXTURES = ["portrait", "landscape", "square"] as const;

async function capture(page: Page, query: string) {
  await page.goto(`/dev/card?${query}`);
  await page.waitForSelector('body[data-ready="1"]');
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test equivalence`
Expected: FAIL on every case, "waiting for selector body[data-ready="1"]" times out because `/dev/card` is a 404.

- [ ] **Step 3: Write the dev route**

`apps/web/app/dev/card/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { DevCard, type Fixture } from "./DevCard";

export const dynamic = "force-dynamic";

const FIXTURES: readonly Fixture[] = ["portrait", "landscape", "square"];

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Dev-only: renders the DOM card and the PNG side by side for e2e/equivalence.spec.ts. */
export default async function DevCardPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  const fixture = FIXTURES.find((f) => f === one(q.fixture)) ?? "portrait";
  return (
    <DevCard
      fixture={fixture}
      coords={one(q.coords) !== "0"}
      number={one(q.number) !== "0"}
      drift={one(q.drift) === "1"}
    />
  );
}
```

`apps/web/app/dev/card/DevCard.tsx`:

```tsx
"use client";

import { CARD, Card, renderPng } from "@one-of-one/card";
import { useEffect, useState } from "react";

export type Fixture = "portrait" | "landscape" | "square";

export interface DevCardProps {
  fixture: Fixture;
  coords: boolean;
  number: boolean;
  drift: boolean;
}

const CAPTION = {
  place: "Seoul, South Korea",
  date: "July 1st, 2026",
  coords: "37.5563° N, 126.9236° E",
};

interface Loaded {
  src: string;
  width: number;
  height: number;
  element: HTMLImageElement;
}

export function DevCard({ fixture, coords, number, drift }: DevCardProps) {
  const src = `/dev/${fixture}.png`;
  // Primitives, so the effects below can list them as dependencies.
  const coordsText = coords ? CAPTION.coords : "";
  const numberValue = number ? 3 : null;
  const [photo, setPhoto] = useState<Loaded | null>(null);
  const [pngSrc, setPngSrc] = useState<string | null>(null);
  const [pngLoaded, setPngLoaded] = useState(false);
  const [baseline, setBaseline] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setPhoto({ src, width: img.naturalWidth, height: img.naturalHeight, element: img });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (!photo) return;
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      const r = await renderPng({
        image: photo.element,
        naturalWidth: photo.width,
        naturalHeight: photo.height,
        place: CAPTION.place,
        date: CAPTION.date,
        coords: coordsText,
        number: numberValue,
      });
      if (cancelled) return;
      url = URL.createObjectURL(r.blob);
      setPngSrc(url);

      // Where does the DOM put the last baseline? A zero-size inline-block sits on its line's baseline.
      const card = document.querySelector<HTMLElement>("#dom .oo-card");
      const lastLine = card?.querySelector<HTMLElement>(".oo-lines .oo-line:last-child");
      if (card && lastLine) {
        const probe = document.createElement("span");
        probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
        lastLine.appendChild(probe);
        const cardRect = card.getBoundingClientRect();
        const probeRect = probe.getBoundingClientRect();
        probe.remove();
        const u = cardRect.width / 100;
        setBaseline((cardRect.bottom - probeRect.bottom - CARD.bottom * u) / (CARD.fontSize * u));
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo, coordsText, numberValue]);

  useEffect(() => {
    if (pngLoaded && baseline !== null) document.body.dataset.ready = "1";
    return () => {
      delete document.body.dataset.ready;
    };
  }, [pngLoaded, baseline]);

  return (
    <div style={{ padding: 20, background: "#888" }}>
      <style>{`.drift .oo-plate { padding-bottom: ${CARD.bottom + 1}cqw; }`}</style>
      <div id="dom" className={drift ? "drift" : undefined} style={{ width: 1000 }}>
        <Card
          photo={photo ? { src: photo.src, width: photo.width, height: photo.height } : null}
          place={CAPTION.place}
          date={CAPTION.date}
          coords={coordsText}
          number={numberValue}
          wall="dark"
        />
      </div>
      {pngSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img id="png" src={pngSrc} alt="" onLoad={() => setPngLoaded(true)} style={{ display: "block", marginTop: 20 }} />
      ) : null}
      <output id="baseline">{baseline ?? ""}</output>
    </div>
  );
}
```

- [ ] **Step 4: Measure and freeze the baseline constant**

Run: `npx playwright test equivalence -g "baselineFromBottom"`
Expected: it prints `measured baselineFromBottom: 0.xxxx (CARD has 0.3)`. If the difference is 0.006 or more it fails; either way, copy the measured value rounded to three decimals into `CARD.baselineFromBottom` in `packages/card/src/layout.ts` and update the doc comment there to say when it was measured. Rerun until it passes. Then run `npm test -w packages/card` to confirm the unit tests still pass (they read the constant, so they will).

- [ ] **Step 5: Run the diff cases and freeze the tolerance**

Run: `npx playwright test equivalence`
Expected: twelve match cases print a ratio each; the drift case prints a much larger one. Then:

1. Take the largest ratio among the twelve match cases. Set `MAX_DIFF_RATIO` to twice that value, rounded up to three decimals (for example largest 0.0021 → 0.005).
2. Check the drift ratio is more than three times the new `MAX_DIFF_RATIO`. If it is not, the tolerance is hiding real differences: open the `*-diff.png` files under `test-results/` and fix the cause (a wrong baseline, a wrong inset, fonts not loaded before `renderPng` ran). Do not loosen the drift multiplier.
3. Rerun `npx playwright test equivalence` and confirm all 14 pass.

If a match case fails with "PNG height" mismatching by one pixel, the card height in the DOM is fractional for that fixture; the fixtures are chosen so it is not, so check the fixture was regenerated by `npm run fixtures` and is 900 px wide.

- [ ] **Step 6: Confirm the route is dev-only**

Run:

```bash
npm run build -w apps/web
(npm run start -w apps/web -- --port 3100 > /dev/null 2>&1 & echo $! > /tmp/oo-start.pid; sleep 4; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/dev/card; kill "$(cat /tmp/oo-start.pid)")
```

Expected: the build succeeds and the curl prints `404`.

- [ ] **Step 7: Run everything and commit**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e`
Expected: all green: 61 unit tests, 20 e2e tests.

```bash
git add apps/web/app/dev packages/card/src/layout.ts e2e/equivalence.spec.ts
git commit -m "Add the dev card route and the screen-versus-print equivalence test

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: CI, CLAUDE.md commands and README

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md` (replace the "State of the repo" section), `README.md` (replace the tree and the Start section)

**Interfaces:**
- Consumes: every root script from Tasks 1 and 7.

- [ ] **Step 1: Add the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          CI: "1"
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-results
          path: test-results/
```

- [ ] **Step 2: Replace the "State of the repo" section in CLAUDE.md**

Delete everything from the line `## State of the repo (Oct 21, 2026)` up to, but not including, `## Reference material`, and put this in its place:

````markdown
## Commands

npm workspaces on Node 24. Install once with `npm install` and `npx playwright install chromium`.

```
npm run dev                              Next dev server at http://localhost:3000 (apps/web)
npm test                                 Vitest unit tests in every workspace
npm test -w packages/card -- layout      one unit test file (substring filter on the file name)
npm run test:e2e                         Playwright; starts the dev server itself
npx playwright test -g "landscape"       one e2e case by title
npm run lint                             ESLint (Next config) in apps/web
npm run typecheck                        tsc for e2e, packages/card and apps/web
npm run fixtures                         regenerate apps/web/public/dev/*.png
```

`e2e/equivalence.spec.ts` is the enforcement of the screen-equals-print rule: it diffs the DOM card against the PNG on `/dev/card` and fails on a one-unit drift. `CARD.baselineFromBottom` in `packages/card/src/layout.ts` was measured by it and is frozen; change it only by re-measuring.

## Where things are

- `packages/card` is the renderer, with no app imports. `layout.ts` is the single source of card geometry; `Card.tsx` paints it in DOM and `renderPng.ts` paints it on canvas. Fonts ship in `fonts/` and are declared in `src/card.css`.
- `apps/web` is the Next.js App Router app: chrome components in `components/`, screens under `app/`, `/dev/card` a dev-only route for the equivalence test.
- Build order from SPEC.md: step 1 (renderer and shell) is done. Next is step 2 (variation), then step 3 (EXIF and place resolution on the Make screen). Decisions and plans so far are under `docs/superpowers/`.

````

- [ ] **Step 3: Update README.md**

Replace the whole file with:

````markdown
# One of One

A photo becomes a numbered Polaroid-style card. See `SPEC.md` for the product and `CLAUDE.md` for the rules and commands.

```
CLAUDE.md                 rules and commands Claude Code loads every session
SPEC.md                   the full build spec (source of truth)
docs/superpowers/         design specs and implementation plans, one per build step
packages/card/            the card renderer: layout, DOM painter, PNG painter, fonts, intros
apps/web/                 the Next.js app: Board, Make, chrome
e2e/                      Playwright tests, including the screen-versus-print diff
prototype/one-of-one.html the original working Make screen, kept for reference
screens/                  fourteen HTML mockups, light and dark; open in a browser
```

## Run it

```
npm install
npx playwright install chromium
npm run dev            # http://localhost:3000
npm test               # unit tests
npm run test:e2e       # browser tests
```

Work the build order in SPEC.md one step at a time. Commit after each.
````

- [ ] **Step 4: Run the whole suite one last time**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml CLAUDE.md README.md
git commit -m "Add CI and record the commands in CLAUDE.md and README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Push and confirm the `ci` workflow passes on GitHub before starting step 2.
