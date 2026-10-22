"use client";

import { Card, type Variation } from "@one-of-one/card";
import Link from "next/link";
import { useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Icon } from "@/components/Icon";
import { StatusLine } from "@/components/StatusLine";
import { Strip } from "@/components/Strip";
import { TopBar } from "@/components/TopBar";
import { useWall } from "@/components/useWall";
import { loadImage } from "@/lib/photo";
import { printCard } from "@/lib/print";

export interface CardScreenProps {
  photo: { src: string; width: number; height: number };
  originalUrl: string;
  caption: { place: string; date: string; coords: string };
  variation: Variation;
}

/** A saved card, read-only: the same card and strip as Make, with Back in place of Cancel. */
export function CardScreen({ photo, originalUrl, caption, variation }: CardScreenProps) {
  const wall = useWall();
  const [replayKey, setReplayKey] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function onPrint() {
    if (busy) return;
    setBusy(true);
    setStatus("Rendering the print…");
    try {
      // The print is drawn from the original at its native size, never from the rendition.
      const image = await loadImage(originalUrl);
      setStatus(
        await printCard({
          image,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          place: caption.place,
          date: caption.date,
          coords: caption.coords,
          variation,
          borderOnPrint: true,
        }),
      );
    } catch {
      setStatus("Couldn't render the print. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFrame
      top={
        <TopBar
          right={
            <Link href="/board" className="icon-target" aria-label="Back">
              <Icon name="back" size={20} />
            </Link>
          }
        />
      }
    >
      <div className="card-area">
        <Card
          photo={photo}
          place={caption.place}
          date={caption.date}
          coords={caption.coords}
          number={null}
          editable={false}
          intro={variation.intro}
          variation={variation}
          replayKey={replayKey}
          wall={wall}
        />
      </div>
      <StatusLine>{status}</StatusLine>
      <div className="actions">
        <Strip
          cells={[
            { label: "Replay intro", icon: "replay", onClick: () => setReplayKey((k) => k + 1) },
            { label: "Add to board", icon: "grid-plus", selected: true, disabled: true },
            { label: "Print", icon: "printer", disabled: busy, onClick: onPrint },
          ]}
        />
      </div>
    </AppFrame>
  );
}
