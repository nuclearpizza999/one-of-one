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
