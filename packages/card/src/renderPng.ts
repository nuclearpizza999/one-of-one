import { cardFont, loadCardFonts } from "./fonts";
import { layoutCard } from "./layout";

/** Photo width cap for the print PNG, in pixels. 300 dpi at 12 inches needs 3600. */
export const PRINT_CAP = 4800;

export interface PrintDims {
  photoW: number;
  photoH: number;
  scale: number;
  W: number;
  H: number;
  u: number;
}

/** Pixel dimensions of the print: the photo at native width up to the cap, the card around it. */
export function printDimensions(naturalW: number, naturalH: number, cap = PRINT_CAP): PrintDims {
  const photoW = Math.min(naturalW, cap);
  const scale = photoW / naturalW;
  const photoH = Math.round(naturalH * scale);
  const W = Math.round(photoW / 0.9);
  const u = W / 100;
  const H = Math.round(5 * u + photoH + 19.2 * u);
  return { photoW, photoH, scale, W, H, u };
}

/** The part of CanvasRenderingContext2D the painter uses, so a Node canvas or a test fake can stand in. */
export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
}

export interface CanvasTarget {
  width: number;
  height: number;
  getContext(contextId: "2d"): Ctx2D | null;
}

/** Trim text to an ellipsis so it fits maxWidth, matching the screen's text-overflow. */
export function ellipsize(ctx: Pick<Ctx2D, "measureText">, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  for (let end = text.length - 1; end > 0; end -= 1) {
    const candidate = text.slice(0, end).trimEnd() + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) return candidate;
  }
  return ellipsis;
}

export interface DrawSpec {
  place: string;
  date: string;
  coords: string;
  number: number | null;
}

/** Draw the card onto a context whose canvas is dims.W by dims.H. Pure: no fonts loading, no blob. */
export function drawCard(ctx: Ctx2D, image: CanvasImageSource, dims: PrintDims, spec: DrawSpec): void {
  const { photoW, photoH, W, H, u } = dims;
  const layout = layoutCard({ photoW, photoH, ...spec });
  const fs = layout.text.fontSize * u;
  // Positions are measured up from the bottom edge so rounding in H never moves the caption.
  const yFromBottom = (baselineY: number) => H - (layout.height - baselineY) * u;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(image, layout.photo.x * u, layout.photo.y * u, photoW, photoH);

  ctx.textBaseline = "alphabetic";
  for (const line of layout.lines) {
    ctx.font = cardFont(line.weight, fs);
    ctx.fillStyle = line.color;
    ctx.textAlign = "left";
    const text =
      line.kind === "place" ? ellipsize(ctx, line.text, layout.text.placeMaxWidth * u) : line.text;
    ctx.fillText(text, layout.text.left * u, yFromBottom(line.baselineY));
  }
  if (layout.number) {
    ctx.font = cardFont(600, fs);
    ctx.fillStyle = "#111";
    ctx.textAlign = "right";
    ctx.fillText(layout.number.text, layout.text.right * u, yFromBottom(layout.number.baselineY));
  }
}

export interface RenderPngInput extends DrawSpec {
  image: CanvasImageSource;
  naturalWidth: number;
  naturalHeight: number;
  cap?: number;
  /** Defaults to document.createElement("canvas"). Pass a Node canvas factory on a server. */
  createCanvas?: (width: number, height: number) => CanvasTarget;
  /** Defaults to HTMLCanvasElement.toBlob as image/png. */
  toBlob?: (canvas: CanvasTarget) => Promise<Blob>;
}

export interface RenderPngResult {
  blob: Blob;
  width: number;
  height: number;
  /** false when EB Garamond was not available and the fallback serif was drawn. */
  fontsLoaded: boolean;
  /** true when the full-size canvas failed and the PNG was drawn at half the cap. */
  reduced: boolean;
}

function domCanvas(width: number, height: number): CanvasTarget {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function domToBlob(canvas: CanvasTarget): Promise<Blob> {
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/png",
    );
  });
}

/** Render the print PNG. Retries once at half the cap if the phone cannot allocate the full canvas. */
export async function renderPng(input: RenderPngInput): Promise<RenderPngResult> {
  const cap = input.cap ?? PRINT_CAP;
  const createCanvas = input.createCanvas ?? domCanvas;
  const toBlob = input.toBlob ?? domToBlob;
  const fontsLoaded = await loadCardFonts();
  const fullPhotoW = Math.min(input.naturalWidth, cap);

  let lastError: unknown;
  for (const attemptCap of [cap, Math.floor(cap / 2)]) {
    const dims = printDimensions(input.naturalWidth, input.naturalHeight, attemptCap);
    try {
      const canvas = createCanvas(dims.W, dims.H);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get a 2d context");
      drawCard(ctx, input.image, dims, input);
      const blob = await toBlob(canvas);
      return {
        blob,
        width: dims.W,
        height: dims.H,
        fontsLoaded,
        reduced: dims.photoW < fullPhotoW,
      };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not render the card");
}
