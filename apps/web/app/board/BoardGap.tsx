"use client";

import { useEffect, useState } from "react";
import { spinSchedule } from "@/lib/spin";

/** The six 1/1 designs, in the order the spin indexes them. */
const DESIGNS = ["fraction", "diagonal", "wordmark", "stacked", "pattern", "cropped"] as const;

function Design({ name }: { name: (typeof DESIGNS)[number] }) {
  switch (name) {
    case "fraction":
      return (
        <span className="gap-fraction">
          1<span className="gap-rule" />1
        </span>
      );
    case "diagonal":
      return (
        <>
          <svg className="gap-diagonal" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="gap-corner gap-corner-tl">1</span>
          <span className="gap-corner gap-corner-br">1</span>
        </>
      );
    case "wordmark":
      return <span className="gap-wordmark">1/1</span>;
    case "stacked":
      return (
        <span className="gap-stacked">
          <span>1</span>
          <span className="gap-slash">/</span>
          <span>1</span>
        </span>
      );
    case "pattern":
      return <span className="gap-pattern">{"1/1 ".repeat(120)}</span>;
    case "cropped":
      return <span className="gap-cropped">1/1</span>;
  }
}

/**
 * The empty space at the end of the Board's last row. On open it flicks
 * through the six designs, slowing down, and lands on a random one; with
 * reduced motion it shows the random pick at once. Decoration only.
 */
export function BoardGap() {
  const [shown, setShown] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const spin = spinSchedule(DESIGNS.length, Math.random);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Next tick, not inside the effect body: no flick, just the landed design.
      const t = window.setTimeout(() => {
        setShown(spin.final);
        setLanded(true);
      }, 0);
      return () => window.clearTimeout(t);
    }
    const timers: number[] = [];
    let at = 0;
    spin.steps.forEach((step, i) => {
      at += step.delay;
      timers.push(
        window.setTimeout(() => {
          setShown(step.design);
          if (i === spin.steps.length - 1) setLanded(true);
        }, at),
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <span className="board-fill" aria-hidden="true" data-landed={landed ? "true" : undefined}>
      {shown === null ? null : (
        <span className="gap-logo" data-design={DESIGNS[shown]}>
          <Design name={DESIGNS[shown]!} />
        </span>
      )}
    </span>
  );
}
