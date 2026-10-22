import { describe, expect, it } from "vitest";
import { cardPaths, cardRow } from "./save";

const file = (name: string, type: string) => new File([new Uint8Array([1, 2, 3])], name, { type });

const photo = {
  id: "11111111-1111-4111-8111-111111111111",
  width: 900,
  height: 1200,
  meta: {
    takenAt: new Date(2026, 6, 1, 14, 30, 0),
    dateSource: "exif" as const,
    gps: { lat: 37.5563, lng: 126.9236 },
    camera: { make: "Apple", model: "iPhone 15 Pro" },
  },
  variation: {
    texture: "paper" as const,
    tone: "warm" as const,
    palette: { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] as const },
    tier: "standard" as const,
    motion: "none" as const,
    intro: "rise" as const,
    seed: 2263211217,
  },
};
const caption = { place: "Seoul, South Korea", date: "July 1st, 2026", coords: "37.5563° N, 126.9236° E" };
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("cardPaths", () => {
  it("puts every object under the owner's id and keeps the original's type", () => {
    expect(cardPaths(userId, photo.id, file("IMG_1.JPG", "image/jpeg"))).toEqual({
      original: `${userId}/${photo.id}.jpg`,
      rendition: `${userId}/${photo.id}/2048.jpg`,
      thumb: `${userId}/${photo.id}/512.jpg`,
    });
    expect(cardPaths(userId, photo.id, file("x.png", "image/png")).original).toBe(`${userId}/${photo.id}.png`);
    expect(cardPaths(userId, photo.id, file("x.heic", "image/heic")).original).toBe(`${userId}/${photo.id}.heic`);
    expect(cardPaths(userId, photo.id, file("x", "")).original).toBe(`${userId}/${photo.id}.bin`);
  });
});

describe("cardRow", () => {
  const paths = cardPaths(userId, photo.id, file("a.jpg", "image/jpeg"));
  it("carries the caption as shown, the zone-less date, the facts and the assigned variation", () => {
    const row = cardRow({ photo, caption, userId, placeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", paths });
    expect(row).toEqual({
      id: photo.id,
      user_id: userId,
      place_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      original_path: paths.original,
      rendition_path: paths.rendition,
      thumb_path: paths.thumb,
      photo_w: 900,
      photo_h: 1200,
      taken_at: "2026-07-01 14:30:00",
      date_source: "exif",
      caption_place: "Seoul, South Korea",
      caption_date: "July 1st, 2026",
      caption_coords: "37.5563° N, 126.9236° E",
      exif_lat: 37.5563,
      exif_lng: 126.9236,
      camera: { make: "Apple", model: "iPhone 15 Pro" },
      variation: { texture: "paper", tone: "warm", palette: { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] }, tier: "standard", motion: "none" },
      intro: "rise",
      variation_seed: 2263211217,
    });
  });
  it("never carries a number or a public flag, and copes with no date, GPS, camera or place", () => {
    const bare = { ...photo, meta: { takenAt: null, dateSource: "none" as const, gps: null, camera: null } };
    const row = cardRow({ photo: bare, caption: { place: "", date: "", coords: "" }, userId, placeId: null, paths });
    expect(row.taken_at).toBeNull();
    expect(row.exif_lat).toBeNull();
    expect(row.camera).toBeNull();
    expect(row.place_id).toBeNull();
    expect("number" in row).toBe(false);
    expect("is_public" in row).toBe(false);
  });
});
