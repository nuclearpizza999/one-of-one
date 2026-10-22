import { test as setup } from "@playwright/test";
import { freshEmail, signIn } from "./auth";

setup("sign in the shared e2e user", async ({ page }) => {
  await signIn(page, freshEmail());
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
