import { gps as readGps, parse } from "exifr";

export type DateSource = "exif" | "file" | "none";

export interface PhotoMetadata {
  /**
   * EXIF dates are wall-clock at capture with no zone. exifr builds the Date
   * from those components in the device's zone, and fmtDate reads local
   * getters, so the card shows the date the camera recorded. Never convert to UTC.
   */
  takenAt: Date | null;
  dateSource: DateSource;
  gps: { lat: number; lng: number } | null;
  /** EXIF Make and Model, trimmed; null unless both are present. */
  camera: { make: string; model: string } | null;
}

/** A capture date we are willing to print: a real Date between 1970 and two days from now. Unset camera clocks produce 1899. */
export function plausibleDate(value: unknown, now = Date.now()): Date | null {
  if (!(value instanceof Date)) return null;
  const t = value.getTime();
  if (Number.isNaN(t)) return null;
  if (value.getFullYear() < 1970 || t > now + 48 * 60 * 60 * 1000) return null;
  return value;
}

/** A File or Blob in the browser, a Buffer or Uint8Array in Node. Never throws. */
export async function readPhotoMetadata(
  input: Blob | ArrayBuffer | Uint8Array,
  fileLastModified?: number,
): Promise<PhotoMetadata> {
  let takenAt: Date | null = null;
  let dateSource: DateSource = "none";
  let gps: PhotoMetadata["gps"] = null;
  let camera: PhotoMetadata["camera"] = null;

  try {
    const out = await parse(input, { tiff: true, exif: true, pick: ["DateTimeOriginal", "CreateDate", "Make", "Model"] });
    const d = plausibleDate(out?.DateTimeOriginal) ?? plausibleDate(out?.CreateDate);
    if (d) {
      takenAt = d;
      dateSource = "exif";
    }
    const make = typeof out?.Make === "string" ? out.Make.trim() : "";
    const model = typeof out?.Model === "string" ? out.Model.trim() : "";
    if (make && model) camera = { make, model };
  } catch {
    // No usable EXIF date or camera.
  }

  try {
    const g = await readGps(input);
    if (g && Number.isFinite(g.latitude) && Number.isFinite(g.longitude)) {
      gps = { lat: g.latitude, lng: g.longitude };
    }
  } catch {
    // No GPS.
  }

  if (!takenAt && fileLastModified !== undefined && Number.isFinite(fileLastModified) && fileLastModified > 0) {
    takenAt = new Date(fileLastModified);
    dateSource = "file";
  }

  return { takenAt, dateSource, gps, camera };
}
