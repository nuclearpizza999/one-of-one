import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import piexif from "piexifjs";
import { parseUtcOffset, plausibleDate, readPhotoMetadata, wallClockMs, wallClockString } from "./exif";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../public/dev/${name}`, import.meta.url)));

function withDates(dateTimeOriginal: string | null, createDate: string | null): Uint8Array {
  const binary = fixture("nogps.jpg").toString("binary");
  const exif = piexif.load(binary);
  delete exif.Exif[piexif.ExifIFD.DateTimeOriginal];
  delete exif.Exif[piexif.ExifIFD.DateTimeDigitized];
  if (dateTimeOriginal) exif.Exif[piexif.ExifIFD.DateTimeOriginal] = dateTimeOriginal;
  if (createDate) exif.Exif[piexif.ExifIFD.DateTimeDigitized] = createDate;
  return Buffer.from(piexif.insert(piexif.dump(exif), piexif.remove(binary)), "binary");
}

// piexifjs predates the EXIF 2.31 offset tags; register them so dump() can write them.
const OFFSET_TIME_ORIGINAL = 0x9011;
const OFFSET_TIME_DIGITIZED = 0x9012;
const tags = (piexif as unknown as { TAGS: { Exif: Record<number, { name: string; type: string }> } }).TAGS.Exif;
tags[OFFSET_TIME_ORIGINAL] ??= { name: "OffsetTimeOriginal", type: "Ascii" };
tags[OFFSET_TIME_DIGITIZED] ??= { name: "OffsetTimeDigitized", type: "Ascii" };

function withExifFields(name: string, fields: Record<number, string>, drop: number[] = []): Uint8Array {
  const binary = fixture(name).toString("binary");
  const exif = piexif.load(binary);
  for (const tag of drop) delete exif.Exif[tag];
  for (const [tag, value] of Object.entries(fields)) exif.Exif[Number(tag)] = value;
  return Buffer.from(piexif.insert(piexif.dump(exif), piexif.remove(binary)), "binary");
}

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

  it("reads the camera make and model", async () => {
    expect((await readPhotoMetadata(fixture("seoul.jpg"))).camera).toEqual({ make: "Apple", model: "iPhone 15 Pro" });
    expect((await readPhotoMetadata(fixture("nogps.jpg"))).camera).toEqual({ make: "FUJIFILM", model: "X100VI" });
    expect((await readPhotoMetadata(fixture("rotated.jpg"))).camera).toEqual({ make: "Apple", model: "iPhone 15 Pro" });
  });

  it("has no camera when the photo carries none", async () => {
    expect((await readPhotoMetadata(fixture("portrait.png"))).camera).toBeNull();
  });

  it("returns nulls for a PNG with no EXIF", async () => {
    const m = await readPhotoMetadata(fixture("portrait.png"));
    expect(m).toEqual({ takenAt: null, dateSource: "none", gps: null, camera: null, utcOffsetMinutes: null });
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
    expect(m).toEqual({ takenAt: null, dateSource: "none", gps: null, camera: null, utcOffsetMinutes: null });
  });

  it("falls back to CreateDate when DateTimeOriginal is an unset clock", async () => {
    const m = await readPhotoMetadata(withDates("0000:00:00 00:00:00", "2026:07:01 14:30:00"));
    expect(m.dateSource).toBe("exif");
    expect(m.takenAt?.getFullYear()).toBe(2026);
    expect(m.takenAt?.getHours()).toBe(14);
  });

  it("uses CreateDate when DateTimeOriginal is absent", async () => {
    const m = await readPhotoMetadata(withDates(null, "2024:12:23 09:00:00"));
    expect(m.dateSource).toBe("exif");
    expect(m.takenAt?.getFullYear()).toBe(2024);
    expect(m.takenAt?.getMonth()).toBe(11);
    expect(m.takenAt?.getDate()).toBe(23);
  });

  it("falls back to the file time when both EXIF dates are implausible", async () => {
    const m = await readPhotoMetadata(withDates("0000:00:00 00:00:00", "1899:12:31 00:00:00"), Date.UTC(2024, 0, 1));
    expect(m.dateSource).toBe("file");
  });

  it("rejects a date in the future", () => {
    expect(plausibleDate(new Date(Date.now() + 7 * 24 * 3600 * 1000))).toBeNull();
    expect(plausibleDate(new Date(Date.now() + 3600 * 1000))).toBeInstanceOf(Date);
  });

  it("reads the capture time zone that goes with DateTimeOriginal", async () => {
    const m = await readPhotoMetadata(withExifFields("seoul.jpg", { [OFFSET_TIME_ORIGINAL]: "+09:00" }));
    expect(m.utcOffsetMinutes).toBe(540);
    expect(m.takenAt?.getHours()).toBe(14);
  });

  it("reads the digitized time zone when the date came from CreateDate", async () => {
    const m = await readPhotoMetadata(
      withExifFields(
        "nogps.jpg",
        { [piexif.ExifIFD.DateTimeDigitized]: "2026:07:01 14:30:00", [OFFSET_TIME_DIGITIZED]: "-05:00", [OFFSET_TIME_ORIGINAL]: "+09:00" },
        [piexif.ExifIFD.DateTimeOriginal],
      ),
    );
    expect(m.dateSource).toBe("exif");
    expect(m.utcOffsetMinutes).toBe(-300);
  });

  it("has no time zone when the photo records none", async () => {
    expect((await readPhotoMetadata(fixture("seoul.jpg"))).utcOffsetMinutes).toBeNull();
    expect((await readPhotoMetadata(fixture("nogps.jpg"))).utcOffsetMinutes).toBeNull();
  });
});

describe("parseUtcOffset", () => {
  it("reads ±HH:MM as minutes east of UTC", () => {
    expect(parseUtcOffset("+09:00")).toBe(540);
    expect(parseUtcOffset("-05:30")).toBe(-330);
    expect(parseUtcOffset("+00:00")).toBe(0);
    expect(parseUtcOffset(" +05:45 ")).toBe(345);
  });
  it("is null for anything else", () => {
    for (const bad of [undefined, null, 540, "", "09:00", "+9:00", "+09:60", "+15:00", "UTC", "+0900"]) {
      expect(parseUtcOffset(bad), String(bad)).toBeNull();
    }
  });
});

describe("wallClockMs", () => {
  it("is the local wall-clock time as a zone-free number", () => {
    expect(wallClockMs(new Date(2026, 6, 1, 14, 30, 0))).toBe(Date.UTC(2026, 6, 1, 14, 30, 0));
  });
});

describe("wallClockString", () => {
  it("prints the local getters, zero-padded, with no zone", () => {
    expect(wallClockString(new Date(2026, 6, 1, 14, 30, 5))).toBe("2026-07-01 14:30:05");
    expect(wallClockString(new Date(2026, 0, 9, 0, 0, 0))).toBe("2026-01-09 00:00:00");
  });
  it("keeps the recorded day whatever the zone would do to UTC", () => {
    const lateEvening = new Date(2026, 6, 1, 23, 30, 0);
    expect(wallClockString(lateEvening).slice(0, 10)).toBe("2026-07-01");
  });
});
