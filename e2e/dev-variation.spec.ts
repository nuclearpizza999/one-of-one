import path from "node:path";
import { expect, test } from "@playwright/test";
import { TEXTURES } from "../packages/card/src/textures";

const textureCount = Object.keys(TEXTURES).length;

test("lists the JPEGs in the dev photos folder", async ({ request }) => {
  const r = await request.get("/api/dev/photos");
  expect(r.status()).toBe(200);
  expect(r.headers()["cache-control"]).toBe("no-store");
  expect(await r.json()).toEqual({ photos: ["nogps.jpg", "rotated.jpg", "seoul.jpg"] });
});

test("serves one photo and refuses anything else", async ({ request }) => {
  const ok = await request.get("/api/dev/photos/seoul.jpg");
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toBe("image/jpeg");
  expect(ok.headers()["cache-control"]).toBe("no-store");
  for (const bad of ["portrait.png", "nope.jpg", "..%2Fseoul.jpg", "%2E%2E%2Fseoul.jpg"]) {
    expect((await request.get(`/api/dev/photos/${bad}`)).status(), bad).toBe(404);
  }
});

test("the gallery shows every photo under every texture and marks the assigned one", async ({ page }) => {
  await page.goto("/dev/variation");
  await expect(page.locator("[data-dev-gallery] .gallery-row")).toHaveCount(3);
  await expect(page.locator(".gallery-row").first().locator("figure.oo-card")).toHaveCount(textureCount);
  const nogps = page.locator(".gallery-row", { hasText: "nogps.jpg" });
  await expect(nogps.locator('.gallery-cell[data-derived="true"]')).toHaveAttribute("data-texture", "worn");
  await expect(nogps.locator('.gallery-cell[data-texture="foil"] figure.oo-card')).toHaveAttribute("data-texture", "foil");
  const seoul = page.locator(".gallery-row", { hasText: "seoul.jpg" });
  await expect(seoul.locator(".status").first()).toContainText("Seoul, South Korea");
  await expect(seoul.locator("img.oo-border-img")).toHaveCount(textureCount);
});

test("the tier and tone strips change every card", async ({ page }) => {
  await page.goto("/dev/variation");
  await expect(page.locator(".gallery-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Animated" }).click();
  for (const card of await page.locator("figure.oo-card").all()) await expect(card).toHaveAttribute("data-tier", "animated");
  await page.getByRole("button", { name: "Photo", exact: true }).click();
  for (const card of await page.locator("figure.oo-card").all()) await expect(card).toHaveAttribute("data-tone", "photo");
});

test("a picked photo joins the gallery", async ({ page }) => {
  await page.goto("/dev/variation");
  await expect(page.locator(".gallery-row")).toHaveCount(3);
  await page.getByTestId("gallery-input").setInputFiles(path.resolve("apps/web/public/dev/portrait.png"));
  await expect(page.locator(".gallery-row")).toHaveCount(4);
  await expect(page.locator(".gallery-row", { hasText: "portrait.png" }).locator("figure.oo-card")).toHaveCount(textureCount);
});
