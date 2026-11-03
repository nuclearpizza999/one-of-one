import { mulberry32, svgDataUrl } from "./border";
import { CARD } from "./layout";

const r3 = (n: number): string => Number(n.toFixed(3)).toString();

/*
 * Motions: Sheen's own white light on different paths, screen only. The founders pick
 * them; the Animated tier assigns Sheen. Each draws in a light layer over the border
 * and under the photo and the caption (card.css). What a motion's light needs from the
 * card's shape and seed is worked out here, pure, so the tests can hold it.
 */

/** What a motion's light needs to know about one card. Lengths in card units. */
export interface LightShape {
  /** The card's height, from cardHeightUnits. */
  height: number;
  seed: number;
}

/** One element in the card's light layer: its classes, and any inline properties it reads. */
export interface LightPiece {
  className: string;
  style?: Readonly<Record<string, string>>;
}

export interface MotionDef {
  id: string;
  label: string;
  /** Class on .oo-frame that card.css animates; null for no motion. Screen only. */
  className: string | null;
  /** The pieces the card's light layer holds; null for no motion, which gets no layer. */
  light: ((shape: LightShape) => LightPiece[]) | null;
  /** Keyframes made for the card's shape; the card renders each name once. */
  keyframes?: (shape: LightShape) => { name: string; css: string };
}

export const MOTIONS = {
  none: { id: "none", label: "None", className: null, light: null },
  // Sheen draws in .oo-border::after; its layer is empty but takes the tap bloom.
  sheen: { id: "sheen", label: "Sheen", className: "oo-motion-sheen", light: (_shape: LightShape) => [] },
} as const satisfies Record<string, MotionDef>;
export type Motion = keyof typeof MOTIONS;

/**
 * A stored motion as one the registry still has. Founders' saved cards may hold a retired
 * motion (Glow, Twinkle and Petals, retired Oct 27, 2026); those read as none. Saved rows
 * are never rewritten, so every read of a stored variation goes through this.
 */
export function knownMotion(id: string): Motion {
  return Object.hasOwn(MOTIONS, id) ? (id as Motion) : "none";
}

function photoHeight(height: number): number {
  return height - CARD.mat - CARD.stripHeight;
}

/**
 * The custom properties the light layer carries, in card units: the card's height, the
 * photo's centre, and the reach from that centre to the farthest corner plus 6, so a ring
 * sized to it clears the whole card.
 */
export function lightGeometry(height: number): Record<"--oo-h" | "--oo-cx" | "--oo-cy" | "--oo-r", string> {
  const cx = CARD.width / 2;
  const cy = CARD.mat + photoHeight(height) / 2;
  const corners = [[0, 0], [CARD.width, 0], [0, height], [CARD.width, height]] as const;
  const r = Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy))) + 6;
  return { "--oo-h": r3(height), "--oo-cx": r3(cx), "--oo-cy": r3(cy), "--oo-r": r3(r) };
}

/** The caption's three lines and the number, inset to inset, with air round them. Starlight keeps out of it. */
export function captionBlock(height: number): { x0: number; x1: number; y0: number; y1: number } {
  const top = height - CARD.stripHeight + CARD.gap;
  const air = { x: 2.6, y: 2.2 };
  return {
    x0: CARD.mat + CARD.inset - air.x,
    x1: CARD.width - CARD.mat - CARD.inset + air.x,
    y0: top - air.y,
    y1: top + 3 * CARD.fontSize * CARD.lineHeight + air.y,
  };
}

/** Starlight: how many points, how far inside its band each sits, and the range of their beats in seconds. */
export const STARLIGHT = { points: 10, margin: 2.5, minSeconds: 4.5, spanSeconds: 3 } as const;

export interface StarPoint {
  x: number;
  y: number;
  /** Seconds per beat. */
  duration: number;
  /** Seconds, negative: how far into its beat the point starts. */
  delay: number;
}

/**
 * Where Starlight's points sit, from the card's seed: in the mat (the top, side or bottom
 * band, picked by area), at least STARLIGHT.margin inside it, and clear of the caption's
 * three lines whatever the caption holds, so typing a caption never moves them. Each point
 * gets its own beat and starts part-way through it.
 */
export function starlightPoints(shape: LightShape): StarPoint[] {
  // A stream apart from the texture's, which draws from mulberry32(seed).
  const rng = mulberry32((shape.seed ^ 0x3c6ef372) >>> 0);
  const photoH = photoHeight(shape.height);
  const photoBottom = CARD.mat + photoH;
  const bands = [
    { x: 0, y: 0, w: CARD.width, h: CARD.mat },
    { x: 0, y: CARD.mat, w: CARD.mat, h: photoH },
    { x: CARD.width - CARD.mat, y: CARD.mat, w: CARD.mat, h: photoH },
    { x: 0, y: photoBottom, w: CARD.width, h: CARD.stripHeight },
  ];
  const areas = bands.map((b) => b.w * b.h);
  const total = areas.reduce((a, b) => a + b, 0);
  const clear = captionBlock(shape.height);
  const m = STARLIGHT.margin;
  const points: StarPoint[] = [];
  for (let tries = 0; points.length < STARLIGHT.points && tries < 1000; tries += 1) {
    let pick = rng() * total;
    let band = bands[bands.length - 1]!;
    for (let k = 0; k < bands.length; k += 1) {
      if (pick < areas[k]!) {
        band = bands[k]!;
        break;
      }
      pick -= areas[k]!;
    }
    const x = band.x + Math.min(m, band.w / 2) + rng() * Math.max(0, band.w - 2 * m);
    const y = band.y + Math.min(m, band.h / 2) + rng() * Math.max(0, band.h - 2 * m);
    if (x > clear.x0 && x < clear.x1 && y > clear.y0 && y < clear.y1) continue;
    const duration = STARLIGHT.minSeconds + rng() * STARLIGHT.spanSeconds;
    points.push({ x, y, duration, delay: -rng() * duration });
  }
  return points;
}

/** Glint: its path runs `inset` in from the card's edge, inside a mask on the outer `rim` units softened by `blur`. */
export const GLINT = { inset: CARD.mat / 2, rim: CARD.mat, blur: 1.3 } as const;

/**
 * Glint's keyframes for one card shape: a piece of light round a rectangle GLINT.inset in
 * from the edge, at an even pace. The corners fall at fractions of the lap that depend on
 * the height, so each shape gets its own name, and cards of one shape share it.
 */
export function glintKeyframes(height: number): { name: string; css: string } {
  const H = Number(height.toFixed(3));
  const i = GLINT.inset;
  const w = CARD.width - 2 * i;
  const h = H - 2 * i;
  const lap = 2 * (w + h);
  const stops: Array<[number, number, number]> = [
    [i, i, 0],
    [CARD.width - i, i, w / lap],
    [CARD.width - i, H - i, (w + h) / lap],
    [i, H - i, (2 * w + h) / lap],
    [i, i, 1],
  ];
  const name = `oo-glint-${Math.round(H * 100)}`;
  const frames = stops.map(([x, y, at]) => `${r3(at * 100)}% { transform: translate(${r3(x)}cqw, ${r3(y)}cqw); }`).join(" ");
  return { name, css: `@keyframes ${name} { ${frames} }` };
}

/** Glint's mask as an image URL: the card's outer GLINT.rim units, softened, so the light keeps to the edge. */
export function glintRim(height: number): string {
  const H = r3(height);
  const w = GLINT.rim;
  const inner = `M${r3(w)} ${r3(w)}H${r3(CARD.width - w)}V${r3(height - w)}H${r3(w)}Z`;
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${H}" width="100" height="${H}">` +
      `<defs><filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${GLINT.blur}"/></filter></defs>` +
      `<path filter="url(#b)" fill="#fff" fill-rule="evenodd" d="M0 0H100V${H}H0Z ${inner}"/></svg>`,
  );
}
