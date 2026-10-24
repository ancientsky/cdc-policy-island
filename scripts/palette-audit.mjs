// Counts sRGB HSL of #RRGGBB literals in the 3D sources.
// Night sky stops are included. UI css and ui.js are not.
import { readFileSync, readdirSync } from "fs";

const files = readdirSync("src").filter((name) => /^(palette|scene|decor|kit|data)\.js$/.test(name));

function hsl(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
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

const rows = [];
for (const file of files) {
  const text = readFileSync(`src/${file}`, "utf8");
  for (const match of text.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    rows.push({ file, hex: `#${match[1].toLowerCase()}`, ...hsl(`#${match[1]}`) });
  }
}
const s = rows.map((row) => row.s).sort((a, b) => a - b);
const l = rows.map((row) => row.l).sort((a, b) => a - b);
const mid = (arr) => arr[Math.floor(arr.length / 2)] ?? 0;
const summary = {
  files,
  n: rows.length,
  sMedian: Number(mid(s).toFixed(3)),
  sOver06: Number((rows.filter((row) => row.s > 0.6).length / rows.length).toFixed(3)),
  lMedian: Number(mid(l).toFixed(3)),
  lUnder025: Number((rows.filter((row) => row.l < 0.25).length / rows.length).toFixed(3)),
};
console.log(JSON.stringify(summary, null, 2));
const hot = rows.filter((row) => row.s > 0.6 || row.l < 0.25);
const seen = new Set();
for (const row of hot) {
  const key = `${row.hex} ${row.file}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`${row.file} ${row.hex} S${row.s.toFixed(2)} L${row.l.toFixed(2)}`);
}
