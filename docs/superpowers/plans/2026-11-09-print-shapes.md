# Print shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prints can take three shapes: Card, Gallery and Thin, with Gallery the default. They are chosen on a new Print sheet with Plain or Border. Every print matches its preview, and the screen stays the Card shape.

**Architecture:** `packages/card/src/layout.ts` gains a shape registry, `SHAPES`, and `geometryOf(shape)`. The layout function, the print sizing, the border and the DOM card take an optional shape, defaulting to `card`, so nothing that exists today changes. `apps/web` gains a `PrintSheet` that the Print cell opens on Make and on an opened card. The founders' "Border on print" switch is removed. The equivalence suite diffs every shape, each with a tolerance measured on the Mac.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-print-shapes-design.md`

**Deviation from the spec:** the spec kept one tolerance for every shape. Smaller text has less ink, so a one-unit drift changes fewer pixels, and one shared tolerance might no longer prove a drift is caught. Task 2 therefore sets a per-shape tolerance, measured by the repo's own rule, the one written above `MAX_DIFF_RATIO`.

## Global Constraints

- **Working tree:** run every command from the worktree root `/Users/alex/Desktop/one-of-one-handoff/.claude/worktrees/variation-facts`, on branch `print-shapes`. Never use bare `git stash`.
- **Dependencies:** npm workspaces on Node 24. No new dependencies. `packages/card` has no app imports.
- **Shapes, in units of the print's width:**

  | Shape | Border | Strip | Text |
  |---|---|---|---|
  | card | 5 | 16 | 3 |
  | gallery | 3 | 9.5 | 1.8 |
  | thin | 2 | 7 | 1.3 |

  - Photo width = 100 − 2 × border. Text indent = text size. Gap under the photo = 0.8 × text size.
  - The line height (1.2), the place line's width limit (0.72 of the photo width), the baseline ratio (0.27), the inks and the weights are shared by every shape.
- **The Card shape is exactly today's card.** `geometryOf("card")` equals `CARD`. Every default is `card`. Every existing card on screen, every existing test expectation and the photo-region pixel test stay as they are.
- **Print rules:**
  - The photo is never cropped and is drawn at native resolution, under `PRINT_CAP`.
  - Print width is `Math.round((photoW * 100) / photoWidth)`.
  - A print has no intro and no motion.
- **Spelling and words:** prose and comments use British spelling ("colour"). The chrome words are Shape, Card, Gallery, Thin, Border, Plain, Cancel and Save print. Icon-only controls carry an aria-label.
- **Commit messages:** one plain descriptive sentence, a blank line, then `Co-Authored-By: <the model you are> <noreply@anthropic.com>`.
- **Port 3000:** the browser suite cannot share a running dev server. Next 16 refuses a second `next dev` in the same app, and Playwright needs the sign-in bypass off. Before any Playwright or `check:prod` run, make sure nothing listens on port 3000 (`lsof -nP -iTCP:3000 -sTCP:LISTEN`). The controller stops its dev server before dispatching.

## File map

| File | Change |
| --- | --- |
| `packages/card/src/layout.ts` | `SHAPES`, `Shape`, `ShapeDef`, `CardGeometry`, `geometryOf`; `layoutCard` and `cardHeightUnits` take a shape |
| `packages/card/src/renderPng.ts` | `printDimensions` takes a shape and `PrintDims` carries it; `renderPng` takes `shape` |
| `packages/card/src/border.ts` | `borderSvg` and `borderDataUrl` take a shape |
| `packages/card/src/Card.tsx` | `shape` prop; frame variables per shape |
| `packages/card/src/card.css` | `.oo-num` gap from `--oo-inset` |
| `packages/card/src/index.ts` | Exports |
| `packages/card/test/layout.test.ts`, `renderPng.test.ts`, `border.test.ts`, `Card.test.tsx` | Tests |
| `apps/web/app/dev/card/page.tsx`, `DevCard.tsx`, `e2e/equivalence.spec.ts` | Every shape in the equivalence suite |
| `apps/web/components/PrintSheet.tsx`, `print-sheet.css` | Create |
| `apps/web/lib/print.ts` | `border` and `shape` |
| `apps/web/app/make/MakeScreen.tsx`, `apps/web/app/card/[id]/CardScreen.tsx` | Print opens the sheet |
| `apps/web/components/DesignPanel.tsx` | "Border on print" goes |
| `e2e/make.spec.ts` (and any spec that clicks Print) | Through the sheet |
| `SPEC.md`, `CLAUDE.md` | The shapes |

---

### Task 1: Shapes in the card package

**Files:**
- Modify: `packages/card/src/layout.ts`, `packages/card/src/renderPng.ts`, `packages/card/src/border.ts`, `packages/card/src/Card.tsx`, `packages/card/src/card.css` (the `.oo-num` rule, about line 156), `packages/card/src/index.ts`
- Test: `packages/card/test/layout.test.ts`, `packages/card/test/renderPng.test.ts`, `packages/card/test/border.test.ts`, `packages/card/test/Card.test.tsx`

**Interfaces:**
- Produces:
  - **Shape types:** `type Shape = "card" | "gallery" | "thin"` (as `keyof typeof SHAPES`), `interface ShapeDef { id: string; label: string; mat: number; stripHeight: number; fontSize: number }` and `SHAPES` with labels "Card", "Gallery" and "Thin".
  - **Geometry:** `interface CardGeometry`, which has the same keys as `CARD`, and `geometryOf(shape: Shape): CardGeometry`.
  - **Shape parameters:** each of these gains a trailing parameter defaulting to `"card"`:
    - `layoutCard(spec, shape)`
    - `cardHeightUnits(w, h, shape)`
    - `printDimensions(w, h, cap, shape)`
    - `borderSvg(v, H, shape)`
    - `borderDataUrl(v, H, shape)`
  - **Print dimensions:** `PrintDims.shape: Shape`, and `RenderPngInput.shape?: Shape`.
  - **DOM card:** `Card` gains the prop `shape?: Shape`.
  - **Exports:** `SHAPES`, `geometryOf` and the types are exported from `@one-of-one/card`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/card/test/layout.test.ts`, extending its `../src/layout` import with `SHAPES` and `geometryOf`:

```ts
describe("print shapes", () => {
  const full = { place: "Seoul, South Korea", date: "July 1st, 2026", coords: "37.5563° N, 126.9236° E", number: 3 };

  it("has Card, Gallery and Thin, and the Card shape is exactly the card", () => {
    expect(Object.values(SHAPES).map((s) => s.label)).toEqual(["Card", "Gallery", "Thin"]);
    expect(geometryOf("card")).toEqual(CARD);
    expect(layoutCard({ photoW: 900, photoH: 1200, ...full }, "card")).toEqual(layoutCard({ photoW: 900, photoH: 1200, ...full }));
  });
  it("derives the photo width, the indent and the gap from the border and the text", () => {
    expect(geometryOf("gallery")).toMatchObject({ mat: 3, photoWidth: 94, stripHeight: 9.5, fontSize: 1.8, inset: 1.8, gap: 1.44 });
    expect(geometryOf("thin")).toMatchObject({ mat: 2, photoWidth: 96, stripHeight: 7, fontSize: 1.3, inset: 1.3, gap: 1.04 });
  });
  it("lays out a shape around the photo, never cropping it", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full }, "gallery");
    expect(l.photo).toEqual({ x: 3, y: 3, w: 94, h: (94 * 1200) / 900 });
    expect(l.height).toBeCloseTo(3 + (94 * 1200) / 900 + 9.5, 9);
    expect(l.text.left).toBeCloseTo(4.8, 9);
    expect(l.text.right).toBeCloseTo(95.2, 9);
    expect(l.text.fontSize).toBe(1.8);
  });
  it("leaves at least 0.8 of the text size of air under three caption lines, in every shape", () => {
    for (const shape of Object.keys(SHAPES) as Array<keyof typeof SHAPES>) {
      const g = geometryOf(shape);
      const l = layoutCard({ photoW: 900, photoH: 1200, ...full }, shape);
      const thirdLineBoxBottom = l.strip.y + g.gap + 3 * g.fontSize * g.lineHeight;
      expect(l.height - thirdLineBoxBottom, shape).toBeGreaterThanOrEqual(0.8 * g.fontSize - 1e-9);
    }
  });
  it("gives each shape its own height", () => {
    expect(cardHeightUnits(900, 1200, "card")).toBeCloseTo(141, 9);
    expect(cardHeightUnits(900, 1200, "gallery")).toBeCloseTo(3 + 94 * (4 / 3) + 9.5, 9);
    expect(cardHeightUnits(900, 600, "thin")).toBeCloseTo(2 + 64 + 7, 9);
  });
});
```

Add to `packages/card/test/renderPng.test.ts`. Use the `printDimensions` import the file already has, and add one if it lacks it.

```ts
describe("printDimensions per shape", () => {
  it("keeps the photo native and sizes the print from the shape", () => {
    expect(printDimensions(900, 1200)).toMatchObject({ photoW: 900, photoH: 1200, W: 1000, H: 1410, shape: "card" });
    expect(printDimensions(900, 1200, PRINT_CAP, "gallery")).toMatchObject({ photoW: 900, photoH: 1200, W: 957, H: 1320, shape: "gallery" });
    expect(printDimensions(900, 1200, PRINT_CAP, "thin")).toMatchObject({ photoW: 900, photoH: 1200, W: 938, H: 1284, shape: "thin" });
    expect(printDimensions(6864, 5152, PRINT_CAP, "gallery")).toMatchObject({ photoW: 4800, W: 5106 });
  });
});
```

(Gallery on a 6864-wide photo: the cap gives `photoW` 4800, and `W = Math.round(480000 / 94)` = 5106.)

Add to `packages/card/test/border.test.ts`:

```ts
describe("borderSvg per shape", () => {
  it("cuts the photo box out at the shape's border and photo width", () => {
    const svg = borderSvg(base, cardHeightUnits(900, 1200, "thin"), "thin");
    expect(svg).toContain(`M2 2h96v128h-96Z`);
  });
  it("draws the Card shape exactly as before", () => {
    expect(borderSvg(base, H, "card")).toBe(borderSvg(base, H));
  });
});
```

Import `cardHeightUnits` from `../src/layout`. The photo is 900 × 1200, so at photo width 96 its height is 128. The clip path writes `M${photo.x} ${photo.y}h${photo.w}v${photo.h}h-${photo.w}Z`.

Add to `packages/card/test/Card.test.tsx`, inside `describe("Card with a photo", …)`:

```tsx
  it("takes a print shape's geometry, and is the card by default", () => {
    const gallery = renderToStaticMarkup(<Card photo={photo} {...caption} shape="gallery" />);
    for (const v of ["--oo-mat:3cqw", "--oo-strip:9.5cqw", "--oo-fs:1.8cqw", "--oo-inset:1.8cqw", "--oo-gap:1.44cqw", "--oo-place-max:67.68cqw"]) {
      expect(gallery).toContain(v);
    }
    const card = renderToStaticMarkup(<Card photo={photo} {...caption} />);
    for (const v of ["--oo-mat:5cqw", "--oo-strip:16cqw", "--oo-fs:3cqw", "--oo-inset:3cqw", "--oo-gap:2.4cqw", "--oo-place-max:64.8cqw"]) {
      expect(card).toContain(v);
    }
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -w packages/card -- layout renderPng border Card`
Expected: FAIL, with `SHAPES` and `geometryOf` not exported, and the shape arguments ignored.

- [ ] **Step 3: Implement `layout.ts`**

After the `CARD` constant, add:

```ts
/** The fields of CARD, with numbers that a print shape may change. */
export interface CardGeometry {
  width: 100;
  mat: number;
  photoWidth: number;
  stripHeight: number;
  fontSize: number;
  lineHeight: number;
  inset: number;
  gap: number;
  placeMaxWidthRatio: number;
  ink: "#111";
  inkCoords: "#333";
  weight: 600;
  weightCoords: 400;
  baselineFromBottom: number;
}

export interface ShapeDef {
  id: string;
  label: string;
  /** Border on the top and sides, caption strip and text size, in units of the print's width. */
  mat: number;
  stripHeight: number;
  fontSize: number;
}

/**
 * Print shapes (decided Nov 9, 2026). The screen is always the card; a print may take
 * any shape. A shape sets the border, the strip and the text; the photo takes the
 * rest of the width, and the indent and the gap follow the text as on the card.
 */
export const SHAPES = {
  card: { id: "card", label: "Card", mat: CARD.mat, stripHeight: CARD.stripHeight, fontSize: CARD.fontSize },
  gallery: { id: "gallery", label: "Gallery", mat: 3, stripHeight: 9.5, fontSize: 1.8 },
  thin: { id: "thin", label: "Thin", mat: 2, stripHeight: 7, fontSize: 1.3 },
} as const satisfies Record<string, ShapeDef>;
export type Shape = keyof typeof SHAPES;

const round4 = (n: number) => Number(n.toFixed(4));

/** A shape's full geometry. The card's is CARD itself: indent = text size, gap = 0.8 × text size. */
export function geometryOf(shape: Shape): CardGeometry {
  const s: ShapeDef = SHAPES[shape];
  return {
    ...CARD,
    mat: s.mat,
    photoWidth: round4(CARD.width - 2 * s.mat),
    stripHeight: s.stripHeight,
    fontSize: s.fontSize,
    inset: s.fontSize,
    gap: round4(0.8 * s.fontSize),
  };
}
```

Change `layoutCard`'s signature to `export function layoutCard(spec: CardSpec, shape: Shape = "card"): CardLayout {` and make `const g = geometryOf(shape);` its first line. Then replace every `CARD.` inside `layoutCard`'s body with `g.`; there are 18. Do not touch `CARD.` anywhere else in the file. The return's `text.right` stays `g.mat + g.photoWidth - g.inset`.

Change `cardHeightUnits` to:

```ts
/** Card height in units for a photo of this aspect ratio: border + photo + caption strip, in the given shape. */
export function cardHeightUnits(photoW: number, photoH: number, shape: Shape = "card"): number {
  const g = geometryOf(shape);
  return g.mat + (g.photoWidth * photoH) / photoW + g.stripHeight;
}
```

- [ ] **Step 4: Implement `renderPng.ts`**

The import from `./layout` becomes `import { CARD, type Shape, geometryOf, layoutCard } from "./layout";`. Add `shape: Shape;` to `PrintDims`. Replace `printDimensions` with:

```ts
/** Pixel dimensions of the print: the photo at native width up to the cap, the shape around it. */
export function printDimensions(naturalW: number, naturalH: number, cap = PRINT_CAP, shape: Shape = "card"): PrintDims {
  const g = geometryOf(shape);
  const photoW = Math.min(naturalW, cap);
  const scale = photoW / naturalW;
  const photoH = Math.round(naturalH * scale);
  const W = Math.round((photoW * CARD.width) / g.photoWidth);
  const u = W / 100;
  const H = Math.round(g.mat * u + photoH + g.stripHeight * u);
  return { photoW, photoH, scale, W, H, u, shape };
}
```

For the Card shape, `(photoW * 100) / 90` rounds the same as the old `photoW / 0.9` for every whole `photoW`. A half can only arise if `20 × photoW = 18k + 9`, which is impossible, so card prints keep their exact size.

In `drawCard`, `layoutCard({ photoW, photoH, ...spec })` becomes `layoutCard({ photoW, photoH, ...spec }, dims.shape)`.

In `RenderPngInput`, add:

```ts
  /** The print shape; the card by default. */
  shape?: Shape;
```

In `renderPng`, `printDimensions(input.naturalWidth, input.naturalHeight, attemptCap)` becomes `printDimensions(input.naturalWidth, input.naturalHeight, attemptCap, input.shape ?? "card")`.

- [ ] **Step 5: Implement `border.ts`**

The import from `./layout` becomes `import { type Shape, geometryOf } from "./layout";`. Check that `CARD` is no longer used in `border.ts`; if it still is, keep it in the import.

`borderSvg`'s signature becomes `export function borderSvg(v: Variation, cardHeightUnits: number, shape: Shape = "card"): string {`. Its first lines read:

```ts
  const g = geometryOf(shape);
  const H = Number(cardHeightUnits.toFixed(3));
  const photo = {
    x: g.mat,
    y: g.mat,
    w: g.photoWidth,
    h: Number((H - g.mat - g.stripHeight).toFixed(3)),
  };
```

`borderDataUrl` becomes:

```ts
/** The border document as an image URL. */
export function borderDataUrl(v: Variation, cardHeightUnits: number, shape: Shape = "card"): string {
  return svgDataUrl(borderSvg(v, cardHeightUnits, shape));
}
```

- [ ] **Step 6: Implement `Card.tsx` and `card.css`**

In `Card.tsx`:
- The `./layout` import becomes `import { CARD, SHAPES, type Shape, cardHeightUnits, geometryOf } from "./layout";`.
- Replace the `FRAME_VARS` constant with:

```ts
const round4 = (n: number) => Number(n.toFixed(4));

/** Geometry and type for card.css, from the shape's geometry so the two painters share one source. Built once per shape. */
const FRAME_VARS = Object.fromEntries(
  (Object.keys(SHAPES) as Shape[]).map((shape) => {
    const g = geometryOf(shape);
    const vars = {
      "--oo-mat": `${g.mat}cqw`,
      "--oo-strip": `${g.stripHeight}cqw`,
      "--oo-inset": `${g.inset}cqw`,
      "--oo-gap": `${g.gap}cqw`,
      "--oo-fs": `${g.fontSize}cqw`,
      "--oo-lh": `${g.lineHeight}`,
      "--oo-place-max": `${round4(g.photoWidth * g.placeMaxWidthRatio)}cqw`,
      "--oo-font": CARD_FONT_FAMILY,
      "--oo-ink": g.ink,
      "--oo-ink-coords": g.inkCoords,
      "--oo-weight": `${g.weight}`,
      "--oo-weight-coords": `${g.weightCoords}`,
    } as CSSProperties;
    return [shape, vars];
  }),
) as Record<Shape, CSSProperties>;
```

- In `CardProps`, add:

```ts
  /** The print shape for a print preview; the screen card is always the default, "card". */
  shape?: Shape;
```

- Add `shape = "card",` to the destructured props.
- `const height = photo ? cardHeightUnits(photo.width, photo.height) : null;` becomes `const height = photo ? cardHeightUnits(photo.width, photo.height, shape) : null;`.
- The border's `src={borderDataUrl(variation, height!)}` becomes `src={borderDataUrl(variation, height!, shape)}`.
- The frame's `style={FRAME_VARS}` becomes `style={FRAME_VARS[shape]}`.

In `card.css`, inside `.oo-num`, `padding-left: 3cqw;` becomes `padding-left: var(--oo-inset);`. That is the same value for the Card shape.

- [ ] **Step 7: Exports**

In `packages/card/src/index.ts`:
- The layout lines become:

```ts
export { CARD, SHAPES, cardHeightUnits, geometryOf, layoutCard } from "./layout";
export type { CaptionLine, CardGeometry, CardLayout, CardSpec, LineKind, Shape, ShapeDef } from "./layout";
```

- `PRINT_CAP` and `printDimensions` are already exported from `./renderPng`. Check this.

- [ ] **Step 8: Run the checks**

Run: `npm test && npm run typecheck && npm run lint`
Expected:
- every unit test passes, including the new ones;
- the existing layout tests still pass unchanged, because the Card shape is exactly `CARD`;
- typecheck and lint are clean.

- [ ] **Step 9: Commit**

```bash
git add packages/card
git commit -F - <<'EOF'
Give the card's layout three print shapes, Card, Gallery and Thin, each a border, a strip and a text size with the photo taking the rest, so the print painter, the border and the DOM card can all be drawn in any shape while the screen card stays exactly as it is

Co-Authored-By: <the model you are> <noreply@anthropic.com>
EOF
```

---

### Task 2: Every shape in the equivalence suite

**Files:**
- Modify: `apps/web/app/dev/card/page.tsx`, `apps/web/app/dev/card/DevCard.tsx`, `e2e/equivalence.spec.ts`

**Interfaces:**
- Consumes: `SHAPES`, `Shape`, `geometryOf`, the trailing `shape` parameters, the `RenderPngInput.shape` option and `Card`'s `shape` prop, all from Task 1.
- Produces: `/dev/card?shape=gallery|thin` draws the DOM card and the PNG in that shape, both exactly 1000 px wide.

- [ ] **Step 1: Let `/dev/card` take a shape**

In `apps/web/app/dev/card/page.tsx`:
- Import `SHAPES` and `type Shape` from `@one-of-one/card`.
- Parse `const shape = (Object.keys(SHAPES) as Shape[]).find((s) => s === one(q.shape)) ?? "card";`.
- Pass `shape={shape}` to `DevCard`.

In `apps/web/app/dev/card/DevCard.tsx`:
- Add `shape: Shape;` to `DevCardProps` and destructure it.
- Import `type Shape` and `geometryOf` from `@one-of-one/card`.
- Replace the photo-loading effect with this one. It sizes the fixture so that, in any shape, the print is exactly 1000 px wide like the DOM card (u = 10 px), and the border falls on whole pixels:

```ts
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      // In any shape the print is 1000 px wide like the DOM card (u = 10 px): the photo is the shape's photo width × 10.
      const width = Math.round(geometryOf(shape).photoWidth * 10);
      if (width === img.naturalWidth) {
        setPhoto({ src, width: img.naturalWidth, height: img.naturalHeight, element: img });
        return;
      }
      const height = Math.round((img.naturalHeight * width) / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      const sized = new Image();
      sized.onload = () => {
        if (!cancelled) setPhoto({ src: sized.src, width, height, element: sized });
      };
      sized.src = canvas.toDataURL("image/png");
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, shape]);
```

- In the PNG effect, pass `shape` to `renderPng` (`shape,` in its input).
- The border becomes `borderSvg(variation, cardHeightUnits(photo.width, photo.height, shape), shape)`.
- The baseline probe divides by `geometryOf(shape).fontSize * u` instead of `CARD.fontSize * u`.
- Add `shape` to that effect's dependency list.
- The drift style's `${CARD.gap + 1}cqw` becomes `${geometryOf(shape).gap + 1}cqw`.
- Pass `shape={shape}` to the `<Card>`.
- Remove `CARD` from the import if nothing uses it any more.

- [ ] **Step 2: Add the cases, measuring first**

In `e2e/equivalence.spec.ts`, add `SHAPES` to the `../packages/card/src/layout` import. Inside the `pixel ratios (macOS only)` describe, after the border-drift test, add:

```ts
// Every print shape beyond the card, so adding one adds its cases. Each shape has its own tolerance,
// set by the rule above MAX_DIFF_RATIO: about twice the largest matching ratio observed on macOS
// Chromium, with a one-unit caption drift exceeding three times it. Smaller text has less ink, so
// both the noise and the drift shrink with it.
const SHAPE_DIFF_RATIO: Record<string, number> = { gallery: MAX_DIFF_RATIO, thin: MAX_DIFF_RATIO };

for (const shape of Object.keys(SHAPES).filter((s) => s !== "card")) {
  for (const fixture of FIXTURES) {
    const name = `${fixture}-${shape}`;
    test(`${name}: the DOM card and the PNG match`, async ({ page }) => {
      const { dom, png } = await capture(page, `fixture=${fixture}&coords=1&number=1&shape=${shape}`);
      expect(diffRatio(dom, png, name)).toBeLessThan(SHAPE_DIFF_RATIO[shape]!);
    });
  }
  test(`${shape}: a one-unit caption drift is caught`, async ({ page }) => {
    const { dom, png } = await capture(page, `fixture=portrait&coords=1&number=1&drift=1&shape=${shape}`);
    expect(diffRatio(dom, png, `${shape}-drift`)).toBeGreaterThan(SHAPE_DIFF_RATIO[shape]! * 3);
  });
  test(`portrait-${shape}-texture-foil: the DOM card and the PNG match`, async ({ page }) => {
    const { dom, png } = await capture(page, `fixture=portrait&coords=1&number=1&texture=foil&tier=foil&shape=${shape}`);
    expect(diffRatio(dom, png, `portrait-${shape}-texture-foil`)).toBeLessThan(MAX_TEXTURE_DIFF_RATIO);
  });
}
```

Make sure nothing listens on port 3000, then run: `npx playwright test e2e/equivalence.spec.ts`. Each case logs `<name>: N differing pixels, ratio R`. Record, for each shape:
- the largest ratio among its three fixture cases;
- its drift ratio.

- [ ] **Step 3: Set each shape's tolerance**

For each shape, set `SHAPE_DIFF_RATIO[shape]` to about twice its largest observed matching ratio, rounded up to one significant figure. The value must:
- be at least `0.0002`;
- be no more than `MAX_DIFF_RATIO`;
- leave the drift ratio above three times it.

Record the observed numbers in the comment above `SHAPE_DIFF_RATIO`, as the existing comment does for the card: "largest observed X, drift Y, on macOS Chromium, 2026-11-09".

**If any shape's drift ratio is not above three times its tolerance, stop and report NEEDS_CONTEXT** with every observed number. Do not loosen the drift assertion. If a texture case fails `MAX_TEXTURE_DIFF_RATIO`, report it the same way.

Run `npx playwright test e2e/equivalence.spec.ts` again.
Expected: every case passes, the existing card cases unchanged. That includes the baseline test and the photo-region pixel test, both Card.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/dev/card e2e/equivalence.spec.ts
git commit -F - <<'EOF'
Diff the DOM card against the PNG in every print shape, at 1000 px wide, with a tolerance per shape measured on the Mac by the suite's own rule and a drift case proving each still catches a one-unit shift

Co-Authored-By: <the model you are> <noreply@anthropic.com>
EOF
```

---

### Task 3: The Print sheet

**Files:**
- Create: `apps/web/components/PrintSheet.tsx`, `apps/web/components/print-sheet.css`
- Modify: `apps/web/lib/print.ts`, `apps/web/app/make/MakeScreen.tsx`, `apps/web/app/card/[id]/CardScreen.tsx`, `apps/web/components/DesignPanel.tsx`, `SPEC.md`, `CLAUDE.md`
- Test: `e2e/make.spec.ts`, plus any other `e2e/*.spec.ts` that clicks the Print cell (`grep -n 'name: "Print"' e2e/*.ts`)

**Interfaces:**
- Consumes (Task 1): `SHAPES`, `type Shape`, `Card`'s `shape` prop, and the trailing `shape` parameters of `borderSvg` and `cardHeightUnits`, plus `RenderPngInput.shape`.
- Produces:
  - **The sheet:** `PrintSheet` and `interface PrintChoice { shape: Shape; border: boolean }`.
  - **The print call:** `printCard` input `{ …, border: boolean, shape: Shape }`. `borderOnPrint` is removed.
  - **The dialog:** `role="dialog"` named "Print", holding:
    - a "Shape" field and a "Border" field, each a `.print-field`;
    - a "Cancel" button;
    - a "Save print" button.

- [ ] **Step 1: Write the failing browser tests**

In `e2e/make.spec.ts`, add `type Page` to the `@playwright/test` import, and add this helper below the `beforeEach`:

```ts
/** Picks a shape (and a border) on the open Print sheet and saves; resolves with the saved file's name and path. */
async function saveFromSheet(page: Page, options: { shape?: "Card" | "Gallery" | "Thin"; border?: "Plain" | "Border" } = {}) {
  const sheet = page.getByRole("dialog", { name: "Print" });
  await expect(sheet).toBeVisible();
  await sheet.locator(".print-field", { hasText: "Shape" }).getByRole("button", { name: options.shape ?? "Card", exact: true }).click();
  if (options.border) await sheet.locator(".print-field", { hasText: "Border" }).getByRole("button", { name: options.border, exact: true }).click();
  const download = page.waitForEvent("download");
  await sheet.getByRole("button", { name: "Save print", exact: true }).click();
  const dl = await download;
  return { name: dl.suggestedFilename(), path: (await dl.path())! };
}
```

Update every existing test that saves a print, so it goes through the sheet with the Card shape and keeps its current expectations. A test that did:

```ts
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).click();
  const dl = await download;
  expect(dl.suggestedFilename()).toBe("one-of-one-seoul-south-korea.png");
  const png = PNG.sync.read(readFileSync((await dl.path())!));
```

now does:

```ts
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const dl = await saveFromSheet(page);
  expect(dl.name).toBe("one-of-one-seoul-south-korea.png");
  const png = PNG.sync.read(readFileSync(dl.path));
```

The test that clicks with `dispatchEvent("click")` keeps that call (`page.getByRole("button", { name: "Print", exact: true }).dispatchEvent("click")`), then calls `saveFromSheet(page)`.

Rewrite `"the printed PNG carries the border, differs between textures, and can leave it off"` so its `print` helper goes through the sheet:

```ts
  const print = async (border: "Plain" | "Border" = "Border") => {
    await page.getByRole("button", { name: "Print", exact: true }).click();
    return readFileSync((await saveFromSheet(page, { shape: "Card", border })).path);
  };
```

- Delete its `borderOnPrint` locator.
- Replace its last block with `const plain = await print("Plain"); expect(plain.equals(paper)).toBe(false);`.
- Add `await expect(page.locator(".design-field", { hasText: "Border on print" })).toHaveCount(0);` near its start.

Run `grep -n 'name: "Print"' e2e/*.ts` and route any other print in other specs through the same steps. Copy the helper into that file if needed.

Add a test:

```ts
test("the Print sheet offers Card, Gallery and Thin with Gallery picked, and saves the shape picked", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(portrait);
  await expect(page.locator("img.oo-photo")).toBeVisible();

  await page.getByRole("button", { name: "Print", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Print" });
  await expect(sheet).toBeVisible();
  const shape = sheet.locator(".print-field", { hasText: "Shape" });
  await expect(shape.getByRole("button", { name: "Gallery", exact: true })).toHaveAttribute("data-selected", "true");
  await expect(sheet.locator(".print-field", { hasText: "Border" }).getByRole("button", { name: "Border", exact: true })).toHaveAttribute("data-selected", "true");
  const frame = sheet.locator(".oo-frame");
  await expect(frame).toHaveAttribute("style", /--oo-mat:\s*3cqw/);
  await shape.getByRole("button", { name: "Thin", exact: true }).click();
  await expect(frame).toHaveAttribute("style", /--oo-mat:\s*2cqw/);

  // Cancel closes it, and every opening starts at Gallery again.
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(shape.getByRole("button", { name: "Gallery", exact: true })).toHaveAttribute("data-selected", "true");

  const dl = await saveFromSheet(page, { shape: "Thin" });
  await expect(sheet).toHaveCount(0);
  expect(dl.name).toBe("one-of-one-card-thin.png");
  const png = PNG.sync.read(readFileSync(dl.path));
  expect(png.width).toBe(938);
  expect(png.height).toBe(1284);
  await expect(page.getByRole("status")).toContainText("Print saved.");
});
```

The portrait fixture has no place, so its slug is "card". Thin on 900 × 1200 is 938 × 1284 (Task 1). If `Strip` exposes selection through another attribute than `data-selected`, use that one; check `apps/web/components/Strip.tsx`.

- [ ] **Step 2: Run them to see them fail**

Make sure nothing listens on port 3000. Run: `npx playwright test e2e/make.spec.ts -g "Print sheet|prints|printed"`
Expected: FAIL, because no dialog named "Print" opens.

- [ ] **Step 3: `lib/print.ts`**

The import becomes `import { type Shape, type Variation, borderSvg, cardHeightUnits, renderPng } from "@one-of-one/card";`. In `PrintInput`, replace `borderOnPrint: boolean;` with:

```ts
  /** Draw the card's border texture; false prints the plain white mat. */
  border: boolean;
  /** The print shape. */
  shape: Shape;
```

In `printCard`, replace the `const border = …` statement and the `renderPng` call's `border,` with:

```ts
  const borderDoc =
    input.border && input.variation
      ? borderSvg(input.variation, cardHeightUnits(input.naturalWidth, input.naturalHeight, input.shape), input.shape)
      : undefined;
```

and pass `border: borderDoc, shape: input.shape,` to `renderPng`.

The file name becomes ``const name = `one-of-one-${slug(input.place)}${input.shape === "card" ? "" : `-${input.shape}`}.png`;``.

The note `border && !r.borderDrawn ? …` becomes `borderDoc && !r.borderDrawn ? …`.

- [ ] **Step 4: Create `apps/web/components/PrintSheet.tsx`**

```tsx
"use client";

import "./print-sheet.css";
import { Card, SHAPES, type CardPhoto, type Shape, type Variation } from "@one-of-one/card";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Strip } from "@/components/Strip";

export interface PrintChoice {
  shape: Shape;
  border: boolean;
}

export interface PrintSheetProps {
  photo: CardPhoto;
  caption: { place: string; date: string; coords: string };
  /** The card's design; null prints the plain mat whatever Border says. */
  variation: Variation | null;
  wall: "light" | "dark";
  onSave: (choice: PrintChoice) => void;
  onClose: () => void;
}

/**
 * Print: the card in the chosen shape, with or without its border, and Save. Every opening starts
 * at Gallery with the border. A print has no intro and no motion, so the preview has neither.
 */
export function PrintSheet({ photo, caption, variation, wall, onSave, onClose }: PrintSheetProps) {
  const [shape, setShape] = useState<Shape>("gallery");
  const [border, setBorder] = useState(true);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancel.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preview = border && variation ? { ...variation, motion: "none" as const } : null;

  return (
    <div className="print-sheet" role="dialog" aria-modal="true" aria-label="Print">
      <div className="print-sheet-bar">
        <button ref={cancel} type="button" className="icon-target" aria-label="Cancel" onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="card-area">
        <Card
          photo={photo}
          place={caption.place}
          date={caption.date}
          coords={caption.coords}
          number={null}
          wall={wall}
          variation={preview}
          shape={shape}
        />
      </div>
      <div className="print-field">
        <span className="label">Shape</span>
        <Strip
          size="option"
          cells={Object.values(SHAPES).map((s) => ({ label: s.label, text: s.label, selected: shape === s.id, onClick: () => setShape(s.id) }))}
        />
      </div>
      <div className="print-field">
        <span className="label">Border</span>
        <Strip
          size="option"
          cells={[
            { label: "Plain", text: "Plain", selected: !border, onClick: () => setBorder(false) },
            { label: "Border", text: "Border", selected: border, onClick: () => setBorder(true) },
          ]}
        />
      </div>
      <div className="actions">
        <Strip cells={[{ label: "Save print", icon: "printer", selected: true, onClick: () => onSave({ shape, border }) }]} />
      </div>
    </div>
  );
}
```

If `CardPhoto` is not exported from `@one-of-one/card`, use `{ src: string; width: number; height: number }`. Check `packages/card/src/index.ts`.

- [ ] **Step 5: Create `apps/web/components/print-sheet.css`**

```css
/* The Print sheet: over the whole screen, the card in its print shape, Shape and Border, and Save. */
.print-sheet {
  position: fixed;
  inset: 0;
  z-index: 50;
  overflow-y: auto;
  background: var(--ground);
  color: var(--ink);
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}
.print-sheet-bar {
  display: flex;
  justify-content: flex-end;
  padding: 12px 12px 0;
}
.print-field {
  margin: 14px 20px 0;
}
.print-field .label {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.print-sheet .actions {
  margin: 24px 20px 0;
}
```

Before relying on these, check `apps/web/app/globals.css` for `.card-area`, `.actions` and `.icon-target`, and copy any spacing the Make screen uses so the sheet lines up with it.

- [ ] **Step 6: Open the sheet from Make**

In `apps/web/app/make/MakeScreen.tsx`:
- Import `{ PrintSheet, type PrintChoice } from "@/components/PrintSheet"`.
- Delete the `borderOnPrint` state.
- Add `const [printing, setPrinting] = useState(false);`.
- Replace `onPrint` with:

```tsx
  function openPrint() {
    if (!photo || busy) return;
    // Commit a line that is still being edited; its blur handler updates captionRef synchronously.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.classList.contains("oo-line")) active.blur();
    setPrinting(true);
  }

  async function onPrint(choice: PrintChoice) {
    setPrinting(false);
    if (!photo || !variation || busy) return;
    const { place: placeText, date: dateText, coords: coordsText } = captionRef.current;
    setBusy(true);
    setStatus("Rendering the print…");
    try {
      setStatus(
        await printCard({
          image: photo.element,
          naturalWidth: photo.width,
          naturalHeight: photo.height,
          place: placeText,
          date: dateText,
          coords: coordsText,
          variation,
          border: choice.border,
          shape: choice.shape,
        }),
      );
    } catch {
      setStatus("Couldn't render the print. Try another photo.");
    } finally {
      setBusy(false);
    }
  }
```

Then:
- The Print strip cell's `onClick: onPrint` becomes `onClick: openPrint`.
- Remove `borderOnPrint` and `onBorderOnPrint` from the `DesignPanel` element.
- At the end of the screen's content, inside the `AppFrame`, add the sheet:

```tsx
      {printing && photo ? (
        <PrintSheet
          photo={{ src: photo.src, width: photo.width, height: photo.height }}
          caption={{ place, date, coords }}
          variation={variation}
          wall={wall}
          onSave={(choice) => void onPrint(choice)}
          onClose={() => setPrinting(false)}
        />
      ) : null}
```

Use the same caption values the Make screen's `<Card>` receives. If they are named differently there, use those names.

- [ ] **Step 7: Open the sheet from an opened card**

In `apps/web/app/card/[id]/CardScreen.tsx`, make the same change:
- Import the sheet. Delete `borderOnPrint`. Add `printing`.
- `openPrint` is `if (busy) return; setPrinting(true);`.
- `onPrint(choice: PrintChoice)` is the existing function with `setPrinting(false);` first and `border: choice.border, shape: choice.shape` in place of `borderOnPrint`.
- The Print cell's `onClick` becomes `openPrint`.
- Remove the two border props from `DesignPanel`.
- Render `{printing ? <PrintSheet photo={photo} caption={caption} variation={variation} wall={wall} onSave={(choice) => void onPrint(choice)} onClose={() => setPrinting(false)} /> : null}`.

In `apps/web/components/DesignPanel.tsx`:
- Delete `borderOnPrint` and `onBorderOnPrint` from `DesignPanelProps` and from the destructure.
- Delete the whole "Border on print" `design-field` block.

- [ ] **Step 8: Write the shapes into the docs**

SPEC.md (each phrase occurs once; check before you replace it):

1. Replace `so the card scales identically from a phone screen to a 12-inch print.` with `so the card scales identically at any size. On screen it is always the Card shape; a print may also take the Gallery or Thin shape (Print service).`
2. In the Screens table's Print row, replace `size strip (5 × 7, 8 × 10, 11 × 14), paper strip` with `shape strip (Card, Gallery, Thin; Gallery by default), size strip (5 × 7, 8 × 10, 11 × 14), paper strip`.
3. Replace `so the print looks exactly like the screen.` with `so the print looks exactly like its preview.`
4. After that sentence's paragraph in "## Print service", add this paragraph:

```markdown
Shapes (decided Nov 9, 2026). A print takes one of three shapes, chosen on the Print sheet: Card, the card exactly as on screen (border 5, caption strip 16, text 3, in units of the print's width); Gallery (3, 9.5, 1.8), the default; and Thin (2, 7, 1.3). In each, the photo takes the rest of the width and is never cropped, the caption is indented by its text size and hung 0.8 of it under the photo, and the border texture is drawn to fit. One layout function draws every shape, so the preview and the print match.
```

CLAUDE.md:

1. Replace `` `e2e/equivalence.spec.ts` is the enforcement of the screen-equals-print rule: it diffs the DOM card against the PNG on `/dev/card` and fails on a one-unit drift. `` with `` `e2e/equivalence.spec.ts` is the enforcement of the screen-equals-print rule: it diffs the DOM card against the PNG on `/dev/card`, in every print shape (Card, Gallery, Thin; `shape=` on the URL), and fails on a one-unit drift. ``
2. Replace `tone and its strength, tier, motion, border on print)` with `tone and its strength, tier, motion)`.
3. In "Where things are", after the line about `lib/print.ts`, append this sentence to that bullet: `` The Print cell opens `components/PrintSheet.tsx`: a preview in the chosen print shape, Shape (Card, Gallery, Thin) and Border (Plain, Border), and Save. ``

- [ ] **Step 9: Run the tests**

Make sure nothing listens on port 3000. Run: `npm run typecheck && npm run lint && npx playwright test e2e/make.spec.ts e2e/founder.spec.ts e2e/card-save.spec.ts`. Add any other spec file you changed.
Expected: all pass, including the new sheet test and every rewritten print test.

- [ ] **Step 10: Commit**

```bash
git add apps/web e2e SPEC.md CLAUDE.md
git commit -F - <<'EOF'
Open a Print sheet from Make and the opened card offering Card, Gallery and Thin, Gallery picked, with Plain or Border, replacing the founders' border switch, and write the shapes into SPEC.md and CLAUDE.md

Co-Authored-By: <the model you are> <noreply@anthropic.com>
EOF
```

---

### Task 4: Verify and hand over

The controller runs this task.

- [ ] **Step 1: The full suite.** With nothing on port 3000, run `npm test && npm run typecheck && npm run lint && npm run test:e2e && npm run check:prod`. Expected: all pass, with equivalence in every shape on the Mac, and `check:prod` ending with `production build serves no development surface`.
- [ ] **Step 2: The Jimbōchō prints.** Restart `npm run dev`. In headless Chromium, open Make, load `/Users/alex/Desktop/DSCF3047.JPG`, type the place "Jimbōchō, Tokyo", open the Print sheet, and save Gallery and Thin with the border. Copy the two PNGs to the scratchpad. Report their pixel sizes and the inches they make at 300 dpi.
- [ ] **Step 3: Hand over.** Tell Alex what changed and where the two files are, and ask whether to push.
