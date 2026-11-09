"use client";

import { Fragment } from "react";
import "./design-panel.css";
import { INTROS, MOTIONS, TEXTURES, TIERS, TONES, VARIATION_RULES, type Variation, type VariationOverrides } from "@one-of-one/card";
import { Strip } from "@/components/Strip";

export interface DesignPanelProps {
  derived: Variation;
  overrides: VariationOverrides;
  onChange: (next: VariationOverrides) => void;
}

type Field = Exclude<keyof VariationOverrides, "toneStrength">;

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
export function DesignPanel({ derived, overrides, onChange }: DesignPanelProps) {
  const set = (key: Field, id: string | undefined) => {
    const next: Record<string, string> = { ...(overrides as Record<string, string>) };
    if (id === undefined) delete next[key];
    else next[key] = id;
    onChange(next as VariationOverrides);
  };
  const setStrength = (value: number | undefined) => {
    const next: VariationOverrides = { ...overrides };
    if (value === undefined) delete next.toneStrength;
    else next.toneStrength = value;
    onChange(next);
  };
  // The photo's colour and the grey have nothing to shift.
  const tone = overrides.tone ?? derived.tone;
  const strengthOff = tone === "photo" || tone === "neutral";
  const strength = overrides.toneStrength ?? derived.toneStrength;

  return (
    <section className="design-panel" data-design-panel aria-label="Card design">
      {FIELDS.map((f) => (
        <Fragment key={f.key}>
          <div className="design-field">
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
          {f.key === "tone" ? (
            <div className="design-field">
              <span className="label">Strength</span>
              <div className="design-strength">
                <input
                  type="range"
                  min={0}
                  max={VARIATION_RULES.strength.max}
                  step={1}
                  value={strength}
                  disabled={strengthOff}
                  aria-label="Tone strength"
                  onChange={(e) => setStrength(Number(e.currentTarget.value))}
                />
                {/* Not a status region: the slider announces its own value, and the page's one status line stays the app's. */}
                <output role="none">{strength}</output>
                <Strip
                  size="option"
                  cells={[{ label: "Assigned", text: "Assigned", selected: overrides.toneStrength === undefined, disabled: strengthOff, onClick: () => setStrength(undefined) }]}
                />
              </div>
            </div>
          ) : null}
        </Fragment>
      ))}
      <p className="status" data-design-assigned>
        Assigned: {derived.texture} · {derived.tone} {derived.toneStrength} · {derived.tier} · {derived.motion} · {derived.intro} · seed 0x
        {derived.seed.toString(16)} · tint {derived.palette.tint}
      </p>
    </section>
  );
}
