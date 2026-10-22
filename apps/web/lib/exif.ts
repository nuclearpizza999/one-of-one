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
}

/** A File or Blob in the browser, a Buffer or Uint8Array in Node. Never throws. */
export async function readPhotoMetadata(
  input: Blob | ArrayBuffer | Uint8Array,
  fileLastModified?: number,
): Promise<PhotoMetadata> {
  let takenAt: Date | null = null;
  let dateSource: DateSource = "none";
  let gps: PhotoMetadata["gps"] = null;

  try {
    const out = await parse(input, { tiff: true, exif: true, pick: ["DateTimeOriginal", "CreateDate"] });
    const d: unknown = out?.DateTimeOriginal ?? out?.CreateDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
      takenAt = d;
      dateSource = "exif";
    }
  } catch {
    // No usable EXIF; the caption stays editable.
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

  return { takenAt, dateSource, gps };
}
