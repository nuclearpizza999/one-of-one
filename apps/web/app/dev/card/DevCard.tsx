"use client";

import { CARD, Card, type Texture, type Tier, type Variation, borderSvg, cardHeightUnits, paletteFor, renderPng } from "@one-of-one/card";
import { useEffect, useMemo, useState } from "react";

export type Fixture = "portrait" | "landscape" | "square";

export interface DevCardProps {
  fixture: Fixture;
  coords: boolean;
  /** Card number; null means none. */
  number: number | null;
  longPlace: boolean;
  drift: boolean;
  texture: Texture | null;
  tier: Tier;
  driftBorder: boolean;
}

const LONG_PLACE = "Somewhere With A Very Long Place Name That Cannot Fit, Country";

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

export function DevCard({ fixture, coords, number, longPlace, drift, texture, tier, driftBorder }: DevCardProps) {
  const src = `/dev/${fixture}.png`;
  // A fixed variation for the diff: warm preset colours, no motion, one seed, so only the texture varies between cases.
  const variation = useMemo<Variation | null>(
    () =>
      texture
        ? { texture, tone: "warm", palette: paletteFor("warm", null), tier, motion: "none", intro: "rise", seed: 12345 }
        : null,
    [texture, tier],
  );
  // Primitives, so the effects below can list them as dependencies.
  const coordsText = coords ? CAPTION.coords : "";
  const numberValue = number;
  const placeText = longPlace ? LONG_PLACE : CAPTION.place;
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
        place: placeText,
        date: CAPTION.date,
        coords: coordsText,
        number: numberValue,
        border: variation ? borderSvg(variation, cardHeightUnits(photo.width, photo.height)) : undefined,
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
  }, [photo, coordsText, numberValue, placeText, variation]);

  useEffect(() => {
    if (pngLoaded && baseline !== null) document.body.dataset.ready = "1";
    return () => {
      delete document.body.dataset.ready;
    };
  }, [pngLoaded, baseline]);

  return (
    <div style={{ padding: 20, background: "#888" }}>
      <style>{`.drift .oo-plate { padding-bottom: ${CARD.bottom + 1}cqw; } .drift-border .oo-border-img { transform: translateX(1cqw); }`}</style>
      <div id="dom" className={[drift ? "drift" : null, driftBorder ? "drift-border" : null].filter(Boolean).join(" ") || undefined} style={{ width: 1000 }}>
        <Card
          photo={photo ? { src: photo.src, width: photo.width, height: photo.height } : null}
          place={placeText}
          date={CAPTION.date}
          coords={coordsText}
          number={numberValue}
          wall="dark"
          variation={variation}
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
