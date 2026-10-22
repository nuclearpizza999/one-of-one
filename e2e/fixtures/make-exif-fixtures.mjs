// Writes three JPEG fixtures with real EXIF for the metadata tests: flat colour
// with a white diagonal rendered by Chromium, then EXIF embedded with piexifjs.
// Run from the repo root: npm run fixtures
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import piexif from "piexifjs";

const out = path.resolve("apps/web/public/dev");
mkdirSync(out, { recursive: true });

// EXIF dates are wall-clock at capture with no zone.
const DATE = "2026:07:01 14:30:00";
const SEOUL = { lat: 37.5563, lng: 126.9236 };
const APPLE = { make: "Apple", model: "iPhone 15 Pro" };
const FUJI = { make: "FUJIFILM", model: "X100VI" };

function gpsIfd({ lat, lng }) {
  return {
    [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? "N" : "S",
    [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(Math.abs(lat)),
    [piexif.GPSIFD.GPSLongitudeRef]: lng >= 0 ? "E" : "W",
    [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(Math.abs(lng)),
  };
}

async function renderJpeg(page, w, h, rgb) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<html><body style="margin:0;background:rgb(${rgb.join(",")})">` +
      `<svg width="${w}" height="${h}" style="display:block"><line x1="0" y1="0" x2="${w}" y2="${h}" stroke="#fff" stroke-width="12"/></svg>` +
      `</body></html>`,
  );
  return page.screenshot({ type: "jpeg", quality: 90 });
}

function withExif(jpegBuffer, { orientation, date, gps, camera }) {
  const exif = { "0th": {}, Exif: {} };
  if (orientation) exif["0th"][piexif.ImageIFD.Orientation] = orientation;
  if (camera) {
    exif["0th"][piexif.ImageIFD.Make] = camera.make;
    exif["0th"][piexif.ImageIFD.Model] = camera.model;
  }
  if (date) exif.Exif[piexif.ExifIFD.DateTimeOriginal] = date;
  if (gps) exif.GPS = gpsIfd(gps);
  const bytes = piexif.dump(exif);
  return Buffer.from(piexif.insert(bytes, jpegBuffer.toString("binary")), "binary");
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const fixtures = [
  { name: "seoul", w: 900, h: 1200, rgb: [96, 120, 160], exif: { date: DATE, gps: SEOUL, camera: APPLE } },
  { name: "nogps", w: 900, h: 1200, rgb: [160, 110, 110], exif: { date: DATE, camera: FUJI } },
  // Stored landscape with Orientation 6 (rotate 90° clockwise to display): shows as 900 × 1200 portrait.
  { name: "rotated", w: 1200, h: 900, rgb: [110, 150, 110], exif: { date: DATE, gps: SEOUL, orientation: 6, camera: APPLE } },
];
for (const f of fixtures) {
  const jpeg = await renderJpeg(page, f.w, f.h, f.rgb);
  writeFileSync(path.join(out, `${f.name}.jpg`), withExif(jpeg, f.exif));
  console.log(`${f.name}.jpg ${f.w}x${f.h}${f.exif.orientation ? ` orientation ${f.exif.orientation}` : ""}`);
}
await browser.close();
