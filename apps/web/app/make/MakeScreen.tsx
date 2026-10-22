"use client";

import {
  Card,
  type LineKind,
  type VariationOverrides,
  withOverrides,
} from "@one-of-one/card";
import type { PlaceMatch } from "@one-of-one/places";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Icon } from "@/components/Icon";
import { StatusLine } from "@/components/StatusLine";
import { Strip } from "@/components/Strip";
import { TopBar } from "@/components/TopBar";
import { useWall } from "@/components/useWall";
import { newCardId } from "@/lib/ids";
import { type DescribedPhoto, describePhoto, lookupPlace } from "@/lib/photo";
import { printCard } from "@/lib/print";
import { saveCard } from "@/lib/save";
import { statusFor } from "@/lib/status";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/** Development builds only. The condition is resolved at build time, so production bundles contain no panel code. */
const DevVariationPanel =
  process.env.NODE_ENV === "production"
    ? null
    : dynamic(() => import("@/components/DevVariationPanel").then((m) => m.DevVariationPanel), { ssr: false });

export function MakeScreen() {
  const router = useRouter();
  const wall = useWall();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<DescribedPhoto | null>(null);
  const [place, setPlace] = useState("");
  const [date, setDate] = useState("");
  const [coords, setCoords] = useState("");
  const [overrides, setOverrides] = useState<VariationOverrides>({});
  const [borderOnPrint, setBorderOnPrint] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  // Caption edits commit on blur; print reads the committed text from here, not from state.
  const captionRef = useRef({ place: "", date: "", coords: "" });
  // The resolved place for step 5's numbering; not shown on the card.
  const placeMatchRef = useRef<PlaceMatch | null>(null);
  const pickSeq = useRef(0);

  // The variation on the card: the assigned one, plus any development overrides.
  const variation = photo ? withOverrides(photo.variation, overrides, photo.palette) : null;

  // Release the previous photo's object URL when it is replaced or the screen unmounts.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.src);
    };
  }, [photo]);

  // The one place the caption is written: the ref (read by print) and the state (read by the card).
  function setCaption(next: { place: string; date: string; coords: string }) {
    captionRef.current = next;
    setPlace(next.place);
    setDate(next.date);
    setCoords(next.coords);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const seq = ++pickSeq.current;
    setStatus("Reading the photo…");
    // The card's id exists from the first moment, so the border and intro shown now are what the save writes.
    const described = await describePhoto(file, lookupPlace, newCardId());
    // A newer pick has superseded this one; drop its result so it cannot overwrite the newer photo.
    if (seq !== pickSeq.current) {
      if (described) URL.revokeObjectURL(described.src);
      return;
    }
    if (!described) {
      setStatus("This photo format can't be shown here. Try a JPEG or PNG.");
      return;
    }
    placeMatchRef.current = described.match;
    setPhoto(described);
    setCaption(described.caption);
    setOverrides({});
    setReplayKey((k) => k + 1);
    setStatus(
      statusFor({
        gps: described.meta.gps !== null,
        dateSource: described.meta.dateSource,
        match: described.match?.kind ?? null,
        lookupFailed: described.lookupFailed,
      }),
    );
  }

  function onCaptionChange(field: LineKind, text: string) {
    setCaption({ ...captionRef.current, [field]: text });
  }

  function onOverrides(next: VariationOverrides) {
    setOverrides(next);
    if (next.intro !== overrides.intro) setReplayKey((k) => k + 1);
  }

  async function onPrint() {
    if (!photo || !variation || busy) return;
    // Commit a line that is still being edited; its blur handler updates captionRef synchronously.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.classList.contains("oo-line")) active.blur();
    const { place: placeText, date: dateText, coords: coordsText } = captionRef.current;
    setBusy(true);
    setStatus("Rendering the print…");
    try {
      setStatus(
        await printCard({
          image: photo.element,
          naturalWidth: photo.width,
          naturalHeight: photo.height,
          place: placeText,
          date: dateText,
          coords: coordsText,
          variation,
          borderOnPrint,
        }),
      );
    } catch {
      setStatus("Couldn't render the print. Try another photo.");
    } finally {
      setBusy(false);
    }
  }

  async function onAddToBoard() {
    if (!photo || busy) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.classList.contains("oo-line")) active.blur();
    setBusy(true);
    setStatus("Saving…");
    try {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("not signed in");
      await saveCard(supabase, data.user.id, photo, captionRef.current);
      router.replace("/board");
    } catch {
      setStatus("Couldn't save the card. Try again.");
      setBusy(false);
    }
  }

  return (
    <AppFrame
      top={
        <TopBar
          right={
            <button type="button" className="icon-target" aria-label="Cancel" onClick={() => router.push("/board")}>
              <Icon name="close" size={20} />
            </button>
          }
        />
      }
    >
      <div className="card-area">
        <Card
          photo={photo ? { src: photo.src, width: photo.width, height: photo.height } : null}
          place={place}
          date={date}
          coords={coords}
          number={null}
          editable={photo !== null}
          onCaptionChange={onCaptionChange}
          intro={variation?.intro ?? null}
          variation={variation}
          replayKey={replayKey}
          wall={wall}
          onPick={() => fileInput.current?.click()}
        />
      </div>
      <StatusLine>{status}</StatusLine>
      <div className="actions">
        <Strip
          cells={[
            { label: "Replay intro", icon: "replay", disabled: !photo, onClick: () => setReplayKey((k) => k + 1) },
            { label: "Add to board", icon: "grid-plus", selected: true, disabled: !photo || busy, onClick: onAddToBoard },
            { label: "Print", icon: "printer", disabled: !photo || busy, onClick: onPrint },
          ]}
        />
      </div>
      {DevVariationPanel && photo ? (
        <DevVariationPanel
          derived={photo.variation}
          overrides={overrides}
          onChange={onOverrides}
          borderOnPrint={borderOnPrint}
          onBorderOnPrint={setBorderOnPrint}
        />
      ) : null}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} data-testid="photo-input" />
    </AppFrame>
  );
}
