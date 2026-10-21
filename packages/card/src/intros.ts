export type IntroId = "rise" | "develop" | "flip";

export interface Intro {
  id: IntroId;
  label: string;
  /** ms after the intro starts when the number count-up begins (used from step 5). */
  numberAt: number;
  /** ms after the intro starts when the card is settled and controls enable. */
  total: number;
}

/** Adding an intro is one entry here plus one CSS class in card.css. */
export const INTROS: readonly Intro[] = [
  { id: "rise", label: "Rise", numberAt: 1700, total: 2300 },
  { id: "develop", label: "Develop", numberAt: 2300, total: 3000 },
  { id: "flip", label: "Flip", numberAt: 1500, total: 2000 },
];

/**
 * Placeholder seed until step 2's variation seed exists: FNV-1a over the
 * photo's byte size and pixel dimensions, so the same photo always gets
 * the same intro.
 */
export function seedFromPhoto(sizeBytes: number, width: number, height: number): number {
  const input = `${sizeBytes}:${width}:${height}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function assignIntro(seed: number): Intro {
  return INTROS[Math.abs(seed) % INTROS.length]!;
}
