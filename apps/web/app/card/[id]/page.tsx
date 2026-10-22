import type { Variation } from "@one-of-one/card";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { CardScreen } from "./CardScreen";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CardReadRow {
  id: string;
  original_path: string;
  rendition_path: string;
  photo_w: number;
  photo_h: number;
  caption_place: string;
  caption_date: string;
  caption_coords: string;
  variation: Pick<Variation, "texture" | "tone" | "palette" | "tier" | "motion">;
  intro: Variation["intro"];
  variation_seed: number | string;
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createServerSupabase();
  // Row-level security hides every card but the owner's, so a stranger's id reads as missing.
  const { data, error } = await supabase
    .from("cards")
    .select("id, original_path, rendition_path, photo_w, photo_h, caption_place, caption_date, caption_coords, variation, intro, variation_seed")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const row = data as CardReadRow | null;
  if (!row) notFound();

  const [rendition, original] = await Promise.all([
    supabase.storage.from("renditions").createSignedUrl(row.rendition_path, 60 * 60),
    supabase.storage.from("originals").createSignedUrl(row.original_path, 60 * 60),
  ]);
  if (rendition.error || original.error) throw rendition.error ?? original.error;

  return (
    <CardScreen
      photo={{ src: rendition.data.signedUrl, width: row.photo_w, height: row.photo_h }}
      originalUrl={original.data.signedUrl}
      caption={{ place: row.caption_place, date: row.caption_date, coords: row.caption_coords }}
      variation={{ ...row.variation, intro: row.intro, seed: Number(row.variation_seed) }}
    />
  );
}
