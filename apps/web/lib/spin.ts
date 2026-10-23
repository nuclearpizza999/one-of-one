export interface SpinStep {
  /** Milliseconds to wait before showing this step's design. */
  delay: number;
  design: number;
}

export interface Spin {
  steps: SpinStep[];
  final: number;
}

const FLICKS = 12;
const FIRST_MS = 40;
const LAST_MS = 150;

/**
 * The slot-machine spin: twelve flicks through `count` designs, slowing down
 * (delays grow on an ease-in curve from 40 to 150 ms, about a second in all),
 * never repeating a design twice in a row, landing on a random final design.
 */
export function spinSchedule(count: number, random: () => number): Spin {
  const final = Math.min(count - 1, Math.floor(random() * count));
  const steps: SpinStep[] = [];
  let previous = -1;
  for (let i = 0; i < FLICKS; i += 1) {
    const t = i / (FLICKS - 1);
    const delay = Math.round(FIRST_MS + (LAST_MS - FIRST_MS) * t * t);
    let design: number;
    if (i === FLICKS - 1) {
      design = final;
    } else {
      // Any design but the previous one, and not the final one on the step just before it lands.
      const avoid = new Set([previous, i === FLICKS - 2 ? final : -1]);
      const choices = Array.from({ length: count }, (_, k) => k).filter((k) => !avoid.has(k));
      design = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]!;
    }
    steps.push({ delay, design });
    previous = design;
  }
  return { steps, final };
}
