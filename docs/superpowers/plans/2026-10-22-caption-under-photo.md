# Caption Under the Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The card's caption becomes smaller (3.0% of the card width, line height 1.2), hangs 2.4% below the photo instead of resting on the bottom edge, and sits on a 16% strip instead of 19.2%, on screen and in print alike.

**Architecture:** Every number lives in the `CARD` table in `packages/card/src/layout.ts`, which both painters read; `layoutCard` computes baselines from the top of the strip instead of the bottom. The screen plate gets a top padding and an inner row so the number still sits on the last line; the print painter places text from the top. The frozen `baselineFromBottom` constant is re-measured for the new line height by the existing equivalence probe.

**Tech Stack:** TypeScript, React 19, Vitest, Playwright (`e2e/equivalence.spec.ts` is the screen-equals-print proof).

## Global Constraints

- Read `docs/superpowers/specs/2026-10-22-caption-under-photo-design.md` (the design) and the card table in SPEC.md (already updated: strip 16% of W; type 3.0% of W, line height 1.2; the first line's box starts 2.4% of W below the photo).
- The card renderer (`packages/card`) gains no app imports. Both painters read one table; no number is typed twice.
- `CARD.baselineFromBottom` is frozen and may change only by re-measuring with the equivalence test's probe (CLAUDE.md).
- The photo, the mat (5), the inset (3), the 72% place cap, the type faces, weights and inks are unchanged.
- Work from `/Users/alex/Desktop/one-of-one-handoff/.claude/worktrees/caption-under-photo` (branch `worktree-caption-under-photo`). The local Supabase stack is running and `apps/web/.env.local` must exist in the worktree before Playwright runs (`npm run supabase:env` writes it); the worktree needs `npm install` once.
- Commit messages are a sentence of what and why, no prefixes, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Geometry, both painters, unit tests

**Files:**
- Modify: `packages/card/src/layout.ts`, `packages/card/test/layout.test.ts`, `packages/card/src/Card.tsx`, `packages/card/src/card.css`, `packages/card/src/renderPng.ts`, `packages/card/test/renderPng.test.ts`, `apps/web/app/dev/card/DevCard.tsx`

**Interfaces:**
- Produces: `CARD.gap` (2.4) replaces `CARD.bottom`; `CARD.stripHeight` 16, `CARD.fontSize` 3.0, `CARD.lineHeight` 1.2; `layoutCard` baselines from the top; the screen plate exposes `--oo-gap` instead of `--oo-bottom` and wraps the lines and the number in `.oo-caption`.

- [ ] **Step 1: Rewrite the layout tests for the new geometry**

Replace the two `describe` blocks in `packages/card/test/layout.test.ts` with:

```ts
describe("layoutCard geometry", () => {
  it("places the photo inside a 5-unit mat at 90 units wide", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(l.width).toBe(100);
    expect(l.photo).toEqual({ x: 5, y: 5, w: 90, h: 120 });
  });

  it("puts a 16-unit strip under the photo and sizes the card to it", () => {
    const portrait = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(portrait.strip).toEqual({ y: 125, h: 16 });
    expect(portrait.height).toBeCloseTo(141, 6);

    const landscape = layoutCard({ photoW: 900, photoH: 600, ...full });
    expect(landscape.photo.h).toBe(60);
    expect(landscape.height).toBeCloseTo(81, 6);

    const square = layoutCard({ photoW: 900, photoH: 900, ...full });
    expect(square.photo.h).toBe(90);
    expect(square.height).toBeCloseTo(111, 6);
  });

  it("insets text 3 units from the photo edges and caps the place line at 72% of the photo", () => {
    const l = layoutCard({ photoW: 900, photoH: 900, ...full });
    expect(l.text).toMatchObject({ left: 8, right: 92, fontSize: 3 });
    expect(l.text.lineHeight).toBeCloseTo(3 * 1.2, 6);
    expect(l.text.placeMaxWidth).toBeCloseTo(64.8, 6);
  });

  it("gives the card height in units for a photo's aspect", () => {
    expect(cardHeightUnits(900, 1200)).toBeCloseTo(141, 6);
    expect(cardHeightUnits(900, 1200)).toBeCloseTo(layoutCard({ photoW: 900, photoH: 1200, ...full }).height, 6);
    expect(cardHeightUnits(900, 600)).toBeCloseTo(81, 6);
  });
});

describe("layoutCard caption lines", () => {
  // The first line's box starts CARD.gap below the photo; each baseline sits baselineFromBottom above its box's bottom.
  const firstBaseline = 125 + CARD.gap + 3 * 1.2 - 3 * CARD.baselineFromBottom;
  const lineHeight = 3 * 1.2;

  it("hangs three lines under the photo, the first 2.4 units below it", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(l.lines.map((x) => x.kind)).toEqual(["place", "date", "coords"]);
    expect(l.lines[0]!.baselineY).toBeCloseTo(firstBaseline, 6);
    expect(l.lines[1]!.baselineY).toBeCloseTo(firstBaseline + lineHeight, 6);
    expect(l.lines[2]!.baselineY).toBeCloseTo(firstBaseline + 2 * lineHeight, 6);
  });

  it("styles place and date at 600 #111 and coords at 400 #333", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(l.lines[0]).toMatchObject({ weight: 600, color: "#111", text: full.place });
    expect(l.lines[1]).toMatchObject({ weight: 600, color: "#111", text: full.date });
    expect(l.lines[2]).toMatchObject({ weight: 400, color: "#333", text: full.coords });
  });

  it("omits empty lines and keeps the remaining ones hung from the photo", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full, coords: "" });
    expect(l.lines.map((x) => x.kind)).toEqual(["place", "date"]);
    expect(l.lines[0]!.baselineY).toBeCloseTo(firstBaseline, 6);
    expect(l.lines[1]!.baselineY).toBeCloseTo(firstBaseline + lineHeight, 6);
  });

  it("treats whitespace-only text as empty", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full, place: "   " });
    expect(l.lines.map((x) => x.kind)).toEqual(["date", "coords"]);
    expect(l.lines[0]!.baselineY).toBeCloseTo(firstBaseline, 6);
  });

  it("puts the number on the last present line's baseline, or omits it when null", () => {
    const withNumber = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(withNumber.number).toEqual({ text: "#3", baselineY: withNumber.lines[2]!.baselineY });
    const twoLines = layoutCard({ photoW: 900, photoH: 1200, ...full, coords: "" });
    expect(twoLines.number!.baselineY).toBeCloseTo(twoLines.lines[1]!.baselineY, 6);
    const without = layoutCard({ photoW: 900, photoH: 1200, ...full, number: null });
    expect(without.number).toBeNull();
  });
});
```

- [ ] **Step 2: Rewrite the print painter's tests for the new geometry**

In `packages/card/test/renderPng.test.ts`:

- `printDimensions`: `H: 1442` becomes `H: 1410` in the first case; in the capped case `H: 4491` becomes `H: 4320` (card height 81 units × u 53.33).
- In `describe("drawCard")`, replace the three constants with:

```ts
  const fs = 30;
  // Baselines are measured from the top: the strip starts at 125 units, the first line box at CARD.gap below it.
  const firstBaseline = (125 + CARD.gap) * 10 + fs * 1.2 - fs * CARD.baselineFromBottom;
  const lineHeight = fs * 1.2;
```

- Replace every `1442` in that block and in `describe("renderPng")` with `1410`.
- Change the two text tests to:

```ts
  it("draws each line at its baseline, hung from the photo, in the right weight and color", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, spec);
    const texts = calls.filter((c) => c[0] === "fillText");
    expect(texts).toHaveLength(4);
    expect(texts[0]!.slice(1, 4)).toEqual(["Seoul, South Korea", 80, expect.closeTo(firstBaseline, 6)]);
    expect(texts[0]!.slice(5)).toEqual(['600 30px "EB Garamond", Garamond, Georgia, "Times New Roman", serif', "#111", "left"]);
    expect(texts[1]!.slice(1, 4)).toEqual(["July 1st, 2026", 80, expect.closeTo(firstBaseline + lineHeight, 6)]);
    expect(texts[2]!.slice(1, 4)).toEqual(["37.5563° N, 126.9236° E", 80, expect.closeTo(firstBaseline + 2 * lineHeight, 6)]);
    expect(texts[2]!.slice(5)).toEqual(['400 30px "EB Garamond", Garamond, Georgia, "Times New Roman", serif', "#333", "left"]);
    expect(ctx.textBaseline).toBe("alphabetic");
  });

  it("right-aligns the number on the last baseline", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, spec);
    const num = calls.filter((c) => c[0] === "fillText")[3]!;
    expect(num.slice(1, 4)).toEqual(["#3", 920, expect.closeTo(firstBaseline + 2 * lineHeight, 6)]);
    expect(num.slice(5)).toEqual(['600 30px "EB Garamond", Garamond, Georgia, "Times New Roman", serif', "#111", "right"]);
  });
```

and the two-line test to:

```ts
  it("omits the number when null and keeps two lines hung from the photo", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, { ...spec, coords: "", number: null });
    const texts = calls.filter((c) => c[0] === "fillText");
    expect(texts).toHaveLength(2);
    expect(texts[0]!.slice(1, 4)).toEqual(["Seoul, South Korea", 80, expect.closeTo(firstBaseline, 6)]);
    expect(texts[1]!.slice(1, 4)).toEqual(["July 1st, 2026", 80, expect.closeTo(firstBaseline + lineHeight, 6)]);
  });
```

The ellipsize test's `"A".repeat(63)` depends on the fake `measureText` (10 px per character) and the 72% cap (648 px): unchanged.

- [ ] **Step 3: Run the two files to verify they fail**

Run: `npm test -w packages/card -- layout && npm test -w packages/card -- renderPng`
Expected: FAIL on the new heights, `CARD.gap` undefined, and the baselines.

- [ ] **Step 4: Change the table and the layout function**

In `packages/card/src/layout.ts`, the table becomes:

```ts
export const CARD = {
  width: 100,
  mat: 5,
  photoWidth: 90,
  stripHeight: 16,
  fontSize: 3,
  lineHeight: 1.2,
  inset: 3,
  /** The first caption line's box starts this far below the photo; the lines stack beneath it. */
  gap: 2.4,
  placeMaxWidthRatio: 0.72,
  ink: "#111",
  inkCoords: "#333",
  weight: 600,
  weightCoords: 400,
  /**
   * Distance from the bottom of a line box to its baseline, as a fraction
   * of font size, for EB Garamond at line-height 1.2. Measured by the
   * equivalence test's probe (e2e/equivalence.spec.ts) and frozen here; Task 2 of
   * docs/superpowers/plans/2026-10-22-caption-under-photo.md records the measurement.
   */
  baselineFromBottom: 0.32,
} as const;
```

(The 0.32 is provisional until Task 2 measures it; the unit tests read the constant symbolically.)

In `layoutCard`, replace the `lastBaseline` line and the `lines`/`number` construction with:

```ts
  const fontSize = CARD.fontSize;
  const lineHeight = fontSize * CARD.lineHeight;
  // Hung from the photo: line i's box spans [strip.y + gap + i·lineHeight, +lineHeight]; the baseline sits baselineFromBottom·fontSize above the box's bottom.
  const baselineOf = (i: number) => strip.y + CARD.gap + (i + 1) * lineHeight - fontSize * CARD.baselineFromBottom;
  …
  const lines: CaptionLine[] = present.map((l, i) => ({ ...l, baselineY: baselineOf(i) }));
  …
    number:
      spec.number === null || present.length === 0
        ? spec.number === null
          ? null
          : { text: `#${spec.number}`, baselineY: baselineOf(0) }
        : { text: `#${spec.number}`, baselineY: baselineOf(present.length - 1) },
```

Simplify that last expression as you see fit, keeping the behaviour: the number sits on the last present line's baseline, or on the first line's position when no line is present, and is null when the number is null.

- [ ] **Step 5: Place print text from the top**

In `packages/card/src/renderPng.ts` `drawCard`, replace:

```ts
  // Positions are measured up from the bottom edge so rounding in H never moves the caption.
  const yFromBottom = (baselineY: number) => H - (layout.height - baselineY) * u;
```

with:

```ts
  // Positions are measured down from the top, like the DOM's, so the caption keeps its distance from the photo whatever rounding H gets.
  const y = (baselineY: number) => baselineY * u;
```

and the two `yFromBottom(...)` calls with `y(...)`.

- [ ] **Step 6: The screen plate**

In `packages/card/src/Card.tsx`:
- `FRAME_VARS`: replace `"--oo-bottom": \`${CARD.bottom}cqw\`,` with `"--oo-gap": \`${CARD.gap}cqw\`,`.
- Wrap the lines and the number: the `figcaption` becomes

```tsx
        <figcaption className="oo-plate">
          <div className="oo-caption">
            <div className="oo-lines">
              {…unchanged…}
            </div>
            <span className="oo-num">{number === null ? "" : `#${number}`}</span>
          </div>
        </figcaption>
```

In `packages/card/src/card.css`, replace the `.oo-plate` rule with:

```css
.oo-plate {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  height: var(--oo-strip);
  padding: var(--oo-gap) var(--oo-inset) 0;
  font-family: var(--oo-font);
  font-size: var(--oo-fs);
  font-weight: var(--oo-weight);
  line-height: var(--oo-lh);
  color: var(--oo-ink);
}
/* The lines and the number share a row aligned at the bottom, so the number sits on the last line's baseline. */
.oo-caption {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
```

- [ ] **Step 7: The dev card's probe and drift**

In `apps/web/app/dev/card/DevCard.tsx`:
- The probe: measure against the lines block rather than the card's bottom. Replace the `setBaseline(...)` line with:

```ts
        const linesRect = card.querySelector<HTMLElement>(".oo-lines")!.getBoundingClientRect();
        setBaseline((linesRect.bottom - probeRect.bottom) / (CARD.fontSize * u));
```

(the lines block's bottom is the last line box's bottom, so this is `baselineFromBottom` directly, whatever the anchoring).
- The drift style: `.drift .oo-plate { padding-bottom: ${CARD.bottom + 1}cqw; }` becomes `.drift .oo-plate { padding-top: ${CARD.gap + 1}cqw; }`.

- [ ] **Step 8: Run the unit tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green (card 144, places 24, web 40); nothing else in the repo references `CARD.bottom` or `--oo-bottom` (check with `grep -rn "CARD.bottom\|oo-bottom" packages apps e2e`).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Hang the caption 2.4 units under the photo at 3.0 units and line height 1.2 on a 16-unit strip, in both painters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Re-measure the baseline, update the browser tests, prove screen equals print

**Files:**
- Modify: `packages/card/src/layout.ts` (the constant and its comment), `e2e/make.spec.ts`

- [ ] **Step 1: Prepare the worktree for Playwright**

```bash
npm install --no-audit --no-fund
npm run supabase:env
```

Expected: `apps/web/.env.local` written for http://127.0.0.1:54321. Port 3000 must be free (`lsof -t -iTCP:3000 -sTCP:LISTEN` prints nothing; if the main checkout's dev server holds it, stop that server with `kill $(lsof -t -iTCP:3000 -sTCP:LISTEN)`, since Playwright must start the worktree's own).

- [ ] **Step 2: Measure**

Run: `npx playwright test e2e/equivalence.spec.ts -g "baselineFromBottom"`
Expected: the test prints `measured baselineFromBottom: 0.26xx (CARD has 0.32)` and FAILS (the difference exceeds 0.006). Note the printed value.

- [ ] **Step 3: Freeze the measurement**

In `packages/card/src/layout.ts` set `baselineFromBottom` to the printed value rounded to two decimals (expected about 0.26), and rewrite its comment to: "Measured by the equivalence test's probe on 2026-10-22 (DOM probe: 0.26xx) for EB Garamond at line-height 1.2, and frozen here."

Run the probe test again. Expected: PASS.

- [ ] **Step 4: Update the print height the Make tests assert**

In `e2e/make.spec.ts`, the three `expect(png.height).toBe(1442);` become `expect(png.height).toBe(1410);`.

- [ ] **Step 5: Run the equivalence suite and record the margins**

Run: `npx playwright test e2e/equivalence.spec.ts --reporter=list`
Expected: every case passes. Record in the report the largest caption ratio (must be under 0.001), the largest textured ratio (under 0.002), the drift ratio (over 0.003) and the border-drift ratio (over 0.006). If a caption case exceeds 0.001, do not loosen the tolerance: report it and stop.

- [ ] **Step 6: Run the whole suite**

Run: `npm run lint && npm run typecheck && npm test && npx playwright test --reporter=list`
Expected: all green (66 e2e cases).

- [ ] **Step 7: Look at it**

Sign in through the app is not needed: open `http://localhost:3000/dev/card?fixture=portrait&coords=1&number=3` in Playwright (`npx playwright screenshot --viewport-size=1200,1700 "http://localhost:3000/dev/card?fixture=portrait&coords=1&number=3" /tmp/caption-check.png` with the dev server running, or a three-line script) and attach the screenshot path in the report: the DOM card and the PNG side by side must show the caption hung under the photo with the number on the last line.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Re-measure the frozen baseline for line height 1.2 and update the print height the Make tests expect

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
