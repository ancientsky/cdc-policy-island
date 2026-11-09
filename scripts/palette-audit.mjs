// Counts sRGB HSL of #RRGGBB and 0xRRGGBB literals in the 3D sources.
// The word boundary keeps an 8-digit hash seed from being read as a 6-digit color.
// UI css and ui.js are not scanned.
// Anchors listed below stay dark on purpose. The script prints the full set and the set with those anchors removed.
import { readFileSync, readdirSync } from "fs";

const files = readdirSync("src").filter((name) => /^(palette|scene|decor|kit|data|environment|life|people|post)\.js$/.test(name));

function hsl(hex) {
  const n = Number.parseInt(hex, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);
  return { s, l };
}

// Night sky, night sea, and the night ridge tint. Not used as noon materials.
const NIGHT = new Set([
  "070d18", "071a2b", "141c26", "0f1c2e", "12384a", "1b2a44", "1e3050", "24344c",
  "070b12", "07141c", "0c1e28", "241810", "121a24", "1a1424", "162230", "1c2834",
]);
// h:5 pre-dawn sky anchors and h:18.67 evening sky anchors, plus the evening paper.
const DUSK = new Set([
  "2a2440", "2a2026", "1a2232",
  "3a2a3a", "2a2f4a",
  "2a203a",
]);

function summarize(rows) {
  const s = rows.map((row) => row.s).sort((a, b) => a - b);
  const l = rows.map((row) => row.l).sort((a, b) => a - b);
  const mid = (arr) => arr[Math.floor(arr.length / 2)] ?? 0;
  const n = rows.length || 1;
  return {
    n: rows.length,
    sMedian: Number(mid(s).toFixed(3)),
    sOver06: Number((rows.filter((row) => row.s > 0.6).length / n).toFixed(3)),
    lMedian: Number(mid(l).toFixed(3)),
    lUnder025: Number((rows.filter((row) => row.l < 0.25).length / n).toFixed(3)),
    dark: rows.filter((row) => row.l < 0.25).length,
  };
}

const rows = [];
for (const file of files) {
  const text = readFileSync(`src/${file}`, "utf8");
  for (const match of text.matchAll(/(?:#|0x)([0-9a-fA-F]{6})\b/g)) {
    const hex = match[1].toLowerCase();
    const kind = NIGHT.has(hex) ? "night" : DUSK.has(hex) ? "dusk" : "";
    rows.push({ file, hex, kind, ...hsl(hex) });
  }
}
const found = new Set(rows.map((row) => row.hex));
const missing = [...NIGHT, ...DUSK].filter((hex) => !found.has(hex));
const withoutNight = rows.filter((row) => row.kind !== "night");
const dark = [];
const seen = new Set();
for (const row of rows) {
  if (row.l >= 0.25 || seen.has(row.hex)) continue;
  seen.add(row.hex);
  dark.push({ hex: row.hex, kind: row.kind || "kept", l: Number(row.l.toFixed(3)), file: row.file });
}
const perFile = {};
for (const row of rows) perFile[row.file] = (perFile[row.file] ?? 0) + 1;
console.log(JSON.stringify({
  perFile,
  missing,
  all: summarize(rows),
  withoutNight: summarize(withoutNight),
  dark,
}, null, 2));
