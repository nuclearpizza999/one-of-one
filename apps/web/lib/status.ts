import type { PlaceKind } from "@one-of-one/places";
import type { DateSource } from "./exif";

export interface StatusFacts {
  gps: boolean;
  dateSource: DateSource;
  match: PlaceKind | null;
  lookupFailed: boolean;
}

/** The Make screen's status line after a photo is read. Plain words, never a modal. */
export function statusFor({ gps, dateSource, match, lookupFailed }: StatusFacts): string {
  if (gps && lookupFailed) return "Couldn't look up the place. Tap the top line to type it.";
  const exifDate = dateSource === "exif";
  if (gps && exifDate && match) {
    return `Read ${match === "landmark" ? "landmark" : "location"} and date from the photo.`;
  }
  if (gps && exifDate) {
    return "Read the coordinates and date, but no named place is near. Tap the top line to name it.";
  }
  if (!gps && exifDate) {
    return "No location in this photo's data. Phones usually strip it when a photo is uploaded from the web, and screenshots never have it. Tap the top line to type the place.";
  }
  if (gps) return "Read the location. No capture date found, so the date is the file's. Tap it to change.";
  return "No location or date in this photo's data. Tap the caption lines to type them.";
}
