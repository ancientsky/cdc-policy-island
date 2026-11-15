// Original implementation for this project. Not derived from third-party source code.
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const people = readFileSync(new URL("../src/people.js", import.meta.url), "utf8");
if (people.includes("samples: 4")) throw new Error("people.js still has samples: 4");

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

const base = process.env.CDC_PREVIEW || "http://[::1]:4173/";

function fail(message) {
  throw new Error(message);
}

function row(text, name) {
  const line = text.split("\n").find((item) => item.startsWith(name));
  if (!line) fail(`missing ${name}\n${text}`);
  return line.slice(name.length).trim();
}

function parse(text) {
  const webgl = row(text, "webgl");
  const dpr = row(text, "dpr");
  const buffer = row(text, "buffer");
  const tierLine = row(text, "tier");
  const antialias = /antialias:(true|false)/.exec(webgl)?.[1];
  const pixel = Number(/pixel\s+([0-9.]+)/.exec(dpr)?.[1]);
  const width = Number(/^(\d+)/.exec(buffer)?.[1]);
  const tier = /tier=([a-z]+)/.exec(tierLine)?.[1];
  const device = /device=([a-z]+)/.exec(tierLine)?.[1];
  const samples = Number(/samples=(\d+)/.exec(tierLine)?.[1]);
  const kinds = (/kinds=([^\s]+)/.exec(tierLine)?.[1] || "").split(",").filter(Boolean);
  if (!antialias || !Number.isFinite(pixel) || !Number.isFinite(width) || !tier || !device || !Number.isFinite(samples)) {
    fail(`unparsed panel\n${text}`);
  }
  return { antialias, pixel, width, tier, device, samples, kinds, text };
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

async function open(browser, contextOptions, { powervr = false } = {}) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", {
      configurable: true,
      get() { return 8; },
    });
  });
  if (powervr) {
    await context.addInitScript(() => {
      const orig = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function getParameter(pname) {
        if (pname === 0x9246) return "ANGLE (Imagination Technologies, PowerVR D-Series DXT-48-1536, OpenGL ES 3.2)";
        return orig.call(this, pname);
      };
    });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  return { context, page };
}

async function panel(page) {
  await page.goto(`${base}?debug=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const text = document.querySelector("#dbg-text")?.textContent || "";
    return text.includes("kinds=render") && text.includes("draw=true");
  }, null, { timeout: 90000 });
  return parse(await page.locator("#dbg-text").innerText());
}

const phone = {
  viewport: { width: 997, height: 448 },
  screen: { width: 997, height: 448 },
  deviceScaleFactor: 3,
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
const narrow = {
  viewport: { width: 900, height: 700 },
  screen: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  hasTouch: false,
  isMobile: false,
};

await runBuild();
const preview = await ensurePreview();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const fragile = await open(browser, phone, { powervr: true });
  const fragileInfo = await panel(fragile.page);
  if (fragileInfo.antialias !== "false") fail(`fragile antialias ${fragileInfo.antialias}`);
  if (fragileInfo.width <= 0 || fragileInfo.width > 997) fail(`fragile buffer width ${fragileInfo.width}`);
  if (fragileInfo.tier !== "lite" || fragileInfo.device !== "fragile") fail(`fragile tier\n${fragileInfo.text}`);
  if (fragileInfo.kinds.includes("gtao") || fragileInfo.kinds.includes("tilt-h")) fail(`fragile kinds ${fragileInfo.kinds.join(",")}`);
  console.log("fragile landscape passed");
  await fragile.context.close();

  const plain = await open(browser, phone);
  const plainInfo = await panel(plain.page);
  if (plainInfo.antialias !== "false") fail(`phone antialias ${plainInfo.antialias}`);
  if (!(plainInfo.pixel <= 1.5)) fail(`phone pixelRatio ${plainInfo.pixel}`);
  if (plainInfo.tier !== "lite" || plainInfo.device !== "phone") fail(`phone class ${plainInfo.tier} ${plainInfo.device}`);
  if (plainInfo.kinds.includes("gtao") || plainInfo.kinds.includes("tilt-h")) fail(`phone kinds ${plainInfo.kinds.join(",")}`);
  console.log("phone landscape passed");
  await plain.context.close();

  const full = await open(browser, desktop);
  const fullInfo = await panel(full.page);
  if (fullInfo.tier !== "full" || fullInfo.device !== "desktop") fail(`desktop tier ${fullInfo.tier} ${fullInfo.device}`);
  if (!fullInfo.kinds.includes("gtao") || fullInfo.samples !== 4) fail(`desktop post ${fullInfo.kinds.join(",")} samples=${fullInfo.samples}`);
  if (fullInfo.antialias !== "true") fail(`desktop antialias ${fullInfo.antialias}`);
  console.log("desktop full passed");
  await full.context.close();

  const slim = await open(browser, narrow);
  const slimInfo = await panel(slim.page);
  if (slimInfo.tier !== "lite" || slimInfo.device !== "desktop") fail(`narrow tier ${slimInfo.tier} ${slimInfo.device}`);
  if (slimInfo.kinds.includes("gtao") || slimInfo.kinds.includes("tilt-h")) fail(`narrow kinds ${slimInfo.kinds.join(",")}`);
  console.log("desktop narrow passed");
  await slim.context.close();

  console.log("device class checks passed");
} finally {
  await browser.close();
  if (preview) preview.kill();
}
