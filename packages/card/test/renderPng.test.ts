import { describe, expect, it } from "vitest";
import { CARD } from "../src/layout";
import {
  type CanvasTarget,
  type Ctx2D,
  drawCard,
  ellipsize,
  printDimensions,
  renderPng,
} from "../src/renderPng";

type Call = [name: string, ...args: unknown[]];

function fakeCtx() {
  const calls: Call[] = [];
  const ctx: Ctx2D = {
    fillStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillRect: (x, y, w, h) => {
      calls.push(["fillRect", x, y, w, h, ctx.fillStyle]);
    },
    drawImage: (img, x, y, w, h) => {
      calls.push(["drawImage", img, x, y, w, h]);
    },
    fillText: (text, x, y, maxWidth) => {
      calls.push(["fillText", text, x, y, maxWidth, ctx.font, ctx.fillStyle, ctx.textAlign]);
    },
    measureText: (text) => ({ width: text.length * 10 }),
  };
  return { ctx, calls };
}

const image = {} as CanvasImageSource;

describe("printDimensions", () => {
  it("uses the native width below the cap", () => {
    expect(printDimensions(900, 1200)).toEqual({
      photoW: 900, photoH: 1200, scale: 1, W: 1000, u: 10, H: 1442,
    });
  });
  it("caps the photo at 4800 px wide and scales the height", () => {
    expect(printDimensions(6000, 4000)).toEqual({
      photoW: 4800, photoH: 3200, scale: 0.8, W: 5333, u: 53.33, H: 4491,
    });
  });
  it("accepts a smaller cap", () => {
    expect(printDimensions(6000, 4000, 2400)).toMatchObject({ photoW: 2400, photoH: 1600, W: 2667 });
  });
});

describe("ellipsize", () => {
  const { ctx } = fakeCtx();
  it("returns text that fits unchanged", () => {
    expect(ellipsize(ctx, "Seoul", 100)).toBe("Seoul");
  });
  it("trims to an ellipsis within the width", () => {
    expect(ellipsize(ctx, "Seoul, South Korea", 80)).toBe("Seoul,…");
  });
  it("returns just the ellipsis when nothing fits", () => {
    expect(ellipsize(ctx, "Seoul", 5)).toBe("…");
  });
});

describe("drawCard", () => {
  const spec = {
    place: "Seoul, South Korea",
    date: "July 1st, 2026",
    coords: "37.5563° N, 126.9236° E",
    number: 3,
  };
  const dims = printDimensions(900, 1200);
  const fs = 34;
  const lastBaseline = 1442 - 36 - fs * CARD.baselineFromBottom;
  const lineHeight = fs * 1.32;

  it("fills the mat white and draws the photo inside it", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, spec);
    expect(calls[0]).toEqual(["fillRect", 0, 0, 1000, 1442, "#fff"]);
    expect(calls[1]).toEqual(["drawImage", image, 50, 50, 900, 1200]);
  });

  it("draws the border over the fill and under the photo when given one", () => {
    const { ctx, calls } = fakeCtx();
    const border = { kind: "border" } as unknown as CanvasImageSource;
    drawCard(ctx, image, dims, spec, border);
    expect(calls[0]![0]).toBe("fillRect");
    expect(calls[1]).toEqual(["drawImage", border, 0, 0, 1000, 1442]);
    expect(calls[2]).toEqual(["drawImage", image, 50, 50, 900, 1200]);
  });

  it("draws no border by default", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, spec);
    expect(calls.filter((c) => c[0] === "drawImage")).toHaveLength(1);
  });

  it("draws each line at its baseline, bottom-aligned, in the right weight and color", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, spec);
    const texts = calls.filter((c) => c[0] === "fillText");
    expect(texts).toHaveLength(4);
    expect(texts[0]!.slice(1, 4)).toEqual(["Seoul, South Korea", 80, expect.closeTo(lastBaseline - 2 * lineHeight, 6)]);
    expect(texts[0]!.slice(5)).toEqual(['600 34px "EB Garamond", Garamond, Georgia, "Times New Roman", serif', "#111", "left"]);
    expect(texts[1]!.slice(1, 4)).toEqual(["July 1st, 2026", 80, expect.closeTo(lastBaseline - lineHeight, 6)]);
    expect(texts[2]!.slice(1, 4)).toEqual(["37.5563° N, 126.9236° E", 80, expect.closeTo(lastBaseline, 6)]);
    expect(texts[2]!.slice(5)).toEqual(['400 34px "EB Garamond", Garamond, Georgia, "Times New Roman", serif', "#333", "left"]);
    expect(ctx.textBaseline).toBe("alphabetic");
  });

  it("right-aligns the number on the last baseline", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, spec);
    const num = calls.filter((c) => c[0] === "fillText")[3]!;
    expect(num.slice(1, 4)).toEqual(["#3", 920, expect.closeTo(lastBaseline, 6)]);
    expect(num.slice(5)).toEqual(['600 34px "EB Garamond", Garamond, Georgia, "Times New Roman", serif', "#111", "right"]);
  });

  it("ellipsizes a long place line at 72% of the photo width", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, { ...spec, place: "A".repeat(100) });
    const place = calls.filter((c) => c[0] === "fillText")[0]!;
    expect(place[1]).toBe(`${"A".repeat(63)}…`);
  });

  it("omits the number when null and keeps two lines bottom-aligned", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, { ...spec, coords: "", number: null });
    const texts = calls.filter((c) => c[0] === "fillText");
    expect(texts).toHaveLength(2);
    expect(texts[1]!.slice(1, 4)).toEqual(["July 1st, 2026", 80, expect.closeTo(lastBaseline, 6)]);
  });
});

describe("renderPng", () => {
  const spec = { place: "Seoul", date: "July 1st, 2026", coords: "", number: null };

  function fakeCanvasFactory(maxWidth: number) {
    const made: Array<{ w: number; h: number }> = [];
    const contexts: ReturnType<typeof fakeCtx>[] = [];
    const createCanvas = (w: number, h: number): CanvasTarget => {
      if (w > maxWidth) throw new Error("canvas too large");
      made.push({ w, h });
      const c = fakeCtx();
      contexts.push(c);
      return { width: w, height: h, getContext: () => c.ctx };
    };
    return { createCanvas, made, contexts };
  }
  const toBlob = async () => new Blob(["png"], { type: "image/png" });

  it("returns a blob at full size when the canvas is allowed", async () => {
    const { createCanvas, made } = fakeCanvasFactory(10_000);
    const r = await renderPng({ ...spec, image, naturalWidth: 900, naturalHeight: 1200, createCanvas, toBlob });
    expect(made).toEqual([{ w: 1000, h: 1442 }]);
    expect(r).toMatchObject({ width: 1000, height: 1442, reduced: false, fontsLoaded: false });
    expect(r.blob.type).toBe("image/png");
  });

  it("retries at half the cap when the canvas cannot be made", async () => {
    const { createCanvas, made } = fakeCanvasFactory(3000);
    const r = await renderPng({ ...spec, image, naturalWidth: 6000, naturalHeight: 4000, createCanvas, toBlob });
    expect(made).toEqual([{ w: 2667, h: 2245 }]);
    expect(r).toMatchObject({ width: 2667, height: 2245, reduced: true });
  });

  it("loads the border SVG as a data URL and reports it drawn", async () => {
    const { createCanvas, contexts } = fakeCanvasFactory(10_000);
    const seen: string[] = [];
    const borderImage = { kind: "border" } as unknown as CanvasImageSource;
    const r = await renderPng({
      ...spec, image, naturalWidth: 900, naturalHeight: 1200, createCanvas, toBlob,
      border: "<svg/>",
      loadImage: async (url) => { seen.push(url); return borderImage; },
    });
    expect(r.borderDrawn).toBe(true);
    expect(seen).toEqual(["data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E"]);
    const draws = contexts[0]!.calls.filter((c) => c[0] === "drawImage");
    expect(draws).toHaveLength(2);
    expect(draws[0]![1]).toBe(borderImage);
  });

  it("prints without the border when its image fails to load", async () => {
    const { createCanvas, contexts } = fakeCanvasFactory(10_000);
    const r = await renderPng({
      ...spec, image, naturalWidth: 900, naturalHeight: 1200, createCanvas, toBlob,
      border: "<svg/>",
      loadImage: async () => null,
    });
    expect(r.borderDrawn).toBe(false);
    expect(contexts[0]!.calls.filter((c) => c[0] === "drawImage")).toHaveLength(1);
  });

  it("never loads an image when no border is requested", async () => {
    const { createCanvas } = fakeCanvasFactory(10_000);
    let loads = 0;
    const r = await renderPng({
      ...spec, image, naturalWidth: 900, naturalHeight: 1200, createCanvas, toBlob,
      loadImage: async () => { loads += 1; return null; },
    });
    expect(loads).toBe(0);
    expect(r.borderDrawn).toBe(false);
  });

  it("throws when both attempts fail", async () => {
    const { createCanvas } = fakeCanvasFactory(100);
    await expect(
      renderPng({ ...spec, image, naturalWidth: 6000, naturalHeight: 4000, createCanvas, toBlob }),
    ).rejects.toThrow("canvas too large");
  });
});
