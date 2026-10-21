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
