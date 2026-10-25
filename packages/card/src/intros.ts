export type IntroId = "rise" | "develop" | "flip" | "fade" | "slide" | "drop";

export interface Intro {
  id: IntroId;
  label: string;
  /** ms after the intro starts when the number count-up begins (used from step 5). */
  numberAt: number;
  /** ms after the intro starts when the card is settled and controls enable. */
  total: number;
  /**
   * Whether assignIntro may give it to a card. The first three are; the later ones are
   * reached only through the founders' design panel, so every existing seed keeps its intro.
   */
  assignable: boolean;
}

/** Adding an intro is one entry here plus one CSS class in card.css. */
export const INTROS: readonly Intro[] = [
  { id: "rise", label: "Rise", numberAt: 1700, total: 2300, assignable: true },
  { id: "develop", label: "Develop", numberAt: 2300, total: 3000, assignable: true },
  { id: "flip", label: "Flip", numberAt: 1500, total: 2000, assignable: true },
  { id: "fade", label: "Fade", numberAt: 1100, total: 1500, assignable: false },
  { id: "slide", label: "Slide", numberAt: 1300, total: 1800, assignable: false },
  { id: "drop", label: "Drop", numberAt: 1200, total: 1700, assignable: false },
];

const ASSIGNABLE: readonly Intro[] = INTROS.filter((i) => i.assignable);

export function assignIntro(seed: number): Intro {
  // >>> 0 coerces any number, including NaN and non-integers, to an unsigned 32-bit index.
  return ASSIGNABLE[(seed >>> 0) % ASSIGNABLE.length]!;
}
