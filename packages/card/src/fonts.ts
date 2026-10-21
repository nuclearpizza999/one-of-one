export const CARD_FONT_FAMILY = '"EB Garamond", Garamond, Georgia, "Times New Roman", serif';

/** A canvas ctx.font string for the caption at the given pixel size. */
export function cardFont(weight: 400 | 600, px: number): string {
  return `${weight} ${px}px ${CARD_FONT_FAMILY}`;
}

/** Characters from both subsets, so fonts.load fetches latin and latin-ext. */
const SAMPLE_TEXT = "a°Ā";

/**
 * Resolves true when EB Garamond 400 and 600 are loaded and usable by
 * canvas text. Resolves false outside a browser, when the @font-face rules
 * from card.css are not in the document, or when loading fails.
 */
export async function loadCardFonts(): Promise<boolean> {
  if (typeof document === "undefined" || !("fonts" in document)) return false;
  try {
    const faces = await Promise.all([
      document.fonts.load(cardFont(600, 32), SAMPLE_TEXT),
      document.fonts.load(cardFont(400, 32), SAMPLE_TEXT),
    ]);
    return faces.every((f) => f.length > 0);
  } catch {
    return false;
  }
}
