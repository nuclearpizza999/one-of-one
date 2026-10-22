"use client";

import type { CSSProperties, FocusEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import type { IntroId } from "./intros";
import { CARD_FONT_FAMILY } from "./fonts";
import { CARD } from "./layout";
import type { LineKind } from "./layout";

export interface CardPhoto {
  src: string;
  width: number;
  height: number;
  alt?: string;
}

export interface CardProps {
  /** null renders the empty mat. */
  photo?: CardPhoto | null;
  place: string;
  date: string;
  coords: string;
  number: number | null;
  /** Caption lines become contenteditable with hints; empty lines stay visible. */
  editable?: boolean;
  /** Fired when an editable line loses focus. */
  onCaptionChange?: (field: LineKind, text: string) => void;
  /** Adds oo-intro-<id> on the frame so card.css plays it. */
  intro?: IntroId | null;
  /** Change the value to remount the frame and replay the intro. */
  replayKey?: number;
  /** light: hairline and shadow around the card. dark: nothing. The card itself never changes. */
  wall?: "light" | "dark";
  /** Reserved for the step 2 border variation layer. */
  border?: ReactNode;
  /** Tap or Enter on the empty mat. */
  onPick?: () => void;
  id?: string;
}

const HINTS: Record<LineKind, string> = {
  place: "Where was this?",
  date: "When?",
  coords: "Coordinates",
};

/** True when a DOM event started inside an editable caption line, so the mat's pick handlers ignore it. */
export function startsInCaption(target: EventTarget | null): boolean {
  const el = target as { closest?: (selector: string) => unknown } | null;
  return typeof el?.closest === "function" && el.closest("[contenteditable]") != null;
}

/** Geometry and type for card.css, fed from CARD so the two painters share one source. Built once. */
const FRAME_VARS = {
  "--oo-mat": `${CARD.mat}cqw`,
  "--oo-strip": `${CARD.stripHeight}cqw`,
  "--oo-inset": `${CARD.inset}cqw`,
  "--oo-bottom": `${CARD.bottom}cqw`,
  "--oo-fs": `${CARD.fontSize}cqw`,
  "--oo-lh": `${CARD.lineHeight}`,
  "--oo-place-max": `${CARD.photoWidth * CARD.placeMaxWidthRatio}cqw`,
  "--oo-font": CARD_FONT_FAMILY,
  "--oo-ink": CARD.ink,
  "--oo-ink-coords": CARD.inkCoords,
  "--oo-weight": `${CARD.weight}`,
  "--oo-weight-coords": `${CARD.weightCoords}`,
} as CSSProperties;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function Card({
  photo = null,
  place,
  date,
  coords,
  number,
  editable = false,
  onCaptionChange,
  intro = null,
  replayKey = 0,
  wall = "light",
  border,
  onPick,
  id,
}: CardProps) {
  const empty = photo === null;
  const pickable = empty && onPick !== undefined;
  const frameClass = intro ? `oo-frame oo-intro-${intro}` : "oo-frame";

  const allLines: Array<{ kind: LineKind; text: string }> = [
    { kind: "place", text: place },
    { kind: "date", text: date },
    { kind: "coords", text: coords },
  ];
  const lines = allLines.filter((l) => editable || l.text.trim().length > 0);

  const onPickClick = (e: MouseEvent<HTMLElement>) => {
    if (startsInCaption(e.target)) return;
    onPick?.();
  };
  const onPickKey = (e: KeyboardEvent<HTMLElement>) => {
    if (startsInCaption(e.target)) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick?.();
    }
  };
  const onLineKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };
  const onLineBlur = (kind: LineKind) => (e: FocusEvent<HTMLSpanElement>) => {
    onCaptionChange?.(kind, e.currentTarget.textContent ?? "");
  };

  return (
    <div className={frameClass} id={id} key={replayKey} style={FRAME_VARS}>
      <figure
        className="oo-card"
        data-wall={wall}
        data-empty={empty ? "true" : "false"}
        data-editable={editable ? "true" : "false"}
        role={pickable ? "button" : undefined}
        tabIndex={pickable ? 0 : undefined}
        aria-label={pickable ? "Add a photo" : undefined}
        onClick={pickable ? onPickClick : undefined}
        onKeyDown={pickable ? onPickKey : undefined}
      >
        {border ? <div className="oo-border">{border}</div> : null}
        <div className="oo-photo-wrap">
          {photo ? (
            <img
              className="oo-photo"
              src={photo.src}
              alt={photo.alt ?? ""}
              width={photo.width}
              height={photo.height}
            />
          ) : (
            <div className="oo-empty">Tap to add a photo</div>
          )}
        </div>
        <figcaption className="oo-plate">
          <div className="oo-lines">
            {lines.map((l) =>
              editable ? (
                <span
                  key={l.kind}
                  className={`oo-line oo-line-${l.kind}`}
                  data-hint={HINTS[l.kind]}
                  contentEditable="plaintext-only"
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={onLineBlur(l.kind)}
                  onKeyDown={onLineKey}
                  dangerouslySetInnerHTML={{ __html: escapeHtml(l.text) }}
                />
              ) : (
                <span key={l.kind} className={`oo-line oo-line-${l.kind}`}>
                  {l.text}
                </span>
              ),
            )}
          </div>
          <span className="oo-num">{number === null ? "" : `#${number}`}</span>
        </figcaption>
      </figure>
    </div>
  );
}
