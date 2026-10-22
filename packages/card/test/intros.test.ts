import { describe, expect, it } from "vitest";
import { INTROS, assignIntro, seedFromPhoto } from "../src/intros";

describe("INTROS registry", () => {
  it("lists rise, develop and flip with the prototype's timings", () => {
    expect(INTROS).toEqual([
      { id: "rise", label: "Rise", numberAt: 1700, total: 2300 },
      { id: "develop", label: "Develop", numberAt: 2300, total: 3000 },
      { id: "flip", label: "Flip", numberAt: 1500, total: 2000 },
    ]);
  });
  it("counts up before it settles", () => {
    for (const i of INTROS) expect(i.numberAt).toBeLessThan(i.total);
  });
});

describe("seedFromPhoto", () => {
  it("is deterministic", () => {
    expect(seedFromPhoto(123456, 3024, 4032)).toBe(seedFromPhoto(123456, 3024, 4032));
  });
  it("is a 32-bit unsigned integer", () => {
    const s = seedFromPhoto(1, 1, 1);
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
  });
  it("changes when any input changes", () => {
    const base = seedFromPhoto(123456, 3024, 4032);
    expect(seedFromPhoto(123457, 3024, 4032)).not.toBe(base);
    expect(seedFromPhoto(123456, 4032, 3024)).not.toBe(base);
  });
});

describe("assignIntro", () => {
  it("maps a seed onto the registry in order", () => {
    expect(assignIntro(0).id).toBe("rise");
    expect(assignIntro(1).id).toBe("develop");
    expect(assignIntro(2).id).toBe("flip");
    expect(assignIntro(3).id).toBe("rise");
  });
  it("coerces NaN and negative seeds to a valid index", () => {
    // NaN >>> 0 is 0, so NaN maps to index 0 ("rise").
    // -1 >>> 0 is 4294967295, and 4294967295 % 3 is 0, so -1 also maps to index 0 ("rise").
    expect(assignIntro(NaN).id).toBe("rise");
    expect(assignIntro(-1).id).toBe("rise");
  });
  it("gives the same intro for the same seed", () => {
    const seed = seedFromPhoto(99, 900, 1200);
    expect(assignIntro(seed)).toBe(assignIntro(seed));
  });
});
