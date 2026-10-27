import { describe, expect, it } from "vitest";
import { GREY_SATURATION, hexToHsl, hslToHex, rgbToHsl } from "../src/colour";

describe("colour helpers", () => {
  it("convert pure red, a grey and white", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 1, 0.5]);
    const [h, s, l] = hexToHsl("#808080");
    expect(h).toBe(0);
    expect(s).toBe(0);
    expect(l).toBeCloseTo(0.502, 3);
    expect(hslToHex(0, 0, 1)).toBe("#ffffff");
  });
  it("round-trip hex through HSL", () => {
    for (const hex of ["#b08860", "#6878a0", "#4466aa", "#ececec", "#e77d98", "#102030"]) {
      expect(hslToHex(...hexToHsl(hex))).toBe(hex);
    }
  });
  it("keep the grey threshold", () => {
    expect(GREY_SATURATION).toBe(0.08);
  });
});
