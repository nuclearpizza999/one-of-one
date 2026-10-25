import type { SupabaseClient } from "@supabase/supabase-js";
import type { Variation } from "@one-of-one/card";

/**
 * Writes a saved card's design (variation and intro) to its row. Only a founder's update passes:
 * the database's design guard refuses anyone else's (42501). Throws on any error.
 */
export async function updateCardDesign(supabase: SupabaseClient, cardId: string, v: Variation): Promise<void> {
  const { texture, tone, palette, tier, motion, intro } = v;
  const { data, error } = await supabase
    .from("cards")
    .update({ variation: { texture, tone, palette, tier, motion }, intro })
    .eq("id", cardId)
    .select("id");
  if (error) throw error;
  // Row-level security turns an update of someone else's card into zero rows, not an error.
  if (!data || data.length === 0) throw new Error("card not updated");
}
