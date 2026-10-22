import { AppFrame } from "@/components/AppFrame";
import { TopBar } from "@/components/TopBar";
import { createServerSupabase } from "@/lib/supabase/server";
import { type BoardCard, BoardGrid } from "./BoardGrid";

export const dynamic = "force-dynamic";

const PAGE = 500;

interface BoardRow {
  id: string;
  thumb_path: string;
  photo_w: number;
  photo_h: number;
  caption_place: string;
  caption_date: string;
}

export default async function BoardPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("cards")
    .select("id, thumb_path, photo_w, photo_h, caption_place, caption_date")
    .order("created_at", { ascending: false })
    .limit(PAGE);
  if (error) throw error;
  // No generated database types yet; the select above lists exactly these columns.
  const rows = (data ?? []) as BoardRow[];

  let cards: BoardCard[] = [];
  if (rows.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from("renditions")
      .createSignedUrls(rows.map((r) => r.thumb_path), 60 * 60);
    if (signError) throw signError;
    const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl] as const));
    cards = rows.map((r) => ({
      id: r.id,
      thumbUrl: urlFor.get(r.thumb_path) ?? "",
      width: r.photo_w,
      height: r.photo_h,
      label: r.caption_place || r.caption_date || "Untitled card",
    }));
  }

  const n = cards.length;
  return (
    <AppFrame top={<TopBar right={<span className="topbar-count" aria-label={`${n} ${n === 1 ? "card" : "cards"}`}>{n}</span>} />}>
      {n === 0 ? (
        <div className="empty-board">
          <p className="status">No cards yet.</p>
        </div>
      ) : (
        <BoardGrid cards={cards} />
      )}
    </AppFrame>
  );
}
