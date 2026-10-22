import { describe, expect, it } from "vitest";
import { INTROS, assignIntro } from "../src/intros";

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
    const seed = 0x9e3779b9;
    expect(assignIntro(seed)).toBe(assignIntro(seed));
  });
});
