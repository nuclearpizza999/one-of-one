# Step 3 Metadata Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Make screen reads the photo's EXIF date and GPS, resolves the place against the prototype's landmarks and cities through our own server route, fills the three caption lines, and explains in the status line what it read or could not read.

**Architecture:** A second standalone package, `packages/places`, holds the data (extracted from the prototype into JSON) and a pure `resolvePlace()` that runs SPEC.md's five tiers with a `PlaceProvider` interface for the two API tiers (stubbed). The app gains `lib/exif.ts` (exifr in the browser and in Node tests), `lib/status.ts` (the status sentence as a pure function), a `GET /api/place` route handler, and Make screen wiring. Three EXIF-bearing JPEG fixtures are generated with Chromium plus piexifjs and committed.

**Tech Stack:** exifr 7.1.3, piexifjs 1.0.6 (fixtures only), Vitest 5 (now in `apps/web` too), Playwright 1.64, Next.js 16 route handlers.

Spec: `docs/superpowers/specs/2026-10-21-step-3-metadata-design.md`. Product rules: `CLAUDE.md`, `SPEC.md` ("Metadata pipeline", "Privacy rules"). Prototype data source: `prototype/one-of-one.html` (line 171 is `const CITIES = [...]`, a single 397 KB line; `LANDMARKS` is the block at lines 173 to 203). Never read that file whole; the extraction script reads it line by line.

## Global Constraints

- Place resolution runs top-down and stops at the first hit: venue within 75 m (provider), landmark within its own radius, neighborhood (provider), nearest city within 60 km, else null. Labels are `${name}, ${region}` ("Golden Gate Bridge, San Francisco", "Seoul, South Korea", "San Francisco, California"). The key for step 5's numbering is `${kind}:${label}`.
- Caption formats: `fmtDate` ("July 1st, 2026"), `fmtCoords` ("37.5563° N, 126.9236° E"), both already in `@one-of-one/card`.
- Timezone rule: an EXIF date is wall-clock at capture with no zone; exifr builds a `Date` from its components in the device's zone and `fmtDate` reads local getters. Never convert to UTC.
- Date source order: EXIF `DateTimeOriginal`, then `CreateDate`, then the file's modification time (`dateSource: "file"`), else none.
- The lookup route validates lat −90..90 and lng −180..180 as finite numbers, answers `{ match }` with `Cache-Control: no-store`, 400 with `{ error }` otherwise, stores and logs nothing. EXIF coordinates go only to our own server.
- Status sentences, exact (the table in the spec); a failed lookup wins whenever GPS is present.
- Fixtures: `seoul.jpg` 900 × 1200 with DateTimeOriginal `2026:07:01 14:30:00` and GPS 37.5563 N, 126.9236 E; `nogps.jpg` same date, no GPS; `rotated.jpg` stored 1200 × 900 with Orientation 6 and the Seoul EXIF, displayed 900 × 1200.
- Both packages ship TypeScript source, no app imports, consumed through `transpilePackages`.
- Commit after every task with the message shown. All commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Every test file is written first and run to fail before its implementation.

## File structure

```
packages/places/package.json               @one-of-one/places; exports ./src/index.ts
packages/places/tsconfig.json
packages/places/vitest.config.ts
packages/places/scripts/extract-prototype-data.mjs   reads the prototype, writes the two JSON files
packages/places/data/landmarks.json        28 entries {name, region, lat, lng, radiusM}
packages/places/data/cities.json           10,379 entries [name, region, lat, lng]
packages/places/src/data.ts                typed access to the JSON
packages/places/src/geo.ts                 distanceM (haversine)
packages/places/src/resolve.ts             PlaceMatch, PlaceProvider, noProvider, resolvePlace
packages/places/src/index.ts               re-exports
packages/places/test/data.test.ts, geo.test.ts, resolve.test.ts
e2e/fixtures/make-exif-fixtures.mjs        writes seoul.jpg, nogps.jpg, rotated.jpg with piexifjs
apps/web/public/dev/{seoul,nogps,rotated}.jpg
apps/web/vitest.config.ts                  Vitest for apps/web/lib
apps/web/lib/exif.ts + exif.test.ts        readPhotoMetadata
apps/web/lib/status.ts + status.test.ts    statusFor (the status sentence)
apps/web/app/api/place/route.ts            GET /api/place
apps/web/app/make/MakeScreen.tsx           wiring (modified)
e2e/place.spec.ts                          route tests
e2e/make.spec.ts                           updated and extended
CLAUDE.md, README.md                       timezone convention, places package, fixtures script
```

---

### Task 1: The places package and its data

**Files:**
- Create: `packages/places/package.json`, `packages/places/tsconfig.json`, `packages/places/vitest.config.ts`
- Create: `packages/places/scripts/extract-prototype-data.mjs`
- Create: `packages/places/data/landmarks.json`, `packages/places/data/cities.json` (generated, committed)
- Create: `packages/places/src/data.ts`, `packages/places/src/index.ts`
- Test: `packages/places/test/data.test.ts`

**Interfaces:**
- Produces: `interface Landmark { name: string; region: string; lat: number; lng: number; radiusM: number }`, `type City = readonly [name: string, region: string, lat: number, lng: number]`, `LANDMARKS: readonly Landmark[]`, `CITIES: readonly City[]`, exported from `@one-of-one/places`.

- [ ] **Step 1: Create the package skeleton**

`packages/places/package.json`:

```json
{
  "name": "@one-of-one/places",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json",
    "extract": "node scripts/extract-prototype-data.mjs"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vitest": "^5.0.5"
  }
}
```

`packages/places/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test", "data", "vitest.config.ts"]
}
```

`packages/places/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
```

Run: `npm install`
Expected: links the new workspace; no peer errors.

- [ ] **Step 2: Write the failing data tests**

`packages/places/test/data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CITIES, LANDMARKS } from "../src/data";

describe("landmarks", () => {
  it("has the prototype's 28 landmarks with finite coordinates and sane radii", () => {
    expect(LANDMARKS).toHaveLength(28);
    for (const l of LANDMARKS) {
      expect(Number.isFinite(l.lat)).toBe(true);
      expect(Number.isFinite(l.lng)).toBe(true);
      expect(l.radiusM).toBeGreaterThanOrEqual(250);
      expect(l.radiusM).toBeLessThanOrEqual(1500);
      expect(l.name.length).toBeGreaterThan(0);
      expect(l.region.length).toBeGreaterThan(0);
    }
  });
  it("starts with the Golden Gate Bridge and ends with Petra", () => {
    expect(LANDMARKS[0]).toEqual({ name: "Golden Gate Bridge", region: "San Francisco", lat: 37.8199, lng: -122.4783, radiusM: 1500 });
    expect(LANDMARKS[27]).toEqual({ name: "Petra", region: "Jordan", lat: 30.3285, lng: 35.4444, radiusM: 1500 });
  });
});

describe("cities", () => {
  it("has the prototype's 10,379 cities with finite coordinates, largest first", () => {
    expect(CITIES).toHaveLength(10379);
    for (const [name, region, lat, lng] of CITIES) {
      expect(name.length).toBeGreaterThan(0);
      expect(typeof region).toBe("string");
      expect(Number.isFinite(lat)).toBe(true);
      expect(Number.isFinite(lng)).toBe(true);
    }
    expect(CITIES[0]).toEqual(["Shanghai", "China", 31.222, 121.458]);
  });
  it("carries US cities with their state as the region", () => {
    expect(CITIES.find(([name, region]) => name === "San Francisco" && region === "California")).toBeDefined();
    expect(CITIES.find(([name, region]) => name === "Seoul" && region === "South Korea")).toBeDefined();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -w packages/places -- data`
Expected: FAIL, "Failed to resolve import "../src/data"".

- [ ] **Step 4: Write the extraction script and run it**

`packages/places/scripts/extract-prototype-data.mjs`:

```js
// Extracts LANDMARKS and CITIES from prototype/one-of-one.html into JSON.
// Reads the file line by line: line 171 is a single 397 KB line and must not be
// pasted anywhere. Run from the repo root: npm run extract -w packages/places
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const proto = readFileSync(path.join(root, "prototype/one-of-one.html"), "utf8").split("\n");
const outDir = path.resolve(import.meta.dirname, "../data");
mkdirSync(outDir, { recursive: true });

// CITIES: `const CITIES = [[...],...];   // comment`
const cityLine = proto.find((l) => l.startsWith("const CITIES = "));
if (!cityLine) throw new Error("CITIES line not found");
const cityJson = cityLine.replace(/^const CITIES = /, "").replace(/;\s*\/\/.*$/, "").replace(/;\s*$/, "");
const cities = JSON.parse(cityJson);
if (!Array.isArray(cities) || cities.length < 10000) throw new Error(`unexpected city count ${cities.length}`);

// LANDMARKS: the block between `const LANDMARKS = [` and the next `];`
const start = proto.findIndex((l) => l.startsWith("const LANDMARKS = ["));
if (start < 0) throw new Error("LANDMARKS block not found");
const landmarks = [];
for (let i = start + 1; i < proto.length; i += 1) {
  const line = proto[i].trim();
  if (line === "];") break;
  if (!line.startsWith("[")) continue;
  const [name, region, lat, lng, radiusM] = JSON.parse(line.replace(/,\s*$/, ""));
  landmarks.push({ name, region, lat, lng, radiusM });
}
if (landmarks.length !== 28) throw new Error(`unexpected landmark count ${landmarks.length}`);

writeFileSync(path.join(outDir, "cities.json"), JSON.stringify(cities));
writeFileSync(path.join(outDir, "landmarks.json"), JSON.stringify(landmarks, null, 2) + "\n");
console.log(`cities.json ${cities.length} entries, landmarks.json ${landmarks.length} entries`);
```

Run: `npm run extract -w packages/places`
Expected output: `cities.json 10379 entries, landmarks.json 28 entries`. `ls -la packages/places/data` shows `cities.json` about 400 KB and `landmarks.json` about 3 KB.

- [ ] **Step 5: Write data.ts and index.ts**

`packages/places/src/data.ts`:

```ts
import landmarksJson from "../data/landmarks.json";
import citiesJson from "../data/cities.json";

export interface Landmark {
  name: string;
  region: string;
  lat: number;
  lng: number;
  /** Match radius: a photo within it is "at" the landmark. */
  radiusM: number;
}

/** [name, region, lat, lng]; region is the country, or the state for US cities. Largest first. */
export type City = readonly [name: string, region: string, lat: number, lng: number];

export const LANDMARKS: readonly Landmark[] = landmarksJson as Landmark[];
export const CITIES: readonly City[] = citiesJson as unknown as City[];
```

`packages/places/src/index.ts`:

```ts
export { CITIES, LANDMARKS } from "./data";
export type { City, Landmark } from "./data";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w packages/places -- data`
Expected: PASS, 4 tests.

Run: `npm run typecheck -w packages/places`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add package-lock.json packages/places
git commit -m "Add the places package with landmark and city data extracted from the prototype

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Distance and the resolver

**Files:**
- Create: `packages/places/src/geo.ts`, `packages/places/src/resolve.ts`
- Modify: `packages/places/src/index.ts`
- Test: `packages/places/test/geo.test.ts`, `packages/places/test/resolve.test.ts`

**Interfaces:**
- Consumes: `LANDMARKS`, `CITIES`, `Landmark`, `City` (Task 1).
- Produces:
  ```ts
  export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number;
  export type PlaceKind = "venue" | "landmark" | "neighborhood" | "city";
  export interface PlaceMatch { kind: PlaceKind; name: string; region: string; label: string; key: string; lat: number; lng: number; distanceM: number }
  export interface PlaceProvider { venueNear(lat: number, lng: number, radiusM: number): Promise<PlaceMatch | null>; neighborhoodAt(lat: number, lng: number): Promise<PlaceMatch | null> }
  export const noProvider: PlaceProvider;
  export interface PlaceData { landmarks: readonly Landmark[]; cities: readonly City[] }
  export const VENUE_RADIUS_M = 75;
  export const CITY_RADIUS_M = 60_000;
  export function placeLabel(name: string, region: string): string;   // `${name}, ${region}`
  export async function resolvePlace(lat: number, lng: number, provider?: PlaceProvider, data?: PlaceData): Promise<PlaceMatch | null>;
  ```

- [ ] **Step 1: Write the failing geo test**

`packages/places/test/geo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { distanceM } from "../src/geo";

describe("distanceM", () => {
  it("is zero for the same point", () => {
    expect(distanceM(37.5563, 126.9236, 37.5563, 126.9236)).toBe(0);
  });
  it("matches a known pair within a metre per kilometre", () => {
    // Golden Gate Bridge to the Eiffel Tower, 8,949 km by haversine on a 6,371 km sphere.
    const d = distanceM(37.8199, -122.4783, 48.8584, 2.2945);
    expect(d).toBeGreaterThan(8_940_000);
    expect(d).toBeLessThan(8_970_000);
  });
  it("is about 111.2 km per degree of latitude", () => {
    expect(distanceM(0, 0, 1, 0)).toBeCloseTo(111_195, -2);
  });
  it("is symmetric", () => {
    expect(distanceM(10, 20, 30, 40)).toBeCloseTo(distanceM(30, 40, 10, 20), 6);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w packages/places -- geo`
Expected: FAIL, "Failed to resolve import "../src/geo"".

- [ ] **Step 3: Implement geo.ts**

`packages/places/src/geo.ts`:

```ts
const EARTH_RADIUS_M = 6_371_000;
const toRad = Math.PI / 180;

/** Great-circle distance in metres (haversine). */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}
```

- [ ] **Step 4: Run the geo test to verify it passes**

Run: `npm test -w packages/places -- geo`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing resolver tests**

`packages/places/test/resolve.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { City, Landmark } from "../src/data";
import {
  CITY_RADIUS_M,
  type PlaceData,
  type PlaceMatch,
  type PlaceProvider,
  VENUE_RADIUS_M,
  noProvider,
  placeLabel,
  resolvePlace,
} from "../src/resolve";

// A tiny world: one landmark at the origin with a 500 m radius, one city 10 km east.
const tiny: PlaceData = {
  landmarks: [{ name: "Obelisk", region: "Nowhere", lat: 0, lng: 0, radiusM: 500 } satisfies Landmark],
  cities: [["Eastville", "Nowhere", 0, 0.09] satisfies City],
};
const KM_PER_DEG_LAT = 111.195;

function stub(venue: PlaceMatch | null, neighborhood: PlaceMatch | null): PlaceProvider {
  return {
    venueNear: async () => venue,
    neighborhoodAt: async () => neighborhood,
  };
}
const venue: PlaceMatch = {
  kind: "venue", name: "Zuni Café", region: "San Francisco", label: "Zuni Café, San Francisco",
  key: "venue:Zuni Café, San Francisco", lat: 0, lng: 0, distanceM: 20,
};
const hood: PlaceMatch = {
  kind: "neighborhood", name: "Hongdae", region: "Seoul", label: "Hongdae, Seoul",
  key: "neighborhood:Hongdae, Seoul", lat: 0, lng: 0, distanceM: 0,
};

describe("placeLabel", () => {
  it("joins name and region with a comma", () => {
    expect(placeLabel("Seoul", "South Korea")).toBe("Seoul, South Korea");
  });
});

describe("resolvePlace with real data", () => {
  it("finds the Golden Gate Bridge from a point on it", async () => {
    const m = await resolvePlace(37.8199, -122.4783);
    expect(m).toMatchObject({ kind: "landmark", label: "Golden Gate Bridge, San Francisco", key: "landmark:Golden Gate Bridge, San Francisco" });
    expect(m!.distanceM).toBeLessThan(5);
  });
  it("finds Seoul from a street in Hongdae", async () => {
    const m = await resolvePlace(37.5563, 126.9236);
    expect(m).toMatchObject({ kind: "city", name: "Seoul", region: "South Korea", label: "Seoul, South Korea", key: "city:Seoul, South Korea" });
    expect(m!.lat).toBeCloseTo(37.5, 0);
  });
  it("gives the state for a US city", async () => {
    const m = await resolvePlace(37.7749, -122.4194);
    expect(m).toMatchObject({ kind: "city", label: "San Francisco, California" });
  });
  it("finds nothing in the middle of the Pacific", async () => {
    expect(await resolvePlace(0, -140)).toBeNull();
  });
});

describe("resolvePlace tiers with a tiny world", () => {
  it("prefers a landmark inside its radius", async () => {
    const m = await resolvePlace(0.002, 0, noProvider, tiny);
    expect(m).toMatchObject({ kind: "landmark", label: "Obelisk, Nowhere" });
    expect(m!.distanceM).toBeCloseTo(222, -1);
  });
  it("falls to the city just outside the landmark radius", async () => {
    const m = await resolvePlace(0.006, 0, noProvider, tiny);
    expect(m).toMatchObject({ kind: "city", label: "Eastville, Nowhere", lat: 0, lng: 0.09 });
  });
  it("accepts a city 59 km away and rejects one 61 km away", async () => {
    const near = await resolvePlace(59 / KM_PER_DEG_LAT, 0.09, noProvider, tiny);
    expect(near).toMatchObject({ kind: "city", name: "Eastville" });
    expect(near!.distanceM).toBeLessThan(CITY_RADIUS_M);
    const far = await resolvePlace(61 / KM_PER_DEG_LAT, 0.09, noProvider, tiny);
    expect(far).toBeNull();
  });
  it("lets a venue from the provider win over a landmark at the same point", async () => {
    const m = await resolvePlace(0, 0, stub(venue, null), tiny);
    expect(m).toBe(venue);
  });
  it("asks the provider for a venue within 75 m", async () => {
    let asked: number | null = null;
    const p: PlaceProvider = { venueNear: async (_a, _b, r) => { asked = r; return null; }, neighborhoodAt: async () => null };
    await resolvePlace(0, 0, p, tiny);
    expect(asked).toBe(VENUE_RADIUS_M);
  });
  it("lets a neighborhood win over the city when no landmark matches", async () => {
    const m = await resolvePlace(0.006, 0, stub(null, hood), tiny);
    expect(m).toBe(hood);
  });
  it("does not ask for a neighborhood when a landmark already matched", async () => {
    let askedHood = false;
    const p: PlaceProvider = { venueNear: async () => null, neighborhoodAt: async () => { askedHood = true; return hood; } };
    const m = await resolvePlace(0.001, 0, p, tiny);
    expect(m!.kind).toBe("landmark");
    expect(askedHood).toBe(false);
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npm test -w packages/places -- resolve`
Expected: FAIL, "Failed to resolve import "../src/resolve"".

- [ ] **Step 7: Implement resolve.ts**

`packages/places/src/resolve.ts`:

```ts
import { CITIES, LANDMARKS, type City, type Landmark } from "./data";
import { distanceM } from "./geo";

export type PlaceKind = "venue" | "landmark" | "neighborhood" | "city";

export interface PlaceMatch {
  kind: PlaceKind;
  name: string;
  region: string;
  /** The caption's place line. */
  label: string;
  /** Stable id for numbering: `${kind}:${label}`. */
  key: string;
  /** The place's own coordinates, never the photo's. */
  lat: number;
  lng: number;
  /** Photo to place, in metres. */
  distanceM: number;
}

/** The two tiers that need a places or geocoding API. Step 3 ships only the stub. */
export interface PlaceProvider {
  venueNear(lat: number, lng: number, radiusM: number): Promise<PlaceMatch | null>;
  neighborhoodAt(lat: number, lng: number): Promise<PlaceMatch | null>;
}

export const noProvider: PlaceProvider = {
  venueNear: async () => null,
  neighborhoodAt: async () => null,
};

export interface PlaceData {
  landmarks: readonly Landmark[];
  cities: readonly City[];
}

const DEFAULT_DATA: PlaceData = { landmarks: LANDMARKS, cities: CITIES };

export const VENUE_RADIUS_M = 75;
export const CITY_RADIUS_M = 60_000;

export function placeLabel(name: string, region: string): string {
  return `${name}, ${region}`;
}

function match(kind: PlaceKind, name: string, region: string, lat: number, lng: number, d: number): PlaceMatch {
  const label = placeLabel(name, region);
  return { kind, name, region, label, key: `${kind}:${label}`, lat, lng, distanceM: d };
}

/**
 * SPEC.md's place hierarchy, top-down, first hit wins:
 * venue (provider, 75 m) → landmark (own radius) → neighborhood (provider) → city (60 km) → null.
 */
export async function resolvePlace(
  lat: number,
  lng: number,
  provider: PlaceProvider = noProvider,
  data: PlaceData = DEFAULT_DATA,
): Promise<PlaceMatch | null> {
  const venue = await provider.venueNear(lat, lng, VENUE_RADIUS_M);
  if (venue) return venue;

  for (const l of data.landmarks) {
    const d = distanceM(lat, lng, l.lat, l.lng);
    if (d <= l.radiusM) return match("landmark", l.name, l.region, l.lat, l.lng, d);
  }

  const hood = await provider.neighborhoodAt(lat, lng);
  if (hood) return hood;

  let best: City | null = null;
  let bestD = Infinity;
  for (const c of data.cities) {
    const d = distanceM(lat, lng, c[2], c[3]);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best && bestD <= CITY_RADIUS_M) return match("city", best[0], best[1], best[2], best[3], bestD);
  return null;
}
```

Replace `packages/places/src/index.ts` with:

```ts
export { CITIES, LANDMARKS } from "./data";
export type { City, Landmark } from "./data";
export { distanceM } from "./geo";
export {
  CITY_RADIUS_M,
  VENUE_RADIUS_M,
  noProvider,
  placeLabel,
  resolvePlace,
} from "./resolve";
export type { PlaceData, PlaceKind, PlaceMatch, PlaceProvider } from "./resolve";
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -w packages/places`
Expected: PASS, three files, 20 tests (4 data, 4 geo, 12 resolve). If "finds Seoul from a street in Hongdae" fails because a nearer city in the list wins (Incheon or Goyang are within 60 km), report the actual label; the spec's expected card says Seoul, so the data or the test, not the resolver, is what to look at.

Run: `npm run typecheck -w packages/places`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add packages/places/src packages/places/test
git commit -m "Add distanceM and resolvePlace with the provider interface for API tiers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: EXIF fixtures and `readPhotoMetadata`

**Files:**
- Create: `e2e/fixtures/make-exif-fixtures.mjs`, `apps/web/public/dev/seoul.jpg`, `apps/web/public/dev/nogps.jpg`, `apps/web/public/dev/rotated.jpg` (generated, committed)
- Modify: `package.json` (root: `piexifjs` devDependency, `fixtures` script), `apps/web/package.json` (`exifr` dependency, `vitest` devDependency, `test` script)
- Create: `apps/web/vitest.config.ts`, `apps/web/lib/exif.ts`
- Test: `apps/web/lib/exif.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DateSource = "exif" | "file" | "none";
  export interface PhotoMetadata { takenAt: Date | null; dateSource: DateSource; gps: { lat: number; lng: number } | null }
  export async function readPhotoMetadata(input: Blob | ArrayBuffer | Uint8Array, fileLastModified?: number): Promise<PhotoMetadata>;
  ```
  Fixtures at `/dev/seoul.jpg`, `/dev/nogps.jpg`, `/dev/rotated.jpg` with the EXIF in the Global Constraints.

- [ ] **Step 1: Add the dependencies and scripts**

In the root `package.json`, add `"piexifjs": "^1.0.6"` to `devDependencies` and change the `fixtures` script to:

```json
"fixtures": "node e2e/fixtures/make-fixtures.mjs && node e2e/fixtures/make-exif-fixtures.mjs"
```

In `apps/web/package.json`, add `"exifr": "^7.1.3"` to `dependencies`, `"vitest": "^5.0.5"` to `devDependencies`, and the script `"test": "vitest run"`.

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
```

Run: `npm install`
Expected: adds exifr, piexifjs and vitest for apps/web; no peer errors.

- [ ] **Step 2: Write the fixture script and run it**

`e2e/fixtures/make-exif-fixtures.mjs`:

```js
// Writes three JPEG fixtures with real EXIF for the metadata tests: flat colour
// with a white diagonal rendered by Chromium, then EXIF embedded with piexifjs.
// Run from the repo root: npm run fixtures
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import piexif from "piexifjs";

const out = path.resolve("apps/web/public/dev");
mkdirSync(out, { recursive: true });

// EXIF dates are wall-clock at capture with no zone.
const DATE = "2026:07:01 14:30:00";
const SEOUL = { lat: 37.5563, lng: 126.9236 };

function gpsIfd({ lat, lng }) {
  return {
    [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? "N" : "S",
    [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(Math.abs(lat)),
    [piexif.GPSIFD.GPSLongitudeRef]: lng >= 0 ? "E" : "W",
    [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(Math.abs(lng)),
  };
}

async function renderJpeg(page, w, h, rgb) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<html><body style="margin:0;background:rgb(${rgb.join(",")})">` +
      `<svg width="${w}" height="${h}" style="display:block"><line x1="0" y1="0" x2="${w}" y2="${h}" stroke="#fff" stroke-width="12"/></svg>` +
      `</body></html>`,
  );
  return page.screenshot({ type: "jpeg", quality: 90 });
}

function withExif(jpegBuffer, { orientation, date, gps }) {
  const exif = { "0th": {}, Exif: {} };
  if (orientation) exif["0th"][piexif.ImageIFD.Orientation] = orientation;
  if (date) exif.Exif[piexif.ExifIFD.DateTimeOriginal] = date;
  if (gps) exif.GPS = gpsIfd(gps);
  const bytes = piexif.dump(exif);
  return Buffer.from(piexif.insert(bytes, jpegBuffer.toString("binary")), "binary");
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const fixtures = [
  { name: "seoul", w: 900, h: 1200, rgb: [96, 120, 160], exif: { date: DATE, gps: SEOUL } },
  { name: "nogps", w: 900, h: 1200, rgb: [160, 110, 110], exif: { date: DATE } },
  // Stored landscape with Orientation 6 (rotate 90° clockwise to display): shows as 900 × 1200 portrait.
  { name: "rotated", w: 1200, h: 900, rgb: [110, 150, 110], exif: { date: DATE, gps: SEOUL, orientation: 6 } },
];
for (const f of fixtures) {
  const jpeg = await renderJpeg(page, f.w, f.h, f.rgb);
  writeFileSync(path.join(out, `${f.name}.jpg`), withExif(jpeg, f.exif));
  console.log(`${f.name}.jpg ${f.w}x${f.h}${f.exif.orientation ? ` orientation ${f.exif.orientation}` : ""}`);
}
await browser.close();
```

Run: `npm run fixtures`
Expected output ends with:

```
seoul.jpg 900x1200
nogps.jpg 900x1200
rotated.jpg 1200x900 orientation 6
```

`ls -la apps/web/public/dev` shows the three JPEGs (each well under 100 KB) beside the three PNGs.

- [ ] **Step 3: Write the failing exif tests**

`apps/web/lib/exif.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readPhotoMetadata } from "./exif";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../public/dev/${name}`, import.meta.url)));

describe("readPhotoMetadata", () => {
  it("reads the capture date and GPS from seoul.jpg", async () => {
    const m = await readPhotoMetadata(fixture("seoul.jpg"));
    expect(m.dateSource).toBe("exif");
    expect(m.takenAt?.getFullYear()).toBe(2026);
    expect(m.takenAt?.getMonth()).toBe(6);
    expect(m.takenAt?.getDate()).toBe(1);
    expect(m.takenAt?.getHours()).toBe(14);
    expect(m.gps?.lat).toBeCloseTo(37.5563, 3);
    expect(m.gps?.lng).toBeCloseTo(126.9236, 3);
  });

  it("reads the date but no GPS from nogps.jpg", async () => {
    const m = await readPhotoMetadata(fixture("nogps.jpg"));
    expect(m.dateSource).toBe("exif");
    expect(m.takenAt?.getDate()).toBe(1);
    expect(m.gps).toBeNull();
  });

  it("ignores orientation and reads rotated.jpg like seoul.jpg", async () => {
    const m = await readPhotoMetadata(fixture("rotated.jpg"));
    expect(m.dateSource).toBe("exif");
    expect(m.gps?.lat).toBeCloseTo(37.5563, 3);
  });

  it("returns nulls for a PNG with no EXIF", async () => {
    const m = await readPhotoMetadata(fixture("portrait.png"));
    expect(m).toEqual({ takenAt: null, dateSource: "none", gps: null });
  });

  it("falls back to the file's modification time when there is no EXIF date", async () => {
    const stamp = Date.UTC(2024, 11, 23, 12, 0, 0);
    const m = await readPhotoMetadata(fixture("portrait.png"), stamp);
    expect(m.dateSource).toBe("file");
    expect(m.takenAt?.getTime()).toBe(stamp);
    expect(m.gps).toBeNull();
  });

  it("prefers the EXIF date over the file time", async () => {
    const m = await readPhotoMetadata(fixture("nogps.jpg"), Date.UTC(2024, 0, 1));
    expect(m.dateSource).toBe("exif");
    expect(m.takenAt?.getFullYear()).toBe(2026);
  });

  it("never throws on garbage", async () => {
    const m = await readPhotoMetadata(new Uint8Array([1, 2, 3, 4]));
    expect(m).toEqual({ takenAt: null, dateSource: "none", gps: null });
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `npm test -w apps/web -- exif`
Expected: FAIL, "Failed to resolve import "./exif"".

- [ ] **Step 5: Implement exif.ts**

`apps/web/lib/exif.ts`:

```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w apps/web -- exif`
Expected: PASS, 7 tests. If `getHours()` is not 14, the EXIF date was converted through UTC somewhere; that breaks the timezone rule and must be reported, not adjusted in the test.

Run: `npm run lint && npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json apps/web/package.json apps/web/vitest.config.ts apps/web/lib/exif.ts apps/web/lib/exif.test.ts e2e/fixtures/make-exif-fixtures.mjs apps/web/public/dev/seoul.jpg apps/web/public/dev/nogps.jpg apps/web/public/dev/rotated.jpg
git commit -m "Add EXIF reading with exifr and three EXIF-bearing JPEG fixtures

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The lookup route

**Files:**
- Create: `apps/web/app/api/place/route.ts`
- Modify: `apps/web/package.json` (`@one-of-one/places` dependency), `apps/web/next.config.ts` (`transpilePackages`)
- Test: `e2e/place.spec.ts`

**Interfaces:**
- Consumes: `resolvePlace`, `noProvider` (Task 2).
- Produces: `GET /api/place?lat=<n>&lng=<n>` → `200 { match: PlaceMatch | null }` with `Cache-Control: no-store`; `400 { error: string }` for a missing, non-numeric or out-of-range value.

- [ ] **Step 1: Write the failing route tests**

`e2e/place.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("the Golden Gate Bridge resolves to the landmark", async ({ request }) => {
  const r = await request.get("/api/place?lat=37.8199&lng=-122.4783");
  expect(r.status()).toBe(200);
  expect(r.headers()["cache-control"]).toBe("no-store");
  const { match } = await r.json();
  expect(match).toMatchObject({ kind: "landmark", label: "Golden Gate Bridge, San Francisco", key: "landmark:Golden Gate Bridge, San Francisco" });
});

test("a street in Hongdae resolves to Seoul", async ({ request }) => {
  const r = await request.get("/api/place?lat=37.5563&lng=126.9236");
  expect(r.status()).toBe(200);
  const { match } = await r.json();
  expect(match).toMatchObject({ kind: "city", label: "Seoul, South Korea" });
});

test("the middle of the Pacific resolves to nothing", async ({ request }) => {
  const r = await request.get("/api/place?lat=0&lng=-140");
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ match: null });
});

for (const query of ["lat=abc&lng=0", "lat=91&lng=0", "lat=0&lng=181", "lat=0", "", "lat=&lng=0"]) {
  test(`rejects "${query}" with 400`, async ({ request }) => {
    const r = await request.get(`/api/place?${query}`);
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(typeof body.error).toBe("string");
    expect(r.headers()["cache-control"]).toBe("no-store");
  });
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx playwright test place`
Expected: FAIL, every case gets a 404 from the dev server.

- [ ] **Step 3: Wire the package into the app and write the route**

In `apps/web/package.json`, add `"@one-of-one/places": "*"` to `dependencies`. In `apps/web/next.config.ts`, change `transpilePackages` to `["@one-of-one/card", "@one-of-one/places"]`. Run `npm install` to link the workspace.

`apps/web/app/api/place/route.ts`:

```ts
import { noProvider, resolvePlace } from "@one-of-one/places";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function coordinate(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/**
 * Resolves a photo's coordinates to a place. Stores nothing, logs nothing:
 * the coordinates are the owner's and go no further than this process.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const lat = coordinate(searchParams.get("lat"), -90, 90);
  const lng = coordinate(searchParams.get("lng"), -180, 180);
  if (lat === null || lng === null) {
    return NextResponse.json(
      { error: "lat and lng must be numbers within range" },
      { status: 400, headers: NO_STORE },
    );
  }
  const match = await resolvePlace(lat, lng, noProvider);
  return NextResponse.json({ match }, { headers: NO_STORE });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test place`
Expected: PASS, 9 tests.

Run: `npm run lint && npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/next.config.ts apps/web/app/api/place/route.ts e2e/place.spec.ts
git commit -m "Add GET /api/place, the server-side place lookup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The Make screen reads the photo

**Files:**
- Create: `apps/web/lib/status.ts`
- Modify: `apps/web/app/make/MakeScreen.tsx`, `e2e/make.spec.ts`, `CLAUDE.md`, `README.md`
- Test: `apps/web/lib/status.test.ts`, `e2e/make.spec.ts`

**Interfaces:**
- Consumes: `readPhotoMetadata` (Task 3), `GET /api/place` (Task 4), `fmtCoords`, `fmtDate` from `@one-of-one/card`, `type PlaceMatch`, `type PlaceKind` from `@one-of-one/places` (type-only import; the data must never reach the client bundle).
- Produces:
  ```ts
  export interface StatusFacts { gps: boolean; dateSource: "exif" | "file" | "none"; match: PlaceKind | null; lookupFailed: boolean }
  export function statusFor(facts: StatusFacts): string;
  ```

- [ ] **Step 1: Write the failing status tests**

`apps/web/lib/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { statusFor } from "./status";

describe("statusFor", () => {
  it("names a landmark when one matched", () => {
    expect(statusFor({ gps: true, dateSource: "exif", match: "landmark", lookupFailed: false }))
      .toBe("Read landmark and date from the photo.");
  });
  it("says location for a city, neighborhood or venue match", () => {
    for (const match of ["city", "neighborhood", "venue"] as const) {
      expect(statusFor({ gps: true, dateSource: "exif", match, lookupFailed: false }))
        .toBe("Read location and date from the photo.");
    }
  });
  it("asks for a name when GPS matched nothing", () => {
    expect(statusFor({ gps: true, dateSource: "exif", match: null, lookupFailed: false }))
      .toBe("Read the coordinates and date, but no named place is near. Tap the top line to name it.");
  });
  it("explains a missing location", () => {
    expect(statusFor({ gps: false, dateSource: "exif", match: null, lookupFailed: false }))
      .toBe("No location in this photo's data. Phones usually strip it when a photo is uploaded from the web, and screenshots never have it. Tap the top line to type the place.");
  });
  it("explains a missing date when the file's date was used", () => {
    expect(statusFor({ gps: true, dateSource: "file", match: "city", lookupFailed: false }))
      .toBe("Read the location. No capture date found, so the date is the file's. Tap it to change.");
  });
  it("explains neither", () => {
    expect(statusFor({ gps: false, dateSource: "file", match: null, lookupFailed: false }))
      .toBe("No location or date in this photo's data. Tap the caption lines to type them.");
    expect(statusFor({ gps: false, dateSource: "none", match: null, lookupFailed: false }))
      .toBe("No location or date in this photo's data. Tap the caption lines to type them.");
  });
  it("lets a failed lookup win whenever GPS is present", () => {
    for (const dateSource of ["exif", "file", "none"] as const) {
      expect(statusFor({ gps: true, dateSource, match: null, lookupFailed: true }))
        .toBe("Couldn't look up the place. Tap the top line to type it.");
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w apps/web -- status`
Expected: FAIL, "Failed to resolve import "./status"".

- [ ] **Step 3: Implement status.ts**

`apps/web/lib/status.ts`:

```ts
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
```

- [ ] **Step 4: Run the status tests to verify they pass**

Run: `npm test -w apps/web -- status`
Expected: PASS, 7 tests.

- [ ] **Step 5: Update the Make tests (they fail until step 7)**

In `e2e/make.spec.ts`:

1. Add fixture paths next to `portrait`:

```ts
const seoul = path.resolve("apps/web/public/dev/seoul.jpg");
const nogps = path.resolve("apps/web/public/dev/nogps.jpg");
const rotated = path.resolve("apps/web/public/dev/rotated.jpg");
```

2. In the first test ("makes a card from a photo, edits the caption and saves the PNG"), replace

```ts
  await expect(page.getByRole("status")).toContainText("The date is the file's.");
```

with

```ts
  await expect(page.getByRole("status")).toHaveText("No location or date in this photo's data. Tap the caption lines to type them.");
```

(the date line still comes from the file, so its regex assertion stays).

3. Append these tests at the end of the file:

```ts
test("reads the place, date and coordinates from a photo with EXIF", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator("img.oo-photo")).toHaveAttribute("width", "900");
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  await expect(page.locator(".oo-line-date")).toHaveText("July 1st, 2026");
  await expect(page.locator(".oo-line-coords")).toHaveText("37.5563° N, 126.9236° E");
  await expect(page.getByRole("status")).toHaveText("Read location and date from the photo.");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).click();
  const dl = await download;
  expect(dl.suggestedFilename()).toBe("one-of-one-seoul-south-korea.png");
  const png = PNG.sync.read(readFileSync((await dl.path())!));
  expect(png.width).toBe(1000);
  expect(png.height).toBe(1442);
});

test("leaves the place blank with a hint when the photo has a date but no GPS", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(nogps);
  await expect(page.locator(".oo-line-date")).toHaveText("July 1st, 2026");
  const place = page.locator(".oo-line-place");
  await expect(place).toHaveText("");
  await expect(place).toHaveAttribute("data-hint", "Where was this?");
  await expect(page.locator(".oo-line-coords")).toHaveText("");
  await expect(page.getByRole("status")).toContainText("No location in this photo's data.");
});

test("shows a sideways-stored camera photo upright in both painters", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(rotated);
  const img = page.locator("img.oo-photo");
  await expect(img).toHaveAttribute("width", "900");
  await expect(img).toHaveAttribute("height", "1200");
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).click();
  const png = PNG.sync.read(readFileSync((await (await download).path())!));
  expect(png.width).toBe(1000);
  expect(png.height).toBe(1442);
});

test("says so when the place lookup fails, and keeps the coordinates", async ({ page }) => {
  await page.route("**/api/place**", (route) => route.abort());
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.getByRole("status")).toHaveText("Couldn't look up the place. Tap the top line to type it.");
  await expect(page.locator(".oo-line-place")).toHaveText("");
  await expect(page.locator(".oo-line-coords")).toHaveText("37.5563° N, 126.9236° E");
  await expect(page.locator(".oo-line-date")).toHaveText("July 1st, 2026");
});
```

- [ ] **Step 6: Run the Make tests to verify the new ones fail**

Run: `npx playwright test make`
Expected: the first test and the four new ones FAIL on the status text or the empty caption lines; the other five still pass.

- [ ] **Step 7: Wire the Make screen**

In `apps/web/app/make/MakeScreen.tsx`:

1. Imports. Add `fmtCoords` to the `@one-of-one/card` import list, and add:

```ts
import type { PlaceMatch } from "@one-of-one/places";
import { readPhotoMetadata } from "@/lib/exif";
import { statusFor } from "@/lib/status";
```

2. Below `loadImage`, add the lookup helper:

```ts
/** Asks our own route for the place. Throws on any failure so the caller can say so. */
async function lookupPlace(lat: number, lng: number): Promise<PlaceMatch | null> {
  const res = await fetch(`/api/place?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
  if (!res.ok) throw new Error(`place lookup failed: ${res.status}`);
  const body = (await res.json()) as { match: PlaceMatch | null };
  return body.match;
}
```

3. Next to `captionRef`, add the match store (read by step 5's Add to board, written here):

```ts
  // The resolved place for step 5's numbering; not shown on the card.
  const placeMatchRef = useRef<PlaceMatch | null>(null);
```

4. Replace the body of `onFile` from `setStatus("Reading the photo…");` to the end of the function with:

```ts
    setStatus("Reading the photo…");
    const src = URL.createObjectURL(file);
    const [img, meta] = await Promise.all([
      loadImage(src).catch(() => null),
      readPhotoMetadata(file, file.lastModified),
    ]);
    if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) {
      URL.revokeObjectURL(src);
      setStatus("This photo format can't be shown here. Try a JPEG or PNG.");
      return;
    }

    let match: PlaceMatch | null = null;
    let lookupFailed = false;
    if (meta.gps) {
      try {
        match = await lookupPlace(meta.gps.lat, meta.gps.lng);
      } catch {
        lookupFailed = true;
      }
    }

    const caption = {
      place: match?.label ?? "",
      date: meta.takenAt ? fmtDate(meta.takenAt) : "",
      coords: meta.gps ? fmtCoords(meta.gps.lat, meta.gps.lng) : "",
    };
    captionRef.current = caption;
    placeMatchRef.current = match;
    setPhoto({ file, src, width: img.naturalWidth, height: img.naturalHeight, element: img });
    setPlace(caption.place);
    setDate(caption.date);
    setCoords(caption.coords);
    setIntro(assignIntro(seedFromPhoto(file.size, img.naturalWidth, img.naturalHeight)).id);
    setReplayKey((k) => k + 1);
    setStatus(statusFor({ gps: meta.gps !== null, dateSource: meta.dateSource, match: match?.kind ?? null, lookupFailed }));
```

Nothing else in the file changes: `onCaptionChange`, `onPrint` (which reads `captionRef`) and the JSX stay as they are.

- [ ] **Step 8: Run the Make tests to verify they pass**

Run: `npx playwright test make`
Expected: PASS, 10 tests. If the rotated case reports `width` 1200, Chromium did not apply the Orientation tag to `naturalWidth`; report it with the exact attribute values, do not change the test.

Run: `npm run lint && npm run typecheck`
Expected: exit 0.

- [ ] **Step 9: Record the conventions and the package in CLAUDE.md and README.md**

In `CLAUDE.md`:

1. Under `## Commands`, change the `fixtures` line in the code block to:

```
npm run fixtures                         regenerate apps/web/public/dev/* (PNG fixtures, then EXIF JPEG fixtures)
```

and add after the `npm test -w packages/card -- layout` line:

```
npm test -w packages/places -- resolve   one places test file
```

2. Under `## Where things are`, add a bullet after the `packages/card` one:

```
- `packages/places` is place resolution, no app imports: `data/` holds the prototype's 28 landmarks and 10,379 cities as JSON (regenerate with `npm run extract -w packages/places`); `resolvePlace()` runs SPEC.md's tiers; venue and neighborhood go through the `PlaceProvider` interface, stubbed until a places API is wired. The app calls it only through `GET /api/place`, so EXIF coordinates never leave our server.
```

and change the build-order bullet to:

```
- Build order from SPEC.md: step 1 (renderer and shell) and step 3 (metadata) are done. Next is step 2 (variation), then step 4 (accounts and the board). Decisions and plans so far are under `docs/superpowers/`.
```

3. Under `## Conventions`, add:

```
- An EXIF date is wall-clock at capture with no zone. exifr builds the `Date` from its components in the device's zone and `fmtDate` reads local getters, so the card shows the date the camera recorded. Never convert to UTC.
```

In `README.md`, add after the `packages/card/` line in the tree:

```
packages/places/          place resolution: landmark and city data, the resolver, the provider interface
```

- [ ] **Step 10: Run everything and commit**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e`
Expected: all green: unit 65 (card) + 20 (places) + 14 (web) = 99; e2e 24 + 9 (place) + 4 (make) = 37.

```bash
git add apps/web/lib/status.ts apps/web/lib/status.test.ts apps/web/app/make/MakeScreen.tsx e2e/make.spec.ts CLAUDE.md README.md
git commit -m "Fill the Make caption from EXIF and the place lookup, with the status line explaining what was read

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Push and confirm the `ci` workflow passes on GitHub before starting step 2.
