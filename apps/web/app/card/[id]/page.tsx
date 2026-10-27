import { knownMotion, type Variation } from "@one-of-one/card";
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
  // The motion is a string: a card saved with a since-retired motion still holds its id.
  variation: Pick<Variation, "texture" | "tone" | "palette" | "tier"> & { motion: string };
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
      cardId={row.id}
      isFounder={await readIsFounder(supabase)}
      photo={{ src: rendition.data.signedUrl, width: row.photo_w, height: row.photo_h }}
      originalUrl={original.data.signedUrl}
      caption={{ place: row.caption_place, date: row.caption_date, coords: row.caption_coords }}
      variation={{ ...row.variation, motion: knownMotion(row.variation.motion), intro: row.intro, seed: Number(row.variation_seed) }}
    />
  );
}

/**
 * Whether the signed-in user is a founder, from their own users row. Any error reads as false,
 * including a database that does not have the column yet.
 */
async function readIsFounder(supabase: Awaited<ReturnType<typeof createServerSupabase>>): Promise<boolean> {
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return false;
    const { data, error } = await supabase.from("users").select("is_founder").eq("id", auth.user.id).maybeSingle();
    if (error || !data) return false;
    return (data as { is_founder?: unknown }).is_founder === true;
  } catch {
    return false;
  }
}
