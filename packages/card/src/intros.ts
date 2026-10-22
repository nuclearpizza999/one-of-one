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

export function assignIntro(seed: number): Intro {
  // >>> 0 coerces any number, including NaN and non-integers, to an unsigned 32-bit index.
  return INTROS[(seed >>> 0) % INTROS.length]!;
}
