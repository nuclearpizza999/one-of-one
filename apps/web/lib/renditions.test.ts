import { describe, expect, it } from "vitest";
import { fitLongEdge } from "./renditions";

describe("fitLongEdge", () => {
  it("scales the long edge down to the cap and keeps the aspect", () => {
    expect(fitLongEdge(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitLongEdge(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitLongEdge(6000, 4000, 512)).toEqual({ width: 512, height: 341 });
  });
  it("never upscales", () => {
    expect(fitLongEdge(900, 1200, 2048)).toEqual({ width: 900, height: 1200 });
    expect(fitLongEdge(512, 512, 512)).toEqual({ width: 512, height: 512 });
  });
});
