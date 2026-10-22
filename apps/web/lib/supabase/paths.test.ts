import { describe, expect, it } from "vitest";
import { isPublicPath } from "./paths";

describe("isPublicPath", () => {
  it("leaves the sign-in screen and the development surfaces open", () => {
    for (const p of ["/signin", "/dev", "/dev/card", "/dev/variation", "/api/dev", "/api/dev/photos", "/api/dev/photos/seoul.jpg"]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });
  it("walls everything else", () => {
    for (const p of ["/", "/board", "/make", "/card/abc", "/api/place", "/signin/extra", "/development"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });
});
