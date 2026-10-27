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
  /** The capture time's UTC offset in minutes from EXIF OffsetTimeOriginal (or OffsetTimeDigitized for a CreateDate); null when absent. */
  utcOffsetMinutes: number | null;
}

/**
 * The capture time as a zone-free number, from the local getters, so the same photo seeds the same on every device.
 * Never use getTime() for this.
 */
export function wallClockMs(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
}

/** A capture date we are willing to print: a real Date between 1970 and two days from now. Unset camera clocks produce 1899. */
export function plausibleDate(value: unknown, now = Date.now()): Date | null {
  if (!(value instanceof Date)) return null;
  const t = value.getTime();
  if (Number.isNaN(t)) return null;
  if (value.getFullYear() < 1970 || t > now + 48 * 60 * 60 * 1000) return null;
  return value;
}

/** An EXIF offset string, "+09:00" or "-05:30", as minutes east of UTC; null for anything else. */
export function parseUtcOffset(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  if (minutes > 59 || hours * 60 + minutes > 14 * 60) return null;
  const total = hours * 60 + minutes;
  return m[1] === "-" ? -total : total;
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
  let utcOffsetMinutes: number | null = null;

  try {
    const out = await parse(input, { tiff: true, exif: true, pick: ["DateTimeOriginal", "CreateDate", "OffsetTimeOriginal", "OffsetTimeDigitized", "Make", "Model"] });
    const original = plausibleDate(out?.DateTimeOriginal);
    const d = original ?? plausibleDate(out?.CreateDate);
    if (d) {
      takenAt = d;
      dateSource = "exif";
      utcOffsetMinutes = parseUtcOffset(original ? out?.OffsetTimeOriginal : out?.OffsetTimeDigitized);
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

  return { takenAt, dateSource, gps, camera, utcOffsetMinutes };
}

/** The capture time for storage: `YYYY-MM-DD HH:MM:SS` from the local getters, no zone, so the day never shifts. */
export function wallClockString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
