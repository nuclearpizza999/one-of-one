import { describe, expect, it } from "vitest";
import { slug } from "./print";

describe("slug", () => {
  it("folds accents to their letters", () => {
    expect(slug("Jimbōchō, Tokyo")).toBe("jimbocho-tokyo");
  });
  it("joins words with single hyphens", () => {
    expect(slug("Seoul, South Korea")).toBe("seoul-south-korea");
  });
  it("keeps letters of other scripts", () => {
    expect(slug("서울")).toBe("서울");
  });
  it("falls back to print when nothing is left", () => {
    expect(slug("")).toBe("print");
    expect(slug("  ,  ")).toBe("print");
  });
});
