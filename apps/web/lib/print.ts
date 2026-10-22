import { type Variation, borderSvg, cardHeightUnits, renderPng } from "@one-of-one/card";

export interface PrintInput {
  image: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
  place: string;
  date: string;
  coords: string;
  variation: Variation | null;
  borderOnPrint: boolean;
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "card";
}

/**
 * Draw the print and hand it over: the share sheet where there is one, a download
 * otherwise. Returns the status line to show. Throws when the render itself fails.
 */
export async function printCard(input: PrintInput): Promise<string> {
  const border =
    input.borderOnPrint && input.variation
      ? borderSvg(input.variation, cardHeightUnits(input.naturalWidth, input.naturalHeight))
      : undefined;
  const r = await renderPng({
    image: input.image,
    naturalWidth: input.naturalWidth,
    naturalHeight: input.naturalHeight,
    place: input.place,
    date: input.date,
    coords: input.coords,
    number: null,
    border,
  });
  const name = `one-of-one-${slug(input.place)}.png`;
  const file = new File([r.blob], name, { type: "image/png" });
  const notes = [
    r.fontsLoaded ? "" : "Printed with a fallback font.",
    r.reduced ? "Saved at a smaller size than full print resolution." : "",
    border && !r.borderDrawn ? "Printed without the border." : "",
  ].filter(Boolean);

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return ["Print shared.", ...notes].join(" ");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return ["Share cancelled.", ...notes].join(" ");
      // Any other failure falls through to the download.
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(r.blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return ["Print saved.", ...notes].join(" ");
}
