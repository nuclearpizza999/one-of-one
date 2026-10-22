import { describe, expect, it } from "vitest";
import { newCardId } from "./ids";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newCardId", () => {
  it("is a version 4 UUID and never repeats", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newCardId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(V4);
  });
  it("works without crypto.randomUUID, as on a phone over plain http", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      expect(newCardId()).toMatch(V4);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
