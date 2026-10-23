import { describe, expect, it } from "vitest";
import { spinSchedule } from "./spin";

/** A deterministic stand-in for Math.random. */
function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("spinSchedule", () => {
  it("gives twelve flicks whose delays grow and add up to about a second", () => {
    const s = spinSchedule(6, Math.random);
    expect(s.steps).toHaveLength(12);
    const delays = s.steps.map((x) => x.delay);
    for (let i = 1; i < delays.length; i += 1) expect(delays[i]!).toBeGreaterThanOrEqual(delays[i - 1]!);
    expect(delays[0]).toBeGreaterThanOrEqual(30);
    expect(delays[delays.length - 1]).toBeLessThanOrEqual(170);
    const total = delays.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(800);
    expect(total).toBeLessThan(1200);
  });
  it("never shows the same design twice in a row and ends on the final pick", () => {
    for (let run = 0; run < 50; run += 1) {
      const s = spinSchedule(6, Math.random);
      const designs = s.steps.map((x) => x.design);
      for (let i = 1; i < designs.length; i += 1) expect(designs[i]).not.toBe(designs[i - 1]);
      expect(designs[designs.length - 1]).toBe(s.final);
      for (const d of designs) {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(6);
      }
    }
  });
  it("picks the final design from the random source", () => {
    expect(spinSchedule(6, seq([0.99])).final).toBe(5);
    expect(spinSchedule(6, seq([0])).final).toBe(0);
  });
});
