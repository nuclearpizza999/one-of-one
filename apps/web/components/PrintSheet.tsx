"use client";

import "./print-sheet.css";
import { Card, SHAPES, type CardPhoto, type Shape, type Variation } from "@one-of-one/card";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Strip } from "@/components/Strip";

export interface PrintChoice {
  shape: Shape;
  border: boolean;
}

export interface PrintSheetProps {
  photo: CardPhoto;
  caption: { place: string; date: string; coords: string };
  /** The card's design; null prints the plain mat whatever Border says. */
  variation: Variation | null;
  wall: "light" | "dark";
  onSave: (choice: PrintChoice) => void;
  onClose: () => void;
}

/**
 * Print: the card in the chosen shape, with or without its border, and Save. Every opening starts
 * at Gallery with the border. A print has no intro and no motion, so the preview has neither.
 */
export function PrintSheet({ photo, caption, variation, wall, onSave, onClose }: PrintSheetProps) {
  const [shape, setShape] = useState<Shape>("gallery");
  const [border, setBorder] = useState(true);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancel.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preview = border && variation ? { ...variation, motion: "none" as const } : null;

  return (
    <div className="print-sheet" role="dialog" aria-modal="true" aria-label="Print">
      <div className="print-sheet-bar">
        <button ref={cancel} type="button" className="icon-target" aria-label="Cancel" onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="card-area">
        <Card
          photo={photo}
          place={caption.place}
          date={caption.date}
          coords={caption.coords}
          number={null}
          wall={wall}
          variation={preview}
          shape={shape}
        />
      </div>
      <div className="print-field">
        <span className="label">Shape</span>
        <Strip
          size="option"
          cells={Object.values(SHAPES).map((s) => ({ label: s.label, text: s.label, selected: shape === s.id, onClick: () => setShape(s.id) }))}
        />
      </div>
      <div className="print-field">
        <span className="label">Border</span>
        <Strip
          size="option"
          cells={[
            { label: "Plain", text: "Plain", selected: !border, onClick: () => setBorder(false) },
            { label: "Border", text: "Border", selected: border, onClick: () => setBorder(true) },
          ]}
        />
      </div>
      <div className="actions">
        <Strip cells={[{ label: "Save print", icon: "printer", selected: true, onClick: () => onSave({ shape, border }) }]} />
      </div>
    </div>
  );
}
