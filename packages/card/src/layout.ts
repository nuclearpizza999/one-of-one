/**
 * Card geometry. Every number is in units of the card's outer width,
 * where the card is exactly 100 units wide. The screen painter multiplies
 * by 1cqw; the print painter multiplies by W / 100 pixels.
 */
export const CARD = {
  width: 100,
  mat: 5,
  photoWidth: 90,
  stripHeight: 16,
  fontSize: 3,
  lineHeight: 1.2,
  inset: 3,
  /** The first caption line's box starts this far below the photo; the lines stack beneath it. */
  gap: 2.4,
  placeMaxWidthRatio: 0.72,
  ink: "#111",
  inkCoords: "#333",
  weight: 600,
  weightCoords: 400,
  /**
   * Distance from the bottom of a line box to its baseline, as a fraction
   * of font size. Measured by the equivalence test's probe on 2026-10-22
   * (DOM probe: 0.2667) for EB Garamond at line-height 1.2, and frozen here.
   */
  baselineFromBottom: 0.27,
} as const;

/** The fields of CARD, with numbers that a print shape may change. */
export interface CardGeometry {
  width: 100;
  mat: number;
  photoWidth: number;
  stripHeight: number;
  fontSize: number;
  lineHeight: number;
  inset: number;
  gap: number;
  placeMaxWidthRatio: number;
  ink: "#111";
  inkCoords: "#333";
  weight: 600;
  weightCoords: 400;
  baselineFromBottom: number;
}

export interface ShapeDef {
  id: string;
  label: string;
  /** Border on the top and sides, caption strip and text size, in units of the print's width. */
  mat: number;
  stripHeight: number;
  fontSize: number;
}

/**
 * Print shapes (decided Nov 9, 2026). The screen is always the card; a print may take
 * any shape. A shape sets the border, the strip and the text; the photo takes the
 * rest of the width, and the indent and the gap follow the text as on the card.
 */
export const SHAPES = {
  card: { id: "card", label: "Card", mat: CARD.mat, stripHeight: CARD.stripHeight, fontSize: CARD.fontSize },
  gallery: { id: "gallery", label: "Gallery", mat: 3, stripHeight: 9.5, fontSize: 1.8 },
  thin: { id: "thin", label: "Thin", mat: 2, stripHeight: 7, fontSize: 1.3 },
} as const satisfies Record<string, ShapeDef>;
export type Shape = keyof typeof SHAPES;

const round4 = (n: number) => Number(n.toFixed(4));

/** A shape's full geometry. The card's is CARD itself: indent = text size, gap = 0.8 × text size. */
export function geometryOf(shape: Shape): CardGeometry {
  const s: ShapeDef = SHAPES[shape];
  return {
    ...CARD,
    mat: s.mat,
    photoWidth: round4(CARD.width - 2 * s.mat),
    stripHeight: s.stripHeight,
    fontSize: s.fontSize,
    inset: s.fontSize,
    gap: round4(0.8 * s.fontSize),
  };
}

export interface CardSpec {
  photoW: number;
  photoH: number;
  place: string;
  date: string;
  coords: string;
  number: number | null;
}

export type LineKind = "place" | "date" | "coords";

export interface CaptionLine {
  kind: LineKind;
  text: string;
  weight: 400 | 600;
  color: "#111" | "#333";
  baselineY: number;
}

export interface CardLayout {
  width: 100;
  height: number;
  photo: { x: number; y: number; w: number; h: number };
  strip: { y: number; h: number };
  text: {
    left: number;
    right: number;
    fontSize: number;
    lineHeight: number;
    placeMaxWidth: number;
  };
  lines: CaptionLine[];
  number: { text: string; baselineY: number } | null;
}

export function layoutCard(spec: CardSpec, shape: Shape = "card"): CardLayout {
  const g = geometryOf(shape);
  const photoH = (g.photoWidth * spec.photoH) / spec.photoW;
  const photo = { x: g.mat, y: g.mat, w: g.photoWidth, h: photoH };
  const strip = { y: g.mat + photoH, h: g.stripHeight };
  const height = strip.y + strip.h;

  const fontSize = g.fontSize;
  const lineHeight = fontSize * g.lineHeight;
  // Hung from the photo: line i's box spans [strip.y + gap + i*lineHeight, +lineHeight]; its baseline sits baselineFromBottom*fontSize above the box's bottom.
  const baselineOf = (i: number) => strip.y + g.gap + (i + 1) * lineHeight - fontSize * g.baselineFromBottom;

  const candidates: Array<Omit<CaptionLine, "baselineY">> = [
    { kind: "place", text: spec.place.trim(), weight: g.weight, color: g.ink },
    { kind: "date", text: spec.date.trim(), weight: g.weight, color: g.ink },
    { kind: "coords", text: spec.coords.trim(), weight: g.weightCoords, color: g.inkCoords },
  ];
  const present = candidates.filter((l) => l.text.length > 0);
  const lines: CaptionLine[] = present.map((l, i) => ({
    ...l,
    baselineY: baselineOf(i),
  }));
  // The number rides the last present line's baseline, or where the first line would be.
  const number =
    spec.number === null
      ? null
      : { text: `#${spec.number}`, baselineY: baselineOf(Math.max(present.length - 1, 0)) };

  return {
    width: 100,
    height,
    photo,
    strip,
    text: {
      left: g.mat + g.inset,
      right: g.mat + g.photoWidth - g.inset,
      fontSize,
      lineHeight,
      placeMaxWidth: g.photoWidth * g.placeMaxWidthRatio,
    },
    lines,
    number,
  };
}

/** Card height in units for a photo of this aspect ratio: border + photo + caption strip, in the given shape. */
export function cardHeightUnits(photoW: number, photoH: number, shape: Shape = "card"): number {
  const g = geometryOf(shape);
  return g.mat + (g.photoWidth * photoH) / photoW + g.stripHeight;
}
