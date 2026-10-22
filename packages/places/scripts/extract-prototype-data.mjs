// Extracts LANDMARKS and CITIES from prototype/one-of-one.html into JSON.
// Reads the file line by line: line 171 is a single 397 KB line and must not be
// pasted anywhere. Run from the repo root: npm run extract -w packages/places
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const proto = readFileSync(path.join(root, "prototype/one-of-one.html"), "utf8").split("\n");
const outDir = path.resolve(import.meta.dirname, "../data");
mkdirSync(outDir, { recursive: true });

// CITIES: `const CITIES = [[...],...];   // comment`
const cityLine = proto.find((l) => l.startsWith("const CITIES = "));
if (!cityLine) throw new Error("CITIES line not found");
const cityJson = cityLine.replace(/^const CITIES = /, "").replace(/;\s*\/\/.*$/, "").replace(/;\s*$/, "");
const cities = JSON.parse(cityJson);
if (!Array.isArray(cities) || cities.length < 10000) throw new Error(`unexpected city count ${cities.length}`);

// LANDMARKS: the block between `const LANDMARKS = [` and the next `];`
const start = proto.findIndex((l) => l.startsWith("const LANDMARKS = ["));
if (start < 0) throw new Error("LANDMARKS block not found");
const landmarks = [];
for (let i = start + 1; i < proto.length; i += 1) {
  const line = proto[i].trim();
  if (line === "];") break;
  if (!line.startsWith("[")) continue;
  const [name, region, lat, lng, radiusM] = JSON.parse(line.replace(/,\s*$/, ""));
  landmarks.push({ name, region, lat, lng, radiusM });
}
if (landmarks.length !== 28) throw new Error(`unexpected landmark count ${landmarks.length}`);

writeFileSync(path.join(outDir, "cities.json"), JSON.stringify(cities));
writeFileSync(path.join(outDir, "landmarks.json"), JSON.stringify(landmarks, null, 2) + "\n");
console.log(`cities.json ${cities.length} entries, landmarks.json ${landmarks.length} entries`);
