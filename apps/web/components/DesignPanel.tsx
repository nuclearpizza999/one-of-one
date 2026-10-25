"use client";

import "./design-panel.css";
import { INTROS, MOTIONS, TEXTURES, TIERS, TONES, type Variation, type VariationOverrides } from "@one-of-one/card";
import { Strip } from "@/components/Strip";

export interface DesignPanelProps {
  derived: Variation;
  overrides: VariationOverrides;
  onChange: (next: VariationOverrides) => void;
  borderOnPrint: boolean;
  onBorderOnPrint: (on: boolean) => void;
}

type Field = keyof VariationOverrides;

/** Built from the registries, never listed by hand: a new entry appears here on its own. */
const FIELDS: ReadonlyArray<{ key: Field; title: string; entries: ReadonlyArray<{ id: string; label: string }> }> = [
  { key: "intro", title: "Intro", entries: INTROS },
  { key: "texture", title: "Texture", entries: Object.values(TEXTURES) },
  { key: "tone", title: "Tone", entries: Object.values(TONES) },
  { key: "tier", title: "Tier", entries: Object.values(TIERS) },
  { key: "motion", title: "Motion", entries: Object.values(MOTIONS) },
];

/**
 * Pick any variation value to see it on the live card and in the print. Rendered for founders on the
 * live site and for everyone in development builds; only a founder's picks are saved with the card.
 */
export function DesignPanel({ derived, overrides, onChange, borderOnPrint, onBorderOnPrint }: DesignPanelProps) {
  const set = (key: Field, id: string | undefined) => {
    const next: Record<string, string> = { ...(overrides as Record<string, string>) };
    if (id === undefined) delete next[key];
    else next[key] = id;
    onChange(next as VariationOverrides);
  };

  return (
    <section className="design-panel" data-design-panel aria-label="Card design">
      {FIELDS.map((f) => (
        <div className="design-field" key={f.key}>
          <span className="label">{f.title}</span>
          <Strip
            size="option"
            cells={[
              ...f.entries.map((e) => ({
                label: e.label,
                text: e.label,
                selected: overrides[f.key] === e.id,
                onClick: () => set(f.key, e.id),
              })),
              { label: "Assigned", text: "Assigned", selected: overrides[f.key] === undefined, onClick: () => set(f.key, undefined) },
            ]}
          />
        </div>
      ))}
      <div className="design-field">
        <span className="label">Border on print</span>
        <Strip
          size="option"
          cells={[
            { label: "On", text: "On", selected: borderOnPrint, onClick: () => onBorderOnPrint(true) },
            { label: "Off", text: "Off", selected: !borderOnPrint, onClick: () => onBorderOnPrint(false) },
          ]}
        />
      </div>
      <p className="status" data-design-assigned>
        Assigned: {derived.texture} · {derived.tone} · {derived.tier} · {derived.motion} · {derived.intro} · seed 0x
        {derived.seed.toString(16)} · tint {derived.palette.tint}
      </p>
    </section>
  );
}
