import Link from "next/link";
import type { CSSProperties } from "react";
import { BoardGap } from "./BoardGap";

export interface BoardCard {
  id: string;
  thumbUrl: string;
  width: number;
  height: number;
  label: string;
}

/**
 * Rows of whole photos. Each tile's flex-basis is its aspect times the base row
 * height and its flex-grow is proportional to its aspect, so the tiles that wrap
 * into a row grow to one shared height and the row runs margin to margin. The
 * inner padding keeps each tile at its photo's aspect: nothing is cropped. A
 * filler keeps the last, partial row left-aligned at the base height, and shows
 * the 1/1 mark in the space it takes (BoardGap).
 */
export function BoardGrid({ cards }: { cards: BoardCard[] }) {
  return (
    <div className="board-wrap">
      <div className="board">
        {cards.map((c) => (
          <Link
            key={c.id}
            href={`/card/${c.id}`}
            className="tile"
            aria-label={c.label}
            style={{ "--w": c.width, "--h": c.height } as CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL; Next's image loader would not help */}
            <img src={c.thumbUrl} alt="" width={c.width} height={c.height} loading="lazy" decoding="async" />
          </Link>
        ))}
        <BoardGap />
      </div>
    </div>
  );
}
