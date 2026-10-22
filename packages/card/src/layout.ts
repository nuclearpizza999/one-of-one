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
   * of font size, for EB Garamond at line-height 1.2. Measured by the
   * equivalence test's probe (e2e/equivalence.spec.ts) and frozen here; provisional until
   * Task 2 of docs/superpowers/plans/2026-10-22-caption-under-photo.md records the measurement.
   */
  baselineFromBottom: 0.32,
} as const;

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

export function layoutCard(spec: CardSpec): CardLayout {
  const photoH = (CARD.photoWidth * spec.photoH) / spec.photoW;
  const photo = { x: CARD.mat, y: CARD.mat, w: CARD.photoWidth, h: photoH };
  const strip = { y: CARD.mat + photoH, h: CARD.stripHeight };
  const height = strip.y + strip.h;

  const fontSize = CARD.fontSize;
  const lineHeight = fontSize * CARD.lineHeight;
  // Hung from the photo: line i's box spans [strip.y + gap + i*lineHeight, +lineHeight]; its baseline sits baselineFromBottom*fontSize above the box's bottom.
  const baselineOf = (i: number) => strip.y + CARD.gap + (i + 1) * lineHeight - fontSize * CARD.baselineFromBottom;

  const candidates: Array<Omit<CaptionLine, "baselineY">> = [
    { kind: "place", text: spec.place.trim(), weight: CARD.weight, color: CARD.ink },
    { kind: "date", text: spec.date.trim(), weight: CARD.weight, color: CARD.ink },
    { kind: "coords", text: spec.coords.trim(), weight: CARD.weightCoords, color: CARD.inkCoords },
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
      left: CARD.mat + CARD.inset,
      right: CARD.mat + CARD.photoWidth - CARD.inset,
      fontSize,
      lineHeight,
      placeMaxWidth: CARD.photoWidth * CARD.placeMaxWidthRatio,
    },
    lines,
    number,
  };
}

/** Card height in units for a photo of this aspect ratio: mat + photo + caption strip. */
export function cardHeightUnits(photoW: number, photoH: number): number {
  return CARD.mat + (CARD.photoWidth * photoH) / photoW + CARD.stripHeight;
}
