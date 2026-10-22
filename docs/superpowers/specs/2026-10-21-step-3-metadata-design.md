# Step 3: the metadata pipeline on the Make screen

Oct 21, 2026. Design for build step 3 from SPEC.md: EXIF read, place resolution, editable caption. Taken before step 2 (variation) at Alex's request; the intro keeps its placeholder seed until step 2. SPEC.md's "Metadata pipeline" section is the product truth; this document fixes how it is built.

## Decisions taken

- **Offline tiers now, API tiers stubbed.** Landmark, city and no-match ship from the prototype's data (28 landmarks, 10,379 cities). Venue and neighborhood get a provider interface and a stub that answers null; wiring Mapbox or Google later is one implementation plus a key. Venues are first needed for directions in step 6.
- **The lookup runs on the server.** The phone sends lat and lng to our own `POST /api/place` route, which holds the data and answers with the match. The client bundle stays small, EXIF coordinates go to no third party, and the provider call will live where its key can stay secret.
- **Timezone rule.** An EXIF date is the wall-clock time where the photo was taken and carries no zone. exifr builds a `Date` from those components in the device's zone, and `fmtDate` reads it with local getters, so the card shows the capture date as the camera recorded it. Never convert to UTC. Goes into CLAUDE.md's conventions.

## Package `packages/places`

`@one-of-one/places`: pure TypeScript, no app imports, no DOM, consumed as source like the renderer.

### Data

- `data/landmarks.json`: 28 entries `{ name, region, lat, lng, radiusM }`.
- `data/cities.json`: 10,379 entries `[name, region, lat, lng]`, largest first, as in the prototype.
- `scripts/extract-prototype-data.mjs` reads `prototype/one-of-one.html` (the `const CITIES = [...]` line and the `LANDMARKS` block), parses them as JSON, and writes the two files. Run once; both files are committed. The prototype stays untouched. A unit test checks the counts (28 and 10,379) and that every entry has finite coordinates.

### Resolver

```ts
export type PlaceKind = "venue" | "landmark" | "neighborhood" | "city";
export interface PlaceMatch {
  kind: PlaceKind;
  name: string;        // "Golden Gate Bridge", "Seoul"
  region: string;      // "San Francisco", "South Korea"
  label: string;       // caption place line: `${name}, ${region}`
  key: string;         // stable id for numbering: `${kind}:${label}@${lat},${lng}` (104 city names repeat for distinct places)
  lat: number; lng: number;   // the place's own coordinates, not the photo's
  distanceM: number;   // photo to place
}
export interface PlaceProvider {
  venueNear(lat: number, lng: number, radiusM: number): Promise<PlaceMatch | null>;
  neighborhoodAt(lat: number, lng: number): Promise<PlaceMatch | null>;
}
export const noProvider: PlaceProvider;   // both answer null. A rejecting provider counts as no match.
export function distanceM(aLat, aLng, bLat, bLng): number;   // haversine, metres
export async function resolvePlace(lat: number, lng: number, provider = noProvider): Promise<PlaceMatch | null>;
```

`resolvePlace` runs the tiers in SPEC.md's order and stops at the first hit: venue within 75 m (provider), landmark within its own radius, neighborhood (provider), nearest city within 60 km, else null. The city label for US cities uses the state because the data's region already is the state ("San Francisco, California").

Unit tests with known coordinates: the Golden Gate Bridge resolves to the landmark; a street in Hongdae (37.5563, 126.9236) to "Seoul, South Korea"; a point 59 km from a city to that city; 61 km to null; mid-ocean to null; a provider stub that returns a venue wins over a landmark at the same point; `distanceM` against a known pair.

## EXIF reading: `apps/web/lib/exif.ts`

```ts
export interface PhotoMetadata {
  takenAt: Date | null;
  dateSource: "exif" | "file" | "none";
  gps: { lat: number; lng: number } | null;
}
export async function readPhotoMetadata(file: File | Blob, fileLastModified?: number): Promise<PhotoMetadata>;
```

Uses exifr 7.1.3: `DateTimeOriginal`, falling back to `CreateDate`, then the file's modification time (`dateSource: "file"`), else null (`"none"`). An EXIF date is used only if it is plausible (1970 to a day from now); unset camera clocks write 0000:00:00, which would otherwise print as 1899. GPS from `exifr.gps`, kept only when both numbers are finite. Never throws: any parse failure yields nulls. Unit tested in Node against the fixtures below.

Orientation: camera JPEGs often store portrait shots sideways with an EXIF Orientation tag. Browsers apply it by default to both the image element and canvas drawing, so both painters see the upright dimensions; the rotated fixture below keeps that verified. Nothing in the code reads the tag.

## The lookup route: `POST /api/place`

A Next route handler in `apps/web/app/api/place/route.ts`, taking a JSON body `{ lat, lng }`. Validates that both are finite numbers within range (lat −90..90, lng −180..180); 400 with `{ error }` otherwise. Calls `resolvePlace(lat, lng, noProvider)` and returns `{ match: PlaceMatch | null }`. Stores nothing, logs nothing. `Cache-Control: no-store`. A JSON body rather than a query string, so coordinates never appear in a URL or an access log.

## Make screen behavior

On pick, `readPhotoMetadata` runs alongside image decoding. Then:

- Date: `fmtDate(takenAt)` when present, else empty.
- Coordinates: `fmtCoords(gps)` when GPS is present, else empty.
- Place: with GPS, the screen calls `/api/place`; on a match the line fills with `label`; on null or a failed request it stays blank with its hint.
- The match (or null) is kept in state for step 5 and not shown.
- Every line stays editable, as today. The PNG is drawn from the committed caption, as today.

Status line, exact sentences:

| Situation | Status |
| --- | --- |
| GPS matched and EXIF date | "Read {landmark\|location} and date from the photo." ("landmark" for a landmark match, "location" otherwise) |
| GPS but no match, EXIF date | "Read the coordinates and date, but no named place is near. Tap the top line to name it." |
| No GPS, EXIF date | "No location in this photo's data. Phones usually strip it when a photo is uploaded from the web, and screenshots never have it. Tap the top line to type the place." |
| GPS, no EXIF date (file date used) | "Read the location. No capture date found, so the date is the file's. Tap it to change." |
| Neither GPS nor EXIF date | "No location or date in this photo's data. Tap the caption lines to type them." |
| GPS but the lookup request failed | "Couldn't look up the place. Tap the top line to type it." |

Precedence: a failed lookup wins whenever GPS is present, regardless of the date. Otherwise the row is chosen by the GPS and date facts alone. The current "The date is the file's…" sentence goes away; the no-GPS cases above replace it.

## Fixtures and tests

`e2e/fixtures/make-exif-fixtures.mjs` (committed, run by `npm run fixtures` after the PNG script) renders a 900 × 1200 flat-colour page with Chromium to JPEG and embeds EXIF with piexifjs:

- `apps/web/public/dev/seoul.jpg`: DateTimeOriginal 2026:07:01 14:30:00, GPS 37.5563 N, 126.9236 E. The card reads "Seoul, South Korea / July 1st, 2026 / 37.5563° N, 126.9236° E", the mockups' card.
- `apps/web/public/dev/nogps.jpg`: the same date, no GPS.
- `apps/web/public/dev/rotated.jpg`: a 1200 × 900 image with Orientation 6, so it displays as 900 × 1200 portrait; same EXIF as seoul.jpg.

Tests:

- Vitest, `packages/places`: data counts, resolver tiers, distance.
- Vitest, `apps/web`: `readPhotoMetadata` on the three fixtures and on the EXIF-less `portrait.png` (nulls, `dateSource: "file"` when a modification time is given).
- Playwright, `e2e/place.spec.ts`: the route answers the Golden Gate coordinates with the landmark, Hongdae with Seoul, mid-ocean with null, a bad query with 400.
- Playwright, `e2e/make.spec.ts`: the Seoul fixture fills all three lines and the status reads "Read location and date from the photo."; the no-GPS fixture leaves the place blank with its hint and the no-location status; the rotated fixture shows a 900-wide, 1200-tall photo and its PNG is 1000 × 1442; the existing PNG fixture still shows the no-location-or-date status with the date from the file.

## Out of scope

Venue and neighborhood providers (interface only), numbering, storage, the variation seed (step 2), HEIC display in Chrome (exifr reads its EXIF; Chrome cannot decode it for display; Safari can; the existing "can't be shown here" status covers it), RAW, and color management (the PNG is sRGB; Display P3 photos lose some gamut in print; step 7 with the vendor).
