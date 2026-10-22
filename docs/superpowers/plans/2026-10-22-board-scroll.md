# Board Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app's frame is exactly one screen tall; only the middle scrolls, so the top bar and the tab bar stay put on every screen, the Board included.

**Architecture:** Four CSS rules in `apps/web/app/globals.css` (`.app`, `.app-main`, `.topbar`, `.tabbar`); one browser test that overflows the Board and checks the bars do not move.

**Tech Stack:** CSS, Playwright.

## Global Constraints

- Read `docs/superpowers/specs/2026-10-22-board-scroll-design.md`.
- Only `apps/web/app/globals.css` and `e2e/board.spec.ts` change (plus SPEC.md's chrome table rows for the bars, if not already updated by the design commit). No card code changes.
- Work from `/Users/alex/Desktop/one-of-one-handoff/.claude/worktrees/board-scroll` (branch `worktree-board-scroll`). Run `npm install --no-audit --no-fund` and `npm run supabase:env` once. Port 3000 must be free before Playwright runs; if a dev server from the main checkout holds it, stop it with `kill $(lsof -t -iTCP:3000 -sTCP:LISTEN)`.
- Commit messages are a sentence of what and why, no prefixes, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: The frame scrolls inside

**Files:**
- Modify: `apps/web/app/globals.css`, `e2e/board.spec.ts`

- [ ] **Step 1: Write the failing e2e**

Append to `e2e/board.spec.ts`, inside the existing `test.describe("rows of whole photos", …)` block (which already opts out of the shared sign-in and sets a 390 × 844 viewport), a second test:

```ts
  test("the middle scrolls while the top bar and the tab bar stay put", async ({ page }) => {
    await signIn(page, freshEmail());
    const fixtures = ["portrait.png", "landscape.png", "square.png", "seoul.jpg", "rotated.jpg"];
    for (const f of [...fixtures, ...fixtures]) {
      await page.goto("/make");
      await page.getByTestId("photo-input").setInputFiles(path.resolve("apps/web/public/dev", f));
      await expect(page.locator("img.oo-photo")).toBeVisible();
      await page.getByRole("button", { name: "Add to board" }).click();
      await expect(page).toHaveURL(/\/board$/);
    }
    await expect(page.getByLabel("10 cards")).toHaveText("10");

    const main = page.locator(".app-main");
    const tabbar = page.getByRole("navigation", { name: "Tabs" });
    const topbar = page.locator(".topbar");
    const firstTile = page.locator(".board .tile").first();

    // The page itself has nothing to scroll; the middle does.
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight)).toBeLessThanOrEqual(1);
    expect(await main.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(200);

    const before = { tab: (await tabbar.boundingBox())!.y, top: (await topbar.boundingBox())!.y, tile: (await firstTile.boundingBox())!.y };
    expect(before.tab + (await tabbar.boundingBox())!.height).toBeLessThanOrEqual(844);

    await main.evaluate((el) => { el.scrollTop = 400; });
    await page.waitForTimeout(100);

    expect((await tabbar.boundingBox())!.y).toBe(before.tab);
    expect((await topbar.boundingBox())!.y).toBe(before.top);
    expect((await firstTile.boundingBox())!.y).toBeLessThan(before.tile - 300);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test -g "stay put"`
Expected: FAIL at the page-scroll assertion (the page scrolls today) or at the tab bar's position.

- [ ] **Step 3: Change the frame**

In `apps/web/app/globals.css` replace the `.app` and `.app-main` rules with:

```css
/* Frame: one phone-width column, exactly one screen tall. Only the middle scrolls; the bars stay put. */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  max-width: 430px;
  margin: 0 auto;
  padding-top: env(safe-area-inset-top, 0px);
}
.app-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior-y: contain;
}
```

Add `flex-shrink: 0;` to the `.topbar` rule and to the `.tabbar` rule (the tab bar keeps its `margin-top: auto`, which is now harmless).

- [ ] **Step 4: Run the Board spec, then the whole suite**

Run: `npx playwright test e2e/board.spec.ts` then `npm run lint && npx playwright test --reporter=list`
Expected: all pass (67 e2e cases). If the sign-in screen's form or the Make screen's dev panel is cut off rather than scrollable, the middle's `overflow-y` is not taking effect; check that `.app-main` is the element that holds the screen's content on that page.

- [ ] **Step 5: Look at it**

With a dev server from the worktree (`npm run dev` in the background, stopped afterwards), sign in through `http://localhost:3000/signin` in a headed or headless browser with ten saved cards is already covered by the test; for a visual check, screenshot `/board` at 390 × 844 after the test's data exists (the test's user is gone, so instead rely on the test's assertions) or skip this step and say so.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Keep the top bar and the tab bar on screen and scroll only the middle, so the Board never grows the page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
