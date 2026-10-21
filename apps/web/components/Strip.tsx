import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export interface StripCell {
  /** aria-label; for a text cell, the same words as the text. */
  label: string;
  icon?: IconName;
  text?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
}

export function Strip({ cells, size = "action" }: { cells: StripCell[]; size?: "action" | "option" }) {
  return (
    <div className="strip" data-size={size}>
      {cells.map((c) => {
        const content = c.icon ? <Icon name={c.icon} /> : c.text;
        const selected = c.selected ? "true" : "false";
        return c.href ? (
          <Link key={c.label} href={c.href} className="strip-cell" aria-label={c.label} data-selected={selected}>
            {content}
          </Link>
        ) : (
          <button
            key={c.label}
            type="button"
            className="strip-cell"
            aria-label={c.label}
            data-selected={selected}
            disabled={c.disabled}
            onClick={c.onClick}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
