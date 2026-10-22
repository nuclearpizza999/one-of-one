"use client";

import {
  Card,
  type LineKind,
  type VariationOverrides,
  borderSvg,
  cardHeightUnits,
  renderPng,
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
import { statusFor } from "@/lib/status";

/** Development builds only. The condition is resolved at build time, so production bundles contain no panel code. */
const DevVariationPanel =
  process.env.NODE_ENV === "production"
    ? null
    : dynamic(() => import("@/components/DevVariationPanel").then((m) => m.DevVariationPanel), { ssr: false });

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "card";
}

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
      const border = borderOnPrint ? borderSvg(variation, cardHeightUnits(photo.width, photo.height)) : undefined;
      const r = await renderPng({
        image: photo.element,
        naturalWidth: photo.width,
        naturalHeight: photo.height,
        place: placeText,
        date: dateText,
        coords: coordsText,
        number: null,
        border,
      });
      const name = `one-of-one-${slug(placeText)}.png`;
      const file = new File([r.blob], name, { type: "image/png" });
      const notes = [
        r.fontsLoaded ? "" : "Printed with a fallback font.",
        r.reduced ? "Saved at a smaller size than full print resolution." : "",
        border && !r.borderDrawn ? "Printed without the border." : "",
      ].filter(Boolean);

      const download = (blob: Blob, fileName: string) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        setStatus(["Print saved.", ...notes].join(" "));
      };

      let shared = false;
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          setStatus(["Print shared.", ...notes].join(" "));
          shared = true;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            setStatus(["Share cancelled.", ...notes].join(" "));
            shared = true;
          }
          // Any other failure falls through to the download below.
        }
      }
      if (!shared) download(r.blob, name);
    } catch {
      setStatus("Couldn't render the print. Try another photo.");
    } finally {
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
            { label: "Add to board", icon: "grid-plus", selected: true, disabled: true },
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
