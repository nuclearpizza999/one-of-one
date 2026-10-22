import { describe, expect, it } from "vitest";
import { statusFor } from "./status";

describe("statusFor", () => {
  it("names a landmark when one matched", () => {
    expect(statusFor({ gps: true, dateSource: "exif", match: "landmark", lookupFailed: false }))
      .toBe("Read landmark and date from the photo.");
  });
  it("says location for a city, neighborhood or venue match", () => {
    for (const match of ["city", "neighborhood", "venue"] as const) {
      expect(statusFor({ gps: true, dateSource: "exif", match, lookupFailed: false }))
        .toBe("Read location and date from the photo.");
    }
  });
  it("asks for a name when GPS matched nothing", () => {
    expect(statusFor({ gps: true, dateSource: "exif", match: null, lookupFailed: false }))
      .toBe("Read the coordinates and date, but no named place is near. Tap the top line to name it.");
  });
  it("explains a missing location", () => {
    expect(statusFor({ gps: false, dateSource: "exif", match: null, lookupFailed: false }))
      .toBe("No location in this photo's data. Phones usually strip it when a photo is uploaded from the web, and screenshots never have it. Tap the top line to type the place.");
  });
  it("explains a missing date when the file's date was used", () => {
    expect(statusFor({ gps: true, dateSource: "file", match: "city", lookupFailed: false }))
      .toBe("Read the location. No capture date found, so the date is the file's. Tap it to change.");
  });
  it("explains neither", () => {
    expect(statusFor({ gps: false, dateSource: "file", match: null, lookupFailed: false }))
      .toBe("No location or date in this photo's data. Tap the caption lines to type them.");
    expect(statusFor({ gps: false, dateSource: "none", match: null, lookupFailed: false }))
      .toBe("No location or date in this photo's data. Tap the caption lines to type them.");
  });
  it("lets a failed lookup win whenever GPS is present", () => {
    for (const dateSource of ["exif", "file", "none"] as const) {
      expect(statusFor({ gps: true, dateSource, match: null, lookupFailed: true }))
        .toBe("Couldn't look up the place. Tap the top line to type it.");
    }
  });
});
