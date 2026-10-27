"use client";

import { Card, type Palette, type Variation, type VariationOverrides, withOverrides } from "@one-of-one/card";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { DesignPanel } from "@/components/DesignPanel";
import { Icon } from "@/components/Icon";
import { StatusLine } from "@/components/StatusLine";
import { Strip } from "@/components/Strip";
import { TopBar } from "@/components/TopBar";
import { useWall } from "@/components/useWall";
import { updateCardDesign } from "@/lib/designs";
import { loadImage, samplePhotoPalette } from "@/lib/photo";
import { printCard } from "@/lib/print";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export interface CardScreenProps {
  cardId: string;
  /** Read on the server from the signed-in user's own row; false on any error. */
  isFounder: boolean;
  photo: { src: string; width: number; height: number };
  originalUrl: string;
  caption: { place: string; date: string; coords: string };
  variation: Variation;
}

/**
 * A saved card: the same card and strip as Make, with Back in place of Cancel. Read-only for everyone
 * but a founder, who gets the design panel; each pick is written to the row at once.
 */
export function CardScreen({ cardId, isFounder, photo, originalUrl, caption, variation: stored }: CardScreenProps) {
  const wall = useWall();
  const [replayKey, setReplayKey] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState<VariationOverrides>({});
  const [borderOnPrint, setBorderOnPrint] = useState(true);
  // Picks are written one after another, so the row ends with the last pick whatever the network does.
  const saving = useRef<Promise<void>>(Promise.resolve());
  const lastPick = useRef(0);

  // The photo's palette is not stored with the card. For a founder, sample it from the photo shown, so the
  // panel's Warm, Photo and Cool resolve against the real photo; until then, and for anyone else, a card saved
  // with the Photo tone uses its stored palette and any other card none. Without an overridden tone the stored
  // palette is kept whatever this is, so nobody's saved card changes. The sample is also kept as a promise, so
  // a pick made before it settles is saved with the palette the screen ends up showing, not the grey.
  const [sampled, setSampled] = useState<Palette | null>(null);
  const sample = useRef<Promise<Palette | null>>(Promise.resolve(null));
  useEffect(() => {
    if (!isFounder) return;
    let cancelled = false;
    const promise = loadImage(photo.src)
      .then((img) => samplePhotoPalette(img))
      .catch(() => null);
    sample.current = promise;
    void promise.then((palette) => {
      if (!cancelled) setSampled(palette);
    });
    return () => {
      cancelled = true;
    };
  }, [isFounder, photo.src]);
  // The one rule for the palette a tone pick resolves against, shared by the render and the save.
  const photoPaletteFor = (current: Palette | null) => current ?? (stored.tone === "photo" ? stored.palette : null);
  const variation = withOverrides(stored, overrides, photoPaletteFor(sampled));

  function onOverrides(next: VariationOverrides) {
    setOverrides(next);
    if (next.intro !== overrides.intro) setReplayKey((k) => k + 1);
    const pick = ++lastPick.current;
    setStatus("Saving…");
    saving.current = saving.current.then(async () => {
      let line = "Saved.";
      try {
        // Wait for the sample, so the palette saved is the one the screen shows once it has settled.
        const design = withOverrides(stored, next, photoPaletteFor(await sample.current));
        await updateCardDesign(createBrowserSupabase(), cardId, design);
      } catch {
        line = "Couldn't save the design. Try again.";
      }
      if (pick === lastPick.current) setStatus(line);
    });
  }

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
          borderOnPrint,
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
      {isFounder ? (
        <DesignPanel
          derived={stored}
          overrides={overrides}
          onChange={onOverrides}
          borderOnPrint={borderOnPrint}
          onBorderOnPrint={setBorderOnPrint}
        />
      ) : null}
    </AppFrame>
  );
}
