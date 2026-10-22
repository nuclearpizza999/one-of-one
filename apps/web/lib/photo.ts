import {
  type Palette,
  type Variation,
  deriveVariation,
  fmtCoords,
  fmtDate,
  paletteFromPixels,
  variationSeed,
} from "@one-of-one/card";
import type { PlaceMatch } from "@one-of-one/places";
import { type PhotoMetadata, readPhotoMetadata, wallClockMs } from "./exif";

export interface Caption {
  place: string;
  date: string;
  coords: string;
}

export interface DescribedPhoto {
  file: File;
  /** The card's id, made at pick time; null where no card exists (the gallery). */
  id: string | null;
  src: string;
  width: number;
  height: number;
  element: HTMLImageElement;
  meta: PhotoMetadata;
  match: PlaceMatch | null;
  lookupFailed: boolean;
  caption: Caption;
  /** The photo's edge colours for the "photo" tone; null when sampling was impossible. */
  palette: Palette | null;
  /** The assigned variation (number null until the card is public). */
  variation: Variation;
}

export type PlaceLookup = (lat: number, lng: number) => Promise<PlaceMatch | null>;

/** Asks our own route for the place. Throws on any failure so the caller can say so. */
export async function lookupPlace(lat: number, lng: number): Promise<PlaceMatch | null> {
  const res = await fetch("/api/place", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lat, lng }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`place lookup failed: ${res.status}`);
  const body = (await res.json()) as { match: PlaceMatch | null };
  return body.match;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image could not be decoded"));
    img.src = src;
  });
}

/** The photo's edge colours, sampled at a small size. Null when a canvas is unavailable or the read fails. */
export function samplePhotoPalette(img: HTMLImageElement, size = 32): Palette | null {
  try {
    const landscape = img.naturalWidth >= img.naturalHeight;
    const w = landscape ? size : Math.max(8, Math.round((size * img.naturalWidth) / img.naturalHeight));
    const h = landscape ? Math.max(8, Math.round((size * img.naturalHeight) / img.naturalWidth)) : size;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return paletteFromPixels(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch {
    return null;
  }
}

/**
 * Everything the Make screen and the gallery share: decode, read EXIF, look up
 * the place, build the caption, sample the palette, derive the variation.
 * Returns null when the image cannot be decoded (its object URL is revoked).
 */
export async function describePhoto(
  file: File,
  lookup: PlaceLookup = lookupPlace,
  cardId: string | null = null,
): Promise<DescribedPhoto | null> {
  const src = URL.createObjectURL(file);
  const [img, meta] = await Promise.all([
    loadImage(src).catch(() => null),
    readPhotoMetadata(file, file.lastModified),
  ]);
  if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) {
    URL.revokeObjectURL(src);
    return null;
  }

  let match: PlaceMatch | null = null;
  let lookupFailed = false;
  if (meta.gps) {
    try {
      match = await lookup(meta.gps.lat, meta.gps.lng);
    } catch {
      lookupFailed = true;
    }
  }

  const caption: Caption = {
    place: match?.label ?? "",
    date: meta.takenAt ? fmtDate(meta.takenAt) : "",
    coords: meta.gps ? fmtCoords(meta.gps.lat, meta.gps.lng) : "",
  };
  // Only a real capture time feeds the seed and the tone; a file's modification time is not a fact about the photo.
  const exifTime = meta.dateSource === "exif" ? meta.takenAt : null;
  const palette = samplePhotoPalette(img);
  const seed = variationSeed({
    sizeBytes: file.size,
    width: img.naturalWidth,
    height: img.naturalHeight,
    takenAtMs: exifTime ? wallClockMs(exifTime) : null,
    camera: meta.camera,
    cardId: cardId ?? undefined,
  });
  const variation = deriveVariation({
    seed,
    takenAt: exifTime,
    camera: meta.camera,
    number: null,
    placeKind: match?.kind ?? null,
    photoPalette: palette,
  });

  return { file, id: cardId, src, width: img.naturalWidth, height: img.naturalHeight, element: img, meta, match, lookupFailed, caption, palette, variation };
}
