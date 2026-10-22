import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PHOTO_NAME, devPhotosDir, listDevPhotos, resolveDevPhoto } from "./devPhotos";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "oo-dev-photos-"));
  for (const name of ["b.jpg", "A.JPEG", "c.png", "notes.txt"]) writeFileSync(path.join(dir, name), "x");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("devPhotosDir", () => {
  it("honours DEV_PHOTOS_DIR", () => {
    const prev = process.env.DEV_PHOTOS_DIR;
    process.env.DEV_PHOTOS_DIR = "/tmp/elsewhere";
    expect(devPhotosDir()).toBe("/tmp/elsewhere");
    if (prev === undefined) delete process.env.DEV_PHOTOS_DIR;
    else process.env.DEV_PHOTOS_DIR = prev;
  });
  it("defaults to dev-photos two levels above the app", () => {
    const prev = process.env.DEV_PHOTOS_DIR;
    delete process.env.DEV_PHOTOS_DIR;
    expect(devPhotosDir()).toBe(path.resolve(process.cwd(), "..", "..", "dev-photos"));
    if (prev !== undefined) process.env.DEV_PHOTOS_DIR = prev;
  });
});

describe("listDevPhotos", () => {
  it("lists only JPEG names, sorted", async () => {
    expect(await listDevPhotos(dir)).toEqual(["A.JPEG", "b.jpg"]);
  });
  it("is empty for a missing folder", async () => {
    expect(await listDevPhotos(path.join(dir, "missing"))).toEqual([]);
  });
});

describe("resolveDevPhoto", () => {
  it("resolves a JPEG inside the folder", async () => {
    expect(await resolveDevPhoto("b.jpg", dir)).toBe(path.join(dir, "b.jpg"));
  });
  it("refuses other types, missing files and anything that is not a plain name", async () => {
    expect(await resolveDevPhoto("c.png", dir)).toBeNull();
    expect(await resolveDevPhoto("nope.jpg", dir)).toBeNull();
    expect(await resolveDevPhoto("../b.jpg", dir)).toBeNull();
    expect(await resolveDevPhoto("sub/b.jpg", dir)).toBeNull();
    expect(await resolveDevPhoto("", dir)).toBeNull();
  });
  it("accepts only plain JPEG names", () => {
    expect(PHOTO_NAME.test("IMG_0001.JPG")).toBe(true);
    expect(PHOTO_NAME.test("a photo.jpg")).toBe(false);
    expect(PHOTO_NAME.test("x.jpeg")).toBe(true);
  });
});
