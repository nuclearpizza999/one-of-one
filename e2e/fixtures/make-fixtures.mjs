// Writes three fixture photos for the e2e tests: flat colour plus a white
// diagonal so a photo that is cropped, stretched or shifted is visible in a diff.
// 900 px wide so the card is exactly 1000 px wide (900 / 0.9) and every
// card dimension is a whole number of pixels.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const out = path.resolve("apps/web/public/dev");
mkdirSync(out, { recursive: true });

const fixtures = {
  portrait: { w: 900, h: 1200, rgb: [196, 120, 80] },
  landscape: { w: 900, h: 600, rgb: [80, 140, 196] },
  square: { w: 900, h: 900, rgb: [110, 160, 110] },
};

for (const [name, { w, h, rgb }] of Object.entries(fixtures)) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const onLine = Math.abs(x / w - y / h) < 0.01;
      png.data[i] = onLine ? 255 : rgb[0];
      png.data[i + 1] = onLine ? 255 : rgb[1];
      png.data[i + 2] = onLine ? 255 : rgb[2];
      png.data[i + 3] = 255;
    }
  }
  writeFileSync(path.join(out, `${name}.png`), PNG.sync.write(png));
  console.log(`${name}.png ${w}x${h}`);
}
