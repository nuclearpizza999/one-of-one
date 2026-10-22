import path from "node:path";
import { expect, test } from "@playwright/test";
import { freshEmail, signIn } from "./auth";

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

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the Board and Make redirect to sign-in, the dev card does not, and the place route refuses", async ({ page, request }) => {
    await page.goto("/board");
    await expect(page).toHaveURL(/\/signin$/);
    await page.goto("/make");
    await expect(page).toHaveURL(/\/signin$/);
    const dev = await request.get("/dev/card?fixture=portrait");
    expect(dev.status()).toBe(200);
    const place = await request.post("/api/place", { data: { lat: 37.8199, lng: -122.4783 } });
    expect(place.status()).toBe(401);
    expect(await place.json()).toEqual({ error: "sign in first" });
  });
});

test.describe("rows of whole photos", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

  test("tiles share a height within a row, full rows run margin to margin, and nothing is cropped", async ({ page }) => {
    await signIn(page, freshEmail());
    for (const f of ["portrait.png", "landscape.png", "square.png", "seoul.jpg", "rotated.jpg"]) {
      await page.goto("/make");
      await page.getByTestId("photo-input").setInputFiles(path.resolve("apps/web/public/dev", f));
      await expect(page.locator("img.oo-photo")).toBeVisible();
      await page.getByRole("button", { name: "Add to board" }).click();
      await expect(page).toHaveURL(/\/board$/);
    }
    await expect(page.getByLabel("5 cards")).toHaveText("5");

    const boxes = await page.locator(".board .tile").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const img = el.querySelector("img")!;
        return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), height: r.height, width: r.width, w: img.naturalWidth || Number(img.getAttribute("width")), h: img.naturalHeight || Number(img.getAttribute("height")) };
      }),
    );
    const board = await page.locator(".board").boundingBox();
    expect(boxes.length).toBe(5);
    const rows = new Map<number, typeof boxes>();
    for (const b of boxes) rows.set(b.top, [...(rows.get(b.top) ?? []), b]);
    expect(rows.size).toBeGreaterThan(1);
    const tops = [...rows.keys()].sort((a, b) => a - b);
    for (const [i, top] of tops.entries()) {
      const row = rows.get(top)!;
      const heights = row.map((b) => b.height);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1.5);
      // Each tile keeps its photo's aspect: no crop.
      for (const b of row) expect(Math.abs(b.width / b.height - b.w / b.h)).toBeLessThan(0.02);
      const isLast = i === tops.length - 1;
      const rightEdge = Math.max(...row.map((b) => b.right));
      if (!isLast) expect(Math.abs(rightEdge - (board!.x + board!.width - 2))).toBeLessThan(2);
    }
  });
});
