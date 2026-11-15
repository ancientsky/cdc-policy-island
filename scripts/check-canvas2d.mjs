// Original implementation for this project. Not derived from third-party source code.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const cdcPw = pathToFileURL("C:/Users/ancie/AppData/Local/Temp/cdc-pw/package.json");
const require = createRequire(cdcPw);

let chromium;
try {
  const pw = await import("playwright");
  chromium = pw.chromium || pw.default?.chromium;
} catch {
  const pw = await import(pathToFileURL(require.resolve("playwright")).href);
  chromium = pw.chromium || pw.default?.chromium;
}
const { PNG } = require("pngjs");

const base = process.env.CDC_PREVIEW || "http://[::1]:4173/";

function fail(message) {
  throw new Error(message);
}

function walk(dir, hit) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, hit);
    else if (name.endsWith(".js") || name.endsWith(".mjs")) {
      const text = readFileSync(path, "utf8");
      if (text.includes('getContext("2d"') || text.includes("getContext('2d'")) hit.push(path);
    }
  }
}

const callers = [];
walk("src", callers);
if (callers.length !== 1 || !callers[0].endsWith("canvas2d.js")) {
  fail(`2d contexts should live in canvas2d.js, found ${callers.join(", ") || "none"}`);
}
console.log("getContext 2d stays in canvas2d.js");

function cropMean(buf) {
  const png = PNG.sync.read(buf);
  const x0 = Math.floor(png.width * 0.35);
  const x1 = Math.floor(png.width * 0.65);
  const y0 = Math.floor(png.height * 0.35);
  const y1 = Math.floor(png.height * 0.65);
  let r = 0;
  let g = 0;
  let b = 0;
  let dark = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      const i = (png.width * y + x) << 2;
      const rr = png.data[i];
      const gg = png.data[i + 1];
      const bb = png.data[i + 2];
      r += rr;
      g += gg;
      b += bb;
      if (rr + gg + bb < 36) dark += 1;
      n += 1;
    }
  }
  return {
    r: Math.round(r / n),
    g: Math.round(g / n),
    b: Math.round(b / n),
    dark: dark / n,
  };
}

function luma(sample) {
  return 0.2126 * sample.r + 0.7152 * sample.g + 0.0722 * sample.b;
}

function gap(a, b) {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

async function runBuild() {
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build"], { shell: true, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`build exited ${code}`))));
  });
}

async function previewUp() {
  try {
    const response = await fetch(base, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensurePreview() {
  if (await previewUp()) return null;
  const child = spawn("npm", ["run", "preview"], { shell: true, stdio: "inherit" });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await previewUp()) return child;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  child.kill();
  fail("preview did not start");
  return null;
}

const phone = {
  viewport: { width: 448, height: 997 },
  screen: { width: 448, height: 997 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
};
const desktop = {
  viewport: { width: 1440, height: 900 },
  screen: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  hasTouch: false,
  isMobile: false,
};

async function open(browser, options) {
  const context = await browser.newContext(options);
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", {
      configurable: true,
      get() { return 8; },
    });
    const orig = HTMLCanvasElement.prototype.getContext;
    window.__cpu2d = [];
    HTMLCanvasElement.prototype.getContext = function getContext(type, attrs) {
      if (type === "2d") window.__cpu2d.push(Boolean(attrs && attrs.willReadFrequently));
      return orig.call(this, type, attrs);
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  return { context, page };
}

async function ready(page) {
  await page.waitForFunction(() => {
    const data = JSON.parse(localStorage.getItem("cdc-island-gfx-v1") || "null");
    return data && data.pending === null && data.ok === data.rung;
  }, null, { timeout: 30000 });
}

async function sample(page) {
  const buf = await page.locator("#c").screenshot({ type: "png" });
  return cropMean(buf);
}

function expectPicture(name, sample) {
  const y = luma(sample);
  if (y < 25 || y > 235) fail(`${name} luma ${y.toFixed(1)} ${JSON.stringify(sample)}`);
  if (sample.dark > 0.35) fail(`${name} dark ${sample.dark}`);
}

// Center crops on cdad088, before this canvas change. Same viewport and scale as below.
const baseline = {
  phoneIsland: { r: 113, g: 156, b: 151 },
  phoneOverview: { r: 93, g: 132, b: 111 },
  desktopOverview: { r: 83, g: 127, b: 108 },
};

function near(name, sample, expect) {
  expectPicture(name, sample);
  const delta = gap(sample, expect);
  if (delta > 8) fail(`${name} left the previous crop by ${delta} ${JSON.stringify(sample)}`);
}

await runBuild();
const preview = await ensurePreview();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const island = await open(browser, phone);
  await island.page.goto(`${base}?debug=1&quiet=1#island=dengue`, { waitUntil: "domcontentloaded" });
  await ready(island.page);
  const cpu = await island.page.evaluate(() => window.__cpu2d);
  if (!Array.isArray(cpu) || cpu.length !== 18 || cpu.some((flag) => !flag)) {
    fail(`cpu canvases ${JSON.stringify(cpu)}`);
  }
  const before = await sample(island.page);
  near("phone island before", before, baseline.phoneIsland);
  await island.page.evaluate(() => { window.__alive = 1; });
  const lost = await island.page.evaluate(() => {
    const gl = document.querySelector("#c").getContext("webgl2");
    const ext = gl && gl.getExtension("WEBGL_lose_context");
    if (!ext) return false;
    window.__loseExt = ext;
    ext.loseContext();
    return true;
  });
  if (!lost) fail("WEBGL_lose_context is missing");
  await island.page.waitForTimeout(400);
  if ((await island.page.evaluate(() => window.__alive)) !== 1) fail("proven loss reloaded");
  await island.page.evaluate(() => window.__loseExt.restoreContext());
  await island.page.waitForFunction(() => {
    const card = document.querySelector("#gl-lost");
    const canvas = document.querySelector("#c");
    return card && card.hidden && canvas && canvas.dataset.glLost !== "1";
  }, null, { timeout: 8000 });
  await island.page.waitForTimeout(1500);
  const after = await sample(island.page);
  expectPicture("phone island after", after);
  const delta = gap(before, after);
  if (after.dark > 0.05 || after.g < 120 || delta > 24) {
    fail(`phone island shifted ${delta} ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  }
  console.log("phone island restore", JSON.stringify({ before, after, delta, cpu: cpu.length }));
  await island.context.close();

  for (const [name, options] of [["phoneOverview", phone], ["desktopOverview", desktop]]) {
    const view = await open(browser, options);
    await view.page.goto(`${base}?debug=1&quiet=1`, { waitUntil: "domcontentloaded" });
    await ready(view.page);
    const shot = await sample(view.page);
    near(name, shot, baseline[name]);
    console.log(name, JSON.stringify(shot));
    await view.context.close();
  }

  console.log("canvas2d checks passed");
} finally {
  await browser.close();
  if (preview) preview.kill();
}
