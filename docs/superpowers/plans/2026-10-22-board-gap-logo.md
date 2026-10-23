# Board Gap Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The empty space at the end of the Board's last row shows the 1/1 mark in one of six designs; when the Board opens, the space flicks through the designs, slowing down, and lands on a random one after about a second.

**Design (decided with Alex on Oct 22, 2026, from a sheet of six families at five gap widths):**
- All six designs, scaled to the space, with no other words: **fraction** (1 over a hairline over 1), **diagonal** (a hairline corner to corner, a 1 in the top-left and bottom-right corners), **wordmark** (1/1, upright in a sliver under 40 px wide), **stacked** (1 / 1 stacked under 160 px wide, side by side above), **pattern** (1/1 repeated in small muted type), **cropped** (a huge outlined 1/1 cut off by the space).
- Drawn in the chrome's ink (`--ink`) on the wall (`--ground`), muted (`--muted`) for the pattern; Archivo, the chrome typeface. They invert in dark mode.
- Shown only when the space is at least 12 px in both directions; nothing when the last row is full. The empty Board keeps "No cards yet."
- The spin: twelve flicks, each a different design from the previous, with delays that grow from about 40 ms to about 150 ms (about one second in all), then a random design. Every visit picks anew. With `prefers-reduced-motion: reduce`, no spin: the random design shows at once.
- Decoration only: `aria-hidden`, not focusable, no pointer events.

**Architecture:** The space is already the `.board-fill` element at the end of `BoardGrid`'s flex rows. It becomes a client component, `BoardGap`, that is a CSS size container holding six absolutely positioned designs sized with container units (`cqw`, `cqh`); a pure `spinSchedule()` in `apps/web/lib/spin.ts` gives the delays and the sequence; the component runs it with timeouts and marks itself `data-landed` when done.

**Tech Stack:** React 19 client component, CSS container queries and units, Vitest, Playwright.

## Global Constraints

- Only these files change: `apps/web/lib/spin.ts` (new) with `apps/web/lib/spin.test.ts` (new), `apps/web/app/board/BoardGap.tsx` (new), `apps/web/app/board/BoardGrid.tsx`, `apps/web/app/globals.css`, `e2e/board.spec.ts`. Nothing about the cards or the row arithmetic changes: `.board-fill` keeps `flex-grow: 100000; flex-basis: 0`.
- Work from `/Users/alex/Desktop/one-of-one-handoff/.claude/worktrees/board-gap-logo` (branch `worktree-board-gap-logo`). Run `npm install --no-audit --no-fund` and `npm run supabase:env` once. Port 3000 must be free before Playwright runs (`kill $(lsof -t -iTCP:3000 -sTCP:LISTEN)` if the main checkout's dev server holds it); leave it free afterwards.
- Commit messages are a sentence of what and why, no prefixes, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: The gap logo

**Files:** as listed above.

- [ ] **Step 1: Failing unit test for the spin schedule**

`apps/web/lib/spin.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { spinSchedule } from "./spin";

/** A deterministic stand-in for Math.random. */
function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("spinSchedule", () => {
  it("gives twelve flicks whose delays grow and add up to about a second", () => {
    const s = spinSchedule(6, Math.random);
    expect(s.steps).toHaveLength(12);
    const delays = s.steps.map((x) => x.delay);
    for (let i = 1; i < delays.length; i += 1) expect(delays[i]!).toBeGreaterThanOrEqual(delays[i - 1]!);
    expect(delays[0]).toBeGreaterThanOrEqual(30);
    expect(delays[delays.length - 1]).toBeLessThanOrEqual(170);
    const total = delays.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(800);
    expect(total).toBeLessThan(1200);
  });
  it("never shows the same design twice in a row and ends on the final pick", () => {
    for (let run = 0; run < 50; run += 1) {
      const s = spinSchedule(6, Math.random);
      const designs = s.steps.map((x) => x.design);
      for (let i = 1; i < designs.length; i += 1) expect(designs[i]).not.toBe(designs[i - 1]);
      expect(designs[designs.length - 1]).toBe(s.final);
      for (const d of designs) {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(6);
      }
    }
  });
  it("picks the final design from the random source", () => {
    expect(spinSchedule(6, seq([0.99])).final).toBe(5);
    expect(spinSchedule(6, seq([0])).final).toBe(0);
  });
});
```

Run `npm test -w apps/web -- spin`: FAIL, module not found.

- [ ] **Step 2: The schedule**

`apps/web/lib/spin.ts`:

```ts
export interface SpinStep {
  /** Milliseconds to wait before showing this step's design. */
  delay: number;
  design: number;
}

export interface Spin {
  steps: SpinStep[];
  final: number;
}

const FLICKS = 12;
const FIRST_MS = 40;
const LAST_MS = 150;

/**
 * The slot-machine spin: twelve flicks through `count` designs, slowing down
 * (delays grow on an ease-in curve from 40 to 150 ms, about a second in all),
 * never repeating a design twice in a row, landing on a random final design.
 */
export function spinSchedule(count: number, random: () => number): Spin {
  const final = Math.min(count - 1, Math.floor(random() * count));
  const steps: SpinStep[] = [];
  let previous = -1;
  for (let i = 0; i < FLICKS; i += 1) {
    const t = i / (FLICKS - 1);
    const delay = Math.round(FIRST_MS + (LAST_MS - FIRST_MS) * t * t);
    let design: number;
    if (i === FLICKS - 1) {
      design = final;
    } else {
      // Any design but the previous one, and not the final one on the step just before it lands.
      const avoid = new Set([previous, i === FLICKS - 2 ? final : -1]);
      const choices = Array.from({ length: count }, (_, k) => k).filter((k) => !avoid.has(k));
      design = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]!;
    }
    steps.push({ delay, design });
    previous = design;
  }
  return { steps, final };
}
```

Run the test: PASS.

- [ ] **Step 3: The component**

`apps/web/app/board/BoardGap.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { spinSchedule } from "@/lib/spin";

/** The six 1/1 designs, in the order the spin indexes them. */
const DESIGNS = ["fraction", "diagonal", "wordmark", "stacked", "pattern", "cropped"] as const;

function Design({ name }: { name: (typeof DESIGNS)[number] }) {
  switch (name) {
    case "fraction":
      return (
        <span className="gap-fraction">
          1<span className="gap-rule" />1
        </span>
      );
    case "diagonal":
      return (
        <>
          <svg className="gap-diagonal" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="gap-corner gap-corner-tl">1</span>
          <span className="gap-corner gap-corner-br">1</span>
        </>
      );
    case "wordmark":
      return <span className="gap-wordmark">1/1</span>;
    case "stacked":
      return (
        <span className="gap-stacked">
          <span>1</span>
          <span className="gap-slash">/</span>
          <span>1</span>
        </span>
      );
    case "pattern":
      return <span className="gap-pattern">{"1/1 ".repeat(120)}</span>;
    case "cropped":
      return <span className="gap-cropped">1/1</span>;
  }
}

/**
 * The empty space at the end of the Board's last row. On open it flicks
 * through the six designs, slowing down, and lands on a random one; with
 * reduced motion it shows the random pick at once. Decoration only.
 */
export function BoardGap() {
  const [shown, setShown] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const spin = spinSchedule(DESIGNS.length, Math.random);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(spin.final);
      setLanded(true);
      return;
    }
    const timers: number[] = [];
    let at = 0;
    spin.steps.forEach((step, i) => {
      at += step.delay;
      timers.push(
        window.setTimeout(() => {
          setShown(step.design);
          if (i === spin.steps.length - 1) setLanded(true);
        }, at),
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <span className="board-fill" aria-hidden="true" data-landed={landed ? "true" : undefined}>
      {shown === null ? null : (
        <span className="gap-logo" data-design={DESIGNS[shown]}>
          <Design name={DESIGNS[shown]!} />
        </span>
      )}
    </span>
  );
}
```

In `apps/web/app/board/BoardGrid.tsx`, import `BoardGap` from `./BoardGap` and replace `<span className="board-fill" aria-hidden="true" />` with `<BoardGap />`. Update the component's doc comment's last sentence to: "A filler keeps the last, partial row left-aligned at the base height, and shows the 1/1 mark in the space it takes (BoardGap)."

- [ ] **Step 4: The styles**

In `apps/web/app/globals.css`, replace the `.board-fill` rule with:

```css
/* The last row's leftover space: a size container so the 1/1 designs scale to it. */
.board-fill {
  flex-grow: 100000;
  flex-basis: 0;
  position: relative;
  overflow: hidden;
  container-type: size;
  pointer-events: none;
}
.gap-logo {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
  font-family: var(--font-archivo), "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 500;
  line-height: 1;
}
@container (max-width: 12px) or (max-height: 12px) {
  .gap-logo {
    display: none;
  }
}
.gap-fraction {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: min(32cqh, 50cqw);
}
.gap-rule {
  display: block;
  width: 1.1em;
  height: 1px;
  margin: 0.12em 0;
  background: currentColor;
}
.gap-diagonal {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.gap-corner {
  position: absolute;
  font-size: max(10px, min(22cqh, 22cqw));
}
.gap-corner-tl {
  left: 6px;
  top: 4px;
}
.gap-corner-br {
  right: 6px;
  bottom: 4px;
}
.gap-wordmark {
  letter-spacing: 0.06em;
  font-size: min(28cqw, 50cqh);
}
@container (max-width: 40px) {
  .gap-wordmark {
    writing-mode: vertical-rl;
    font-size: min(60cqw, 11px);
  }
}
.gap-stacked {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: min(29cqh, 60cqw);
}
.gap-stacked > span {
  line-height: 0.9;
}
.gap-slash {
  font-weight: 400;
}
@container (min-width: 160px) {
  .gap-stacked {
    flex-direction: row;
    font-size: min(42cqh, 25cqw);
  }
}
.gap-pattern {
  position: absolute;
  inset: 4px;
  overflow: hidden;
  font-size: 9px;
  line-height: 1.6;
  letter-spacing: 0.12em;
  word-spacing: 6px;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.gap-cropped {
  position: absolute;
  left: -0.06em;
  bottom: -0.2em;
  white-space: nowrap;
  letter-spacing: -0.02em;
  font-size: 115cqh;
  color: transparent;
  -webkit-text-stroke: 1px var(--ink);
}
```

- [ ] **Step 5: Browser tests**

Append to `e2e/board.spec.ts`, inside the `test.describe("rows of whole photos", …)` block (fresh sign-in, 390 × 844 viewport):

```ts
  test("the last row's space spins through the 1/1 designs and lands on one", async ({ page }) => {
    await signIn(page, freshEmail());
    await page.goto("/make");
    await page.getByTestId("photo-input").setInputFiles(path.resolve("apps/web/public/dev/portrait.png"));
    await expect(page.locator("img.oo-photo")).toBeVisible();
    await page.getByRole("button", { name: "Add to board" }).click();
    await expect(page).toHaveURL(/\/board$/);

    const gap = page.locator(".board-fill");
    await expect(gap).toHaveAttribute("aria-hidden", "true");
    // It spins: more than one design appears before it lands.
    const seen = new Set<string>();
    const until = Date.now() + 3000;
    while (Date.now() < until && (await gap.getAttribute("data-landed")) !== "true") {
      const d = await gap.locator(".gap-logo").getAttribute("data-design").catch(() => null);
      if (d) seen.add(d);
      await page.waitForTimeout(25);
    }
    await expect(gap).toHaveAttribute("data-landed", "true");
    expect(seen.size).toBeGreaterThan(1);
    const final = await gap.locator(".gap-logo").getAttribute("data-design");
    expect(["fraction", "diagonal", "wordmark", "stacked", "pattern", "cropped"]).toContain(final);
    await expect(gap.locator(".gap-logo")).toBeVisible();
  });

  test("with reduced motion the space shows its design at once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page, freshEmail());
    await page.goto("/make");
    await page.getByTestId("photo-input").setInputFiles(path.resolve("apps/web/public/dev/portrait.png"));
    await expect(page.locator("img.oo-photo")).toBeVisible();
    await page.getByRole("button", { name: "Add to board" }).click();
    await expect(page).toHaveURL(/\/board$/);
    await expect(page.locator(".board-fill")).toHaveAttribute("data-landed", "true", { timeout: 500 });
    await expect(page.locator(".board-fill .gap-logo")).toBeVisible();
  });
```

Run: `npx playwright test e2e/board.spec.ts` (the new cases fail before Step 3 if run first; write them first if you prefer the red step).

- [ ] **Step 6: Look at it in both themes**

With Playwright, save one portrait card for a fresh user at 390 × 844 and screenshot `/board` after it lands, once in light and once with `colorScheme: "dark"`, to `/tmp/board-gap-light.png` and `/tmp/board-gap-dark.png`; then do the same after forcing each design in turn (for example `page.evaluate` to re-render is not possible, so instead screenshot five reloads and note which designs appeared). Look at the images: the design must sit inside the space, scaled to it, in ink on the wall.

- [ ] **Step 7: Whole suite and commit**

Run `npm test && npm run lint && npm run typecheck && npx playwright test`. All green. Commit:

```bash
git add -A
git commit -m "Fill the Board's last-row gap with the 1/1 mark in six designs that spin on open and land on a random one

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
