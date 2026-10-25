import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INTROS, assignIntro } from "../src/intros";
import { MOTIONS } from "../src/variation";

const css = readFileSync(fileURLToPath(new URL("../src/card.css", import.meta.url)), "utf8");
const reducedMotion = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

describe("INTROS registry", () => {
  it("lists rise, develop and flip with the prototype's timings, assignable", () => {
    expect(INTROS.slice(0, 3)).toEqual([
      { id: "rise", label: "Rise", numberAt: 1700, total: 2300, assignable: true },
      { id: "develop", label: "Develop", numberAt: 2300, total: 3000, assignable: true },
      { id: "flip", label: "Flip", numberAt: 1500, total: 2000, assignable: true },
    ]);
  });
  it("adds fade, slide and drop, never assigned", () => {
    expect(INTROS.slice(3).map((i) => [i.id, i.label, i.assignable])).toEqual([
      ["fade", "Fade", false],
      ["slide", "Slide", false],
      ["drop", "Drop", false],
    ]);
  });
  it("has unique ids and non-empty labels", () => {
    expect(new Set(INTROS.map((i) => i.id)).size).toBe(INTROS.length);
    for (const i of INTROS) expect(i.label.length).toBeGreaterThan(0);
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
  it("returns what the old formula over the three original intros returned, for seeds 0 to 99", () => {
    const old = ["rise", "develop", "flip"];
    for (let seed = 0; seed < 100; seed += 1) expect(assignIntro(seed).id).toBe(old[(seed >>> 0) % 3]);
    for (const seed of [0x9e3779b9, 0xffffffff, 123456789]) expect(assignIntro(seed).id).toBe(old[(seed >>> 0) % 3]);
  });
  it("never assigns an intro that is not assignable", () => {
    for (let seed = 0; seed < 1000; seed += 1) expect(assignIntro(seed).assignable).toBe(true);
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

describe("card.css", () => {
  it("has a class for every intro, stilled under reduced motion", () => {
    for (const i of INTROS) {
      expect(css).toContain(`.oo-intro-${i.id} `);
      expect(reducedMotion).toContain(`.oo-intro-${i.id}`);
    }
  });
  it("has a rule for every motion, drawn in the border layer and stilled under reduced motion", () => {
    for (const m of Object.values(MOTIONS)) {
      if (m.className === null) continue;
      expect(css).toContain(`.${m.className} .oo-border::after {`);
      expect(reducedMotion).toContain(`.${m.className} .oo-border::after`);
    }
  });
});
