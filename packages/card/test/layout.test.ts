import { describe, expect, it } from "vitest";
import { CARD, layoutCard } from "../src/layout";

const full = {
  place: "Seoul, South Korea",
  date: "July 1st, 2026",
  coords: "37.5563° N, 126.9236° E",
  number: 3,
};

describe("layoutCard geometry", () => {
  it("places the photo inside a 5-unit mat at 90 units wide", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(l.width).toBe(100);
    expect(l.photo).toEqual({ x: 5, y: 5, w: 90, h: 120 });
  });

  it("puts a 19.2-unit strip under the photo and sizes the card to it", () => {
    const portrait = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(portrait.strip).toEqual({ y: 125, h: 19.2 });
    expect(portrait.height).toBeCloseTo(144.2, 6);

    const landscape = layoutCard({ photoW: 900, photoH: 600, ...full });
    expect(landscape.photo.h).toBe(60);
    expect(landscape.height).toBeCloseTo(84.2, 6);

    const square = layoutCard({ photoW: 900, photoH: 900, ...full });
    expect(square.photo.h).toBe(90);
    expect(square.height).toBeCloseTo(114.2, 6);
  });

  it("insets text 3 units from the photo edges and caps the place line at 72% of the photo", () => {
    const l = layoutCard({ photoW: 900, photoH: 900, ...full });
    expect(l.text).toMatchObject({ left: 8, right: 92, fontSize: 3.4 });
    expect(l.text.lineHeight).toBeCloseTo(3.4 * 1.32, 6);
    expect(l.text.placeMaxWidth).toBeCloseTo(64.8, 6);
  });
});

describe("layoutCard caption lines", () => {
  it("bottom-aligns three lines so the last sits 3.6 units above the bottom", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    const lastBaseline = 144.2 - 3.6 - 3.4 * CARD.baselineFromBottom;
    const lineHeight = 3.4 * 1.32;
    expect(l.lines.map((x) => x.kind)).toEqual(["place", "date", "coords"]);
    expect(l.lines[2]!.baselineY).toBeCloseTo(lastBaseline, 6);
    expect(l.lines[1]!.baselineY).toBeCloseTo(lastBaseline - lineHeight, 6);
    expect(l.lines[0]!.baselineY).toBeCloseTo(lastBaseline - 2 * lineHeight, 6);
  });

  it("styles place and date at 600 #111 and coords at 400 #333", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(l.lines[0]).toMatchObject({ weight: 600, color: "#111", text: full.place });
    expect(l.lines[1]).toMatchObject({ weight: 600, color: "#111", text: full.date });
    expect(l.lines[2]).toMatchObject({ weight: 400, color: "#333", text: full.coords });
  });

  it("omits empty lines and keeps the remaining ones bottom-aligned", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full, coords: "" });
    const lastBaseline = 144.2 - 3.6 - 3.4 * CARD.baselineFromBottom;
    expect(l.lines.map((x) => x.kind)).toEqual(["place", "date"]);
    expect(l.lines[1]!.baselineY).toBeCloseTo(lastBaseline, 6);
  });

  it("treats whitespace-only text as empty", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full, place: "   " });
    expect(l.lines.map((x) => x.kind)).toEqual(["date", "coords"]);
  });

  it("puts the number on the last baseline, or omits it when null", () => {
    const withNumber = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(withNumber.number).toEqual({
      text: "#3",
      baselineY: withNumber.lines[2]!.baselineY,
    });
    const without = layoutCard({ photoW: 900, photoH: 1200, ...full, number: null });
    expect(without.number).toBeNull();
  });
});
