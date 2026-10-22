"use client";

import "@/components/dev.css";
import { Card, TEXTURES, TIERS, TONES, type Tier, type Tone, withOverrides } from "@one-of-one/card";
import { type ChangeEvent, useEffect, useState } from "react";
import { Strip } from "@/components/Strip";
import { type DescribedPhoto, describePhoto } from "@/lib/photo";

const WIDTHS = [160, 320, 640] as const;

interface Entry {
  name: string;
  photo: DescribedPhoto;
}

export function VariationGallery() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tier, setTier] = useState<Tier>("standard");
  /** null: each photo's own tone. */
  const [tone, setTone] = useState<Tone | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [width, setWidth] = useState<number>(WIDTHS[0]);
  const [pickError, setPickError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/dev/photos");
      const { photos } = (await res.json()) as { photos: string[] };
      for (const name of photos) {
        try {
          const blob = await (await fetch(`/api/dev/photos/${encodeURIComponent(name)}`)).blob();
          const described = await describePhoto(new File([blob], name, { type: "image/jpeg" }));
          if (!cancelled && described) setEntries((prev) => [...prev, { name, photo: described }]);
        } catch {
          // One unreadable photo must not hide the rest of the folder.
        }
      }
      if (!cancelled) setLoaded(true);
    })().catch(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPickError(false);
    try {
      const described = await describePhoto(file);
      if (described) setEntries((prev) => [...prev, { name: file.name, photo: described }]);
    } catch {
      setPickError(true);
    }
  }

  return (
    <main className="gallery" data-dev-gallery>
      <h1 className="place-name">Variation gallery (development only)</h1>
      <div className="gallery-controls">
        <Strip
          size="option"
          cells={Object.values(TIERS).map((t) => ({ label: t.label, text: t.label, selected: tier === t.id, onClick: () => setTier(t.id) }))}
        />
        <Strip
          size="option"
          cells={[
            { label: "Photo's own", text: "Own", selected: tone === null, onClick: () => setTone(null) },
            ...Object.values(TONES).map((t) => ({ label: t.label, text: t.label, selected: tone === t.id, onClick: () => setTone(t.id) })),
          ]}
        />
        <Strip
          size="option"
          cells={WIDTHS.map((w) => ({ label: String(w), text: String(w), selected: width === w, onClick: () => setWidth(w) }))}
        />
        <label className="gallery-pick">
          Pick a photo <input type="file" accept="image/*" onChange={onPick} data-testid="gallery-input" />
        </label>
      </div>
      {pickError ? <p className="status">Couldn&apos;t read that photo.</p> : null}
      {loaded && entries.length === 0 ? (
        <p className="status">Drop JPEGs into dev-photos/ at the repo root, or pick one.</p>
      ) : null}
      {entries.map(({ name, photo }) => (
        <section className="gallery-row" key={photo.src}>
          <p className="status">
            {name} · assigned {photo.variation.texture} · {photo.variation.tone} · {photo.variation.tier}
            {photo.caption.place ? ` · ${photo.caption.place}` : ""}
          </p>
          <div className="gallery-cards">
            {Object.values(TEXTURES).map((t) => {
              const v = withOverrides(photo.variation, { texture: t.id, tier, ...(tone ? { tone } : {}) }, photo.palette);
              return (
                <figure
                  className="gallery-cell"
                  key={t.id}
                  data-texture={t.id}
                  data-derived={t.id === photo.variation.texture ? "true" : "false"}
                >
                  <div style={{ width }}>
                    <Card
                      photo={{ src: photo.src, width: photo.width, height: photo.height }}
                      place={photo.caption.place}
                      date={photo.caption.date}
                      coords={photo.caption.coords}
                      number={null}
                      variation={v}
                      wall="light"
                    />
                  </div>
                  <figcaption className="label">{t.label}</figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
