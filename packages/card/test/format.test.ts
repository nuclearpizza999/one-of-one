import { describe, expect, it } from "vitest";
import { fmtCoords, fmtDate, ordinal } from "../src/format";

describe("ordinal", () => {
  it.each([
    [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"],
    [11, "11th"], [12, "12th"], [13, "13th"],
    [21, "21st"], [22, "22nd"], [23, "23rd"], [31, "31st"],
    [101, "101st"], [111, "111th"],
  ])("formats %i as %s", (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe("fmtDate", () => {
  it("writes full month, ordinal day, four-digit year", () => {
    expect(fmtDate(new Date(2026, 6, 1))).toBe("July 1st, 2026");
    expect(fmtDate(new Date(2024, 11, 23))).toBe("December 23rd, 2024");
  });
});

describe("fmtCoords", () => {
  it("writes four decimals with hemisphere letters", () => {
    expect(fmtCoords(37.5563, 126.9236)).toBe("37.5563° N, 126.9236° E");
  });
  it("uses S and W for negative values", () => {
    expect(fmtCoords(-33.8568, -70.6483)).toBe("33.8568° S, 70.6483° W");
  });
  it("rounds to four decimals", () => {
    expect(fmtCoords(37.81990001, -122.47834)).toBe("37.8199° N, 122.4783° W");
  });
});
