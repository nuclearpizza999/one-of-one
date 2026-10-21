"use client";

import { CARD, Card, renderPng } from "@one-of-one/card";
import { useEffect, useState } from "react";

export type Fixture = "portrait" | "landscape" | "square";

export interface DevCardProps {
  fixture: Fixture;
  coords: boolean;
  number: boolean;
  drift: boolean;
}

const CAPTION = {
  place: "Seoul, South Korea",
  date: "July 1st, 2026",
  coords: "37.5563° N, 126.9236° E",
};

interface Loaded {
  src: string;
  width: number;
  height: number;
  element: HTMLImageElement;
}

export function DevCard({ fixture, coords, number, drift }: DevCardProps) {
  const src = `/dev/${fixture}.png`;
  // Primitives, so the effects below can list them as dependencies.
  const coordsText = coords ? CAPTION.coords : "";
  const numberValue = number ? 3 : null;
  const [photo, setPhoto] = useState<Loaded | null>(null);
  const [pngSrc, setPngSrc] = useState<string | null>(null);
  const [pngLoaded, setPngLoaded] = useState(false);
  const [baseline, setBaseline] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setPhoto({ src, width: img.naturalWidth, height: img.naturalHeight, element: img });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (!photo) return;
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      const r = await renderPng({
        image: photo.element,
        naturalWidth: photo.width,
        naturalHeight: photo.height,
        place: CAPTION.place,
        date: CAPTION.date,
        coords: coordsText,
        number: numberValue,
      });
      if (cancelled) return;
      url = URL.createObjectURL(r.blob);
      setPngSrc(url);

      // Where does the DOM put the last baseline? A zero-size inline-block sits on its line's baseline.
      const card = document.querySelector<HTMLElement>("#dom .oo-card");
      const lastLine = card?.querySelector<HTMLElement>(".oo-lines .oo-line:last-child");
      if (card && lastLine) {
        const probe = document.createElement("span");
        probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
        lastLine.appendChild(probe);
        const cardRect = card.getBoundingClientRect();
        const probeRect = probe.getBoundingClientRect();
        probe.remove();
        const u = cardRect.width / 100;
        setBaseline((cardRect.bottom - probeRect.bottom - CARD.bottom * u) / (CARD.fontSize * u));
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo, coordsText, numberValue]);

  useEffect(() => {
    if (pngLoaded && baseline !== null) document.body.dataset.ready = "1";
    return () => {
      delete document.body.dataset.ready;
    };
  }, [pngLoaded, baseline]);

  return (
    <div style={{ padding: 20, background: "#888" }}>
      <style>{`.drift .oo-plate { padding-bottom: ${CARD.bottom + 1}cqw; }`}</style>
      <div id="dom" className={drift ? "drift" : undefined} style={{ width: 1000 }}>
        <Card
          photo={photo ? { src: photo.src, width: photo.width, height: photo.height } : null}
          place={CAPTION.place}
          date={CAPTION.date}
          coords={coordsText}
          number={numberValue}
          wall="dark"
        />
      </div>
      {pngSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img id="png" src={pngSrc} alt="" onLoad={() => setPngLoaded(true)} style={{ display: "block", marginTop: 20 }} />
      ) : null}
      <output id="baseline">{baseline ?? ""}</output>
    </div>
  );
}
