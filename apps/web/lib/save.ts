import type { SupabaseClient } from "@supabase/supabase-js";
import type { Variation } from "@one-of-one/card";
import type { PlaceMatch } from "@one-of-one/places";
import { type PhotoMetadata, wallClockString } from "./exif";
import type { Caption, DescribedPhoto } from "./photo";
import { scaledJpeg } from "./renditions";

export const RENDITION_LONG_EDGE = 2048;
export const THUMB_LONG_EDGE = 512;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif", "image/webp": "webp" };

/** Object paths, every one under the owner's id (the storage policies key on it). */
export function cardPaths(userId: string, cardId: string, file: File): { original: string; rendition: string; thumb: string } {
  const ext = EXT[file.type] ?? "bin";
  return {
    original: `${userId}/${cardId}.${ext}`,
    rendition: `${userId}/${cardId}/${RENDITION_LONG_EDGE}.jpg`,
    thumb: `${userId}/${cardId}/${THUMB_LONG_EDGE}.jpg`,
  };
}

export interface CardRowInput {
  photo: { id: string | null; width: number; height: number; meta: PhotoMetadata; variation: Variation };
  caption: Caption;
  userId: string;
  placeId: string | null;
  paths: { original: string; rendition: string; thumb: string };
}

/**
 * True for Postgres 23505 (duplicate key). On a phone network the insert can succeed while its
 * response is lost; the retry then hits the same id. The id is a random UUID only this client made,
 * so a duplicate means the card is already saved and the retry counts as success.
 */
export function isDuplicateKey(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

/** The insert payload. Never carries a number or a public flag: the database guard would clear them anyway. */
export interface CardRow {
  id: string;
  user_id: string;
  place_id: string | null;
  original_path: string;
  rendition_path: string;
  thumb_path: string;
  photo_w: number;
  photo_h: number;
  taken_at: string | null;
  date_source: PhotoMetadata["dateSource"];
  caption_place: string;
  caption_date: string;
  caption_coords: string;
  exif_lat: number | null;
  exif_lng: number | null;
  camera: { make: string; model: string } | null;
  variation: Pick<Variation, "texture" | "tone" | "palette" | "tier" | "motion">;
  intro: Variation["intro"];
  variation_seed: number;
}

export function cardRow({ photo, caption, userId, placeId, paths }: CardRowInput): CardRow {
  if (!photo.id) throw new Error("a card needs an id before it is saved");
  const { texture, tone, palette, tier, motion, intro, seed } = photo.variation;
  return {
    id: photo.id,
    user_id: userId,
    place_id: placeId,
    original_path: paths.original,
    rendition_path: paths.rendition,
    thumb_path: paths.thumb,
    photo_w: photo.width,
    photo_h: photo.height,
    taken_at: photo.meta.takenAt ? wallClockString(photo.meta.takenAt) : null,
    date_source: photo.meta.dateSource,
    caption_place: caption.place,
    caption_date: caption.date,
    caption_coords: caption.coords,
    exif_lat: photo.meta.gps?.lat ?? null,
    exif_lng: photo.meta.gps?.lng ?? null,
    camera: photo.meta.camera,
    variation: { texture, tone, palette, tier, motion },
    intro,
    variation_seed: seed,
  };
}

async function ensurePlace(supabase: SupabaseClient, match: PlaceMatch): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_place", {
    p_kind: match.kind,
    p_name: match.name,
    p_region: match.region,
    p_lat: match.lat,
    p_lng: match.lng,
    p_radius_m: null,
    p_provider_ref: match.key,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Save a made card: renditions on the phone, three uploads, the place, the row.
 * Uploads are idempotent per path, so a failed save can simply be retried. Throws on any failure.
 */
export async function saveCard(supabase: SupabaseClient, userId: string, photo: DescribedPhoto, caption: Caption): Promise<void> {
  if (!photo.id) throw new Error("a card needs an id before it is saved");
  const paths = cardPaths(userId, photo.id, photo.file);
  const [rendition, thumb] = await Promise.all([
    scaledJpeg(photo.element, RENDITION_LONG_EDGE, 0.9),
    scaledJpeg(photo.element, THUMB_LONG_EDGE, 0.85),
  ]);
  const up = async (bucket: string, path: string, body: Blob, contentType: string) => {
    const { error } = await supabase.storage.from(bucket).upload(path, body, { upsert: true, contentType });
    if (error) throw error;
  };
  await Promise.all([
    up("originals", paths.original, photo.file, photo.file.type || "application/octet-stream"),
    up("renditions", paths.rendition, rendition, "image/jpeg"),
    up("renditions", paths.thumb, thumb, "image/jpeg"),
  ]);
  const placeId = photo.match ? await ensurePlace(supabase, photo.match) : null;
  const { error } = await supabase.from("cards").insert(cardRow({ photo, caption, userId, placeId, paths }));
  if (error && !isDuplicateKey(error)) throw error;
}
