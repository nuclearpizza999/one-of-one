import { describe, expect, it } from "vitest";
import { CARD, SHAPES, cardHeightUnits, geometryOf, layoutCard } from "../src/layout";

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

  it("puts a 16-unit strip under the photo and sizes the card to it", () => {
    const portrait = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(portrait.strip).toEqual({ y: 125, h: 16 });
    expect(portrait.height).toBeCloseTo(141, 6);

    const landscape = layoutCard({ photoW: 900, photoH: 600, ...full });
    expect(landscape.photo.h).toBe(60);
    expect(landscape.height).toBeCloseTo(81, 6);

    const square = layoutCard({ photoW: 900, photoH: 900, ...full });
    expect(square.photo.h).toBe(90);
    expect(square.height).toBeCloseTo(111, 6);
  });

  it("insets text 3 units from the photo edges and caps the place line at 72% of the photo", () => {
    const l = layoutCard({ photoW: 900, photoH: 900, ...full });
    expect(l.text).toMatchObject({ left: 8, right: 92, fontSize: 3 });
    expect(l.text.lineHeight).toBeCloseTo(3 * 1.2, 6);
    expect(l.text.placeMaxWidth).toBeCloseTo(64.8, 6);
  });

  it("gives the card height in units for a photo's aspect", () => {
    expect(cardHeightUnits(900, 1200)).toBeCloseTo(141, 6);
    expect(cardHeightUnits(900, 1200)).toBeCloseTo(layoutCard({ photoW: 900, photoH: 1200, ...full }).height, 6);
    expect(cardHeightUnits(900, 600)).toBeCloseTo(81, 6);
  });
});

describe("layoutCard caption lines", () => {
  // The first line's box starts CARD.gap below the photo; each baseline sits baselineFromBottom above its box's bottom.
  const firstBaseline = 125 + CARD.gap + 3 * 1.2 - 3 * CARD.baselineFromBottom;
  const lineHeight = 3 * 1.2;

  it("hangs three lines under the photo, the first 2.4 units below it", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(l.lines.map((x) => x.kind)).toEqual(["place", "date", "coords"]);
    expect(l.lines[0]!.baselineY).toBeCloseTo(firstBaseline, 6);
    expect(l.lines[1]!.baselineY).toBeCloseTo(firstBaseline + lineHeight, 6);
    expect(l.lines[2]!.baselineY).toBeCloseTo(firstBaseline + 2 * lineHeight, 6);
  });

  it("styles place and date at 600 #111 and coords at 400 #333", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(l.lines[0]).toMatchObject({ weight: 600, color: "#111", text: full.place });
    expect(l.lines[1]).toMatchObject({ weight: 600, color: "#111", text: full.date });
    expect(l.lines[2]).toMatchObject({ weight: 400, color: "#333", text: full.coords });
  });

  it("omits empty lines and keeps the remaining ones hung from the photo", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full, coords: "" });
    expect(l.lines.map((x) => x.kind)).toEqual(["place", "date"]);
    expect(l.lines[0]!.baselineY).toBeCloseTo(firstBaseline, 6);
    expect(l.lines[1]!.baselineY).toBeCloseTo(firstBaseline + lineHeight, 6);
  });

  it("puts the number where the first line would be when there are no lines", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, place: "", date: "", coords: "", number: 3 });
    expect(l.lines).toEqual([]);
    expect(l.number!.baselineY).toBeCloseTo(firstBaseline, 6);
  });

  it("treats whitespace-only text as empty", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full, place: "   " });
    expect(l.lines.map((x) => x.kind)).toEqual(["date", "coords"]);
    expect(l.lines[0]!.baselineY).toBeCloseTo(firstBaseline, 6);
  });

  it("puts the number on the last present line's baseline, or omits it when null", () => {
    const withNumber = layoutCard({ photoW: 900, photoH: 1200, ...full });
    expect(withNumber.number).toEqual({ text: "#3", baselineY: withNumber.lines[2]!.baselineY });
    const twoLines = layoutCard({ photoW: 900, photoH: 1200, ...full, coords: "" });
    expect(twoLines.number!.baselineY).toBeCloseTo(twoLines.lines[1]!.baselineY, 6);
    const without = layoutCard({ photoW: 900, photoH: 1200, ...full, number: null });
    expect(without.number).toBeNull();
  });
});

describe("print shapes", () => {
  const full = { place: "Seoul, South Korea", date: "July 1st, 2026", coords: "37.5563° N, 126.9236° E", number: 3 };

  it("has Card, Gallery and Thin, and the Card shape is exactly the card", () => {
    expect(Object.values(SHAPES).map((s) => s.label)).toEqual(["Card", "Gallery", "Thin"]);
    expect(geometryOf("card")).toEqual(CARD);
    expect(layoutCard({ photoW: 900, photoH: 1200, ...full }, "card")).toEqual(layoutCard({ photoW: 900, photoH: 1200, ...full }));
  });
  it("derives the photo width, the indent and the gap from the border and the text", () => {
    expect(geometryOf("gallery")).toMatchObject({ mat: 3, photoWidth: 94, stripHeight: 9.5, fontSize: 1.8, inset: 1.8, gap: 1.44 });
    expect(geometryOf("thin")).toMatchObject({ mat: 2, photoWidth: 96, stripHeight: 7, fontSize: 1.3, inset: 1.3, gap: 1.04 });
  });
  it("lays out a shape around the photo, never cropping it", () => {
    const l = layoutCard({ photoW: 900, photoH: 1200, ...full }, "gallery");
    expect(l.photo).toEqual({ x: 3, y: 3, w: 94, h: (94 * 1200) / 900 });
    expect(l.height).toBeCloseTo(3 + (94 * 1200) / 900 + 9.5, 9);
    expect(l.text.left).toBeCloseTo(4.8, 9);
    expect(l.text.right).toBeCloseTo(95.2, 9);
    expect(l.text.fontSize).toBe(1.8);
  });
  it("leaves at least 0.8 of the text size of air under three caption lines, in every shape", () => {
    for (const shape of Object.keys(SHAPES) as Array<keyof typeof SHAPES>) {
      const g = geometryOf(shape);
      const l = layoutCard({ photoW: 900, photoH: 1200, ...full }, shape);
      const thirdLineBoxBottom = l.strip.y + g.gap + 3 * g.fontSize * g.lineHeight;
      expect(l.height - thirdLineBoxBottom, shape).toBeGreaterThanOrEqual(0.8 * g.fontSize - 1e-9);
    }
  });
  it("gives each shape its own height", () => {
    expect(cardHeightUnits(900, 1200, "card")).toBeCloseTo(141, 9);
    expect(cardHeightUnits(900, 1200, "gallery")).toBeCloseTo(3 + 94 * (4 / 3) + 9.5, 9);
    expect(cardHeightUnits(900, 600, "thin")).toBeCloseTo(2 + 64 + 7, 9);
  });
});
