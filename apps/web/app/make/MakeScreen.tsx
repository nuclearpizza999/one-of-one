"use client";

import {
  Card,
  assignIntro,
  fmtDate,
  renderPng,
  seedFromPhoto,
  type IntroId,
  type LineKind,
} from "@one-of-one/card";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Icon } from "@/components/Icon";
import { StatusLine } from "@/components/StatusLine";
import { Strip } from "@/components/Strip";
import { TopBar } from "@/components/TopBar";
import { useWall } from "@/components/useWall";

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

  // Release the previous photo's object URL when it is replaced or the screen unmounts.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.src);
    };
  }, [photo]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("Reading the photo…");
    const src = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await loadImage(src);
    } catch {
      URL.revokeObjectURL(src);
      setStatus("This photo format can't be shown here. Try a JPEG or PNG.");
      return;
    }
    setPhoto({ file, src, width: img.naturalWidth, height: img.naturalHeight, element: img });
    setPlace("");
    setCoords("");
    setDate(file.lastModified ? fmtDate(new Date(file.lastModified)) : "");
    setIntro(assignIntro(seedFromPhoto(file.size, img.naturalWidth, img.naturalHeight)).id);
    setReplayKey((k) => k + 1);
    setStatus("The date is the file's. Tap the caption lines to type the place and fix the date.");
  }

  function onCaptionChange(field: LineKind, text: string) {
    if (field === "place") setPlace(text);
    else if (field === "date") setDate(text);
    else setCoords(text);
  }

  async function onPrint() {
    if (!photo || busy) return;
    setBusy(true);
    setStatus("Rendering the print…");
    try {
      const r = await renderPng({
        image: photo.element,
        naturalWidth: photo.width,
        naturalHeight: photo.height,
        place,
        date,
        coords,
        number: null,
      });
      const name = `one-of-one-${slug(place)}.png`;
      const file = new File([r.blob], name, { type: "image/png" });
      const notes = [
        r.fontsLoaded ? "" : "Printed with a fallback font.",
        r.reduced ? "Saved at a smaller size than full print resolution." : "",
      ].filter(Boolean);

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          setStatus(["Print shared.", ...notes].join(" "));
        } catch (err) {
          setStatus(err instanceof Error && err.name === "AbortError" ? "Share cancelled." : "Couldn't share the print.");
        }
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(r.blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        setStatus(["Print saved.", ...notes].join(" "));
      }
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
