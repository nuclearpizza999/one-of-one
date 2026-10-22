/** The size to draw at so the long edge is at most `max`, never upscaling. */
export function fitLongEdge(w: number, h: number, max: number): { width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= max) return { width: w, height: h };
  const s = max / long;
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

/**
 * A JPEG of the decoded photo with its long edge capped. Drawing through a canvas
 * keeps the browser's orientation fix and carries no EXIF, so the rendition and the
 * thumbnail never leak the original's metadata.
 */
export async function scaledJpeg(img: HTMLImageElement, longEdge: number, quality: number): Promise<Blob> {
  const { width, height } = fitLongEdge(img.naturalWidth, img.naturalHeight, longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas");
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))), "image/jpeg", quality);
  });
}
