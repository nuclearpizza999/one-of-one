"use client";

import type { CSSProperties, FocusEvent, KeyboardEvent, MouseEvent } from "react";
import { useRef, useState } from "react";
import type { IntroId } from "./intros";
import { CARD_FONT_FAMILY } from "./fonts";
import { borderDataUrl } from "./border";
import { CARD, SHAPES, type Shape, cardHeightUnits, geometryOf } from "./layout";
import type { LineKind } from "./layout";
import { MOTIONS, type MotionDef, lightGeometry } from "./motions";
import type { Variation } from "./variation";

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
  /** The derived border variation; null or absent draws the plain white mat. Never user-chosen. */
  variation?: Variation | null;
  /** Tap or Enter on the empty mat. */
  onPick?: () => void;
  id?: string;
  /** The print shape for a print preview; the screen card is always the default, "card". */
  shape?: Shape;
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

const round4 = (n: number) => Number(n.toFixed(4));

/** Geometry and type for card.css, from the shape's geometry so the two painters share one source. Built once per shape. */
const FRAME_VARS = Object.fromEntries(
  (Object.keys(SHAPES) as Shape[]).map((shape) => {
    const g = geometryOf(shape);
    const vars = {
      "--oo-mat": `${g.mat}cqw`,
      "--oo-strip": `${g.stripHeight}cqw`,
      "--oo-inset": `${g.inset}cqw`,
      "--oo-gap": `${g.gap}cqw`,
      "--oo-fs": `${g.fontSize}cqw`,
      "--oo-lh": `${g.lineHeight}`,
      "--oo-place-max": `${round4(g.photoWidth * g.placeMaxWidthRatio)}cqw`,
      "--oo-font": CARD_FONT_FAMILY,
      "--oo-ink": g.ink,
      "--oo-ink-coords": g.inkCoords,
      "--oo-weight": `${g.weight}`,
      "--oo-weight-coords": `${g.weightCoords}`,
    } as CSSProperties;
    return [shape, vars];
  }),
) as Record<Shape, CSSProperties>;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** At most this many tap blooms show at once; a tap beyond it is ignored. */
const MAX_BLOOMS = 4;

interface Bloom {
  id: number;
  /** Card units from the card's top-left corner. */
  x: number;
  y: number;
}

const units = (n: number): string => Number(n.toFixed(3)).toString();

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
  variation = null,
  onPick,
  id,
  shape = "card",
}: CardProps) {
  const empty = photo === null;
  const pickable = empty && onPick !== undefined;
  const motion: MotionDef | null = variation ? MOTIONS[variation.motion] : null;
  const frameClass = ["oo-frame", intro ? `oo-intro-${intro}` : null, motion?.className ?? null].filter(Boolean).join(" ");
  // The light layer: every motion but None, on a card with a photo (the empty mat has no border to light).
  const height = photo ? cardHeightUnits(photo.width, photo.height, shape) : null;
  const lightShape = variation && height !== null ? { height, seed: variation.seed } : null;
  const lightPieces = lightShape && motion?.light ? motion.light(lightShape) : null;
  const keyframes = lightShape && lightPieces ? (motion?.keyframes?.(lightShape) ?? null) : null;
  const [blooms, setBlooms] = useState<readonly Bloom[]>([]);
  const nextBloom = useRef(0);
  // A tap on a card with a light layer sends Sheen's light out from the finger. A click, not a press, so a
  // scroll that starts on the card does not bloom. Never from a caption line being typed, and never under
  // reduced motion: the layer is hidden there, so the bloom's animation would never end to remove it.
  const onBloom = (e: MouseEvent<HTMLElement>) => {
    if (startsInCaption(e.target)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = e.currentTarget.getBoundingClientRect();
    const unit = box.width / CARD.width;
    const bloom: Bloom = { id: nextBloom.current, x: (e.clientX - box.left) / unit, y: (e.clientY - box.top) / unit };
    nextBloom.current += 1;
    setBlooms((bs) => (bs.length >= MAX_BLOOMS ? bs : [...bs, bloom]));
  };
  const endBloom = (id: number) => setBlooms((bs) => bs.filter((b) => b.id !== id));

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
    <div className={frameClass} id={id} key={replayKey} style={FRAME_VARS[shape]}>
      <figure
        className="oo-card"
        data-wall={wall}
        data-empty={empty ? "true" : "false"}
        data-editable={editable ? "true" : "false"}
        data-texture={variation?.texture}
        data-tone={variation?.tone}
        data-tone-strength={variation?.toneStrength}
        data-tier={variation?.tier}
        data-motion={variation?.motion}
        role={pickable ? "button" : undefined}
        tabIndex={pickable ? 0 : undefined}
        aria-label={pickable ? "Add a photo" : undefined}
        onClick={pickable ? onPickClick : lightPieces ? onBloom : undefined}
        onKeyDown={pickable ? onPickKey : undefined}
      >
        {variation && photo ? (
          <div className="oo-border">
            <img
              className="oo-border-img"
              src={borderDataUrl(variation, height!, shape)}
              alt=""
              draggable={false}
            />
          </div>
        ) : null}
        {lightPieces && height !== null ? (
          <div className="oo-light" aria-hidden="true" style={lightGeometry(height) as CSSProperties}>
            {lightPieces.map((p, i) => (
              <span key={i} className={p.className} style={p.style as CSSProperties | undefined} />
            ))}
            {blooms.map((b) => (
              <span
                key={`bloom-${b.id}`}
                className="oo-light-bloom"
                style={{ "--oo-cx": units(b.x), "--oo-cy": units(b.y) } as CSSProperties}
                onAnimationEnd={() => endBloom(b.id)}
              />
            ))}
          </div>
        ) : null}
        {keyframes ? (
          // React hoists this into the head and renders each name once, so cards of one shape share it.
          <style href={keyframes.name} precedence="oo-motion">
            {keyframes.css}
          </style>
        ) : null}
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
          <div className="oo-caption">
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
          </div>
        </figcaption>
      </figure>
    </div>
  );
}
