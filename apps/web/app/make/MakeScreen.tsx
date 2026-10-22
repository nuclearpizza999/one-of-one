"use client";

import {
  Card,
  assignIntro,
  fmtCoords,
  fmtDate,
  renderPng,
  seedFromPhoto,
  type IntroId,
  type LineKind,
} from "@one-of-one/card";
import type { PlaceMatch } from "@one-of-one/places";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Icon } from "@/components/Icon";
import { StatusLine } from "@/components/StatusLine";
import { Strip } from "@/components/Strip";
import { TopBar } from "@/components/TopBar";
import { useWall } from "@/components/useWall";
import { readPhotoMetadata } from "@/lib/exif";
import { statusFor } from "@/lib/status";

interface Photo {
  file: File;
  src: string;
  width: number;
  height: number;
  element: HTMLImageElement;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "card";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image could not be decoded"));
    img.src = src;
  });
}

/** Asks our own route for the place. Throws on any failure so the caller can say so. */
async function lookupPlace(lat: number, lng: number): Promise<PlaceMatch | null> {
  const res = await fetch("/api/place", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lat, lng }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`place lookup failed: ${res.status}`);
  const body = (await res.json()) as { match: PlaceMatch | null };
  return body.match;
}

export function MakeScreen() {
  const router = useRouter();
  const wall = useWall();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [place, setPlace] = useState("");
  const [date, setDate] = useState("");
  const [coords, setCoords] = useState("");
  const [intro, setIntro] = useState<IntroId | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  // Caption edits commit on blur; print reads the committed text from here, not from state.
  const captionRef = useRef({ place: "", date: "", coords: "" });
  // The resolved place for step 5's numbering; not shown on the card.
  const placeMatchRef = useRef<PlaceMatch | null>(null);
  const pickSeq = useRef(0);

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
    const src = URL.createObjectURL(file);
    const [img, meta] = await Promise.all([
      loadImage(src).catch(() => null),
      readPhotoMetadata(file, file.lastModified),
    ]);
    // A newer pick has superseded this one; drop its result so it cannot overwrite the newer photo.
    if (seq !== pickSeq.current) {
      URL.revokeObjectURL(src);
      return;
    }
    if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) {
      URL.revokeObjectURL(src);
      setStatus("This photo format can't be shown here. Try a JPEG or PNG.");
      return;
    }

    let match: PlaceMatch | null = null;
    let lookupFailed = false;
    if (meta.gps) {
      try {
        match = await lookupPlace(meta.gps.lat, meta.gps.lng);
      } catch {
        lookupFailed = true;
      }
    }

    if (seq !== pickSeq.current) {
      URL.revokeObjectURL(src);
      return;
    }

    const caption = {
      place: match?.label ?? "",
      date: meta.takenAt ? fmtDate(meta.takenAt) : "",
      coords: meta.gps ? fmtCoords(meta.gps.lat, meta.gps.lng) : "",
    };
    placeMatchRef.current = match;
    setPhoto({ file, src, width: img.naturalWidth, height: img.naturalHeight, element: img });
    setCaption(caption);
    setIntro(assignIntro(seedFromPhoto(file.size, img.naturalWidth, img.naturalHeight)).id);
    setReplayKey((k) => k + 1);
    setStatus(statusFor({ gps: meta.gps !== null, dateSource: meta.dateSource, match: match?.kind ?? null, lookupFailed }));
  }

  function onCaptionChange(field: LineKind, text: string) {
    setCaption({ ...captionRef.current, [field]: text });
  }

  async function onPrint() {
    if (!photo || busy) return;
    // Commit a line that is still being edited; its blur handler updates captionRef synchronously.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.classList.contains("oo-line")) active.blur();
    const { place: placeText, date: dateText, coords: coordsText } = captionRef.current;
    setBusy(true);
    setStatus("Rendering the print…");
    try {
      const r = await renderPng({
        image: photo.element,
        naturalWidth: photo.width,
        naturalHeight: photo.height,
        place: placeText,
        date: dateText,
        coords: coordsText,
        number: null,
      });
      const name = `one-of-one-${slug(placeText)}.png`;
      const file = new File([r.blob], name, { type: "image/png" });
      const notes = [
        r.fontsLoaded ? "" : "Printed with a fallback font.",
        r.reduced ? "Saved at a smaller size than full print resolution." : "",
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
          intro={intro}
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
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} data-testid="photo-input" />
    </AppFrame>
  );
}
