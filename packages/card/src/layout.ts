/**
 * Card geometry. Every number is in units of the card's outer width,
 * where the card is exactly 100 units wide. The screen painter multiplies
 * by 1cqw; the print painter multiplies by W / 100 pixels.
 */
export const CARD = {
  width: 100,
  mat: 5,
  photoWidth: 90,
  stripHeight: 19.2,
  fontSize: 3.4,
  lineHeight: 1.32,
  inset: 3,
  bottom: 3.6,
  placeMaxWidthRatio: 0.72,
  /**
   * Distance from the bottom of a line box to its baseline, as a fraction
   * of font size, for EB Garamond at line-height 1.32. Measured once by the
   * equivalence test (e2e/equivalence.spec.ts) and frozen here.
   */
  baselineFromBottom: 0.3,
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
  const lastBaseline = height - CARD.bottom - fontSize * CARD.baselineFromBottom;

  const candidates: Array<Omit<CaptionLine, "baselineY">> = [
    { kind: "place", text: spec.place.trim(), weight: 600, color: "#111" },
    { kind: "date", text: spec.date.trim(), weight: 600, color: "#111" },
    { kind: "coords", text: spec.coords.trim(), weight: 400, color: "#333" },
  ];
  const present = candidates.filter((l) => l.text.length > 0);
  const lines: CaptionLine[] = present.map((l, i) => ({
    ...l,
    baselineY: lastBaseline - (present.length - 1 - i) * lineHeight,
  }));

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
    number:
      spec.number === null ? null : { text: `#${spec.number}`, baselineY: lastBaseline },
  };
}
