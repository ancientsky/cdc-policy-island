import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const cdcPw = pathToFileURL("C:/Users/ancie/AppData/Local/Temp/cdc-pw/package.json");

let chromium;
try {
  const pw = await import("playwright");
  chromium = pw.chromium || pw.default?.chromium;
} catch {
  const require = createRequire(cdcPw);
  const pw = await import(pathToFileURL(require.resolve("playwright")).href);
  chromium = pw.chromium || pw.default?.chromium;
}

const require = createRequire(cdcPw);
const { PNG } = require("pngjs");

const base = process.env.CDC_URL || "http://[::1]:5173/";

function meanOf(buf) {
  const png = PNG.sync.read(buf);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const step = 24;
  for (let y = 0; y < png.height; y += step) {
    for (let x = 0; x < png.width; x += step) {
      const i = (png.width * y + x) << 2;
      r += png.data[i];
      g += png.data[i + 1];
      b += png.data[i + 2];
      n += 1;
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

function nearWhite(sample) {
  return sample.r > 245 && sample.g > 245 && sample.b > 245;
}

function dist(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function fail(message) {
  throw new Error(message);
}

async function shotMean(page) {
  const buf = await page.locator("#c").screenshot({ type: "png" });
  return meanOf(buf);
}

function watch(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

async function lose(page) {
  const ok = await page.evaluate(() => {
    const gl = document.querySelector("#c").getContext("webgl2");
    const ext = gl && gl.getExtension("WEBGL_lose_context");
    if (!ext) return false;
    window.__loseExt = ext;
    ext.loseContext();
    return true;
  });
  if (!ok) fail("WEBGL_lose_context is missing");
}

async function restore(page) {
  const ok = await page.evaluate(() => {
    const ext = window.__loseExt;
    if (!ext) return false;
    ext.restoreContext();
    return true;
  });
  if (!ok) fail("WEBGL_lose_context restore is missing");
}

async function open(browser, options) {
  const context = await browser.newContext(options);
  await context.addInitScript(() => {
    window.__revealed = false;
    document.addEventListener("cdc-revealed", () => {
      window.__revealed = true;
    });
  });
  if (options.bootLoss) {
    await context.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      let armed = false;
      HTMLCanvasElement.prototype.getContext = function getContext(type, attrs) {
        const gl = orig.call(this, type, attrs);
        if (!armed && gl && String(type).startsWith("webgl")) {
          armed = true;
          const ext = gl.getExtension("WEBGL_lose_context");
          setTimeout(() => {
            try {
              ext?.loseContext();
            } catch {
              /* the context may already be gone */
            }
          }, 50);
        }
        return gl;
      };
    });
  }
  const page = await context.newPage();
  const errors = watch(page);
  page.setDefaultTimeout(90000);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  return { context, page, errors };
}

async function waitReady(page) {
  await page.waitForFunction(() => window.__revealed === true, null, { timeout: 90000 });
  await page.waitForTimeout(4000);
}

async function phoneLoss(browser) {
  const { context, page, errors } = await open(browser, {
    viewport: { width: 448, height: 997 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  await waitReady(page);
  const before = await shotMean(page);
  if (nearWhite(before)) fail(`picture was already white before loss ${JSON.stringify(before)}`);
  await lose(page);
  await page.waitForFunction(() => {
    const card = document.querySelector("#gl-lost");
    const labels = document.querySelector(".labels");
    const body = document.querySelector("#gl-lost-body")?.textContent || "";
    return Boolean(card && card.hidden === false && labels && getComputedStyle(labels).visibility === "hidden" && body.includes("正在試著接回來"));
  }, null, { timeout: 300 });
  await restore(page);
  await page.waitForFunction(() => {
    const card = document.querySelector("#gl-lost");
    const labels = document.querySelector(".labels");
    return Boolean(card && card.hidden === true && labels && getComputedStyle(labels).visibility !== "hidden");
  }, null, { timeout: 3000 });
  await page.waitForTimeout(700);
  const after = await shotMean(page);
  const gap = dist(before, after);
  if (nearWhite(after) || gap > 80) fail(`picture did not match after restore gap=${gap.toFixed(1)} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  const events = await page.evaluate(() => window.__glEvents);
  if (!events || events.length !== 2 || events[0].type !== "lost" || events[1].type !== "restored" || events[0].during !== "play") {
    fail(`expected play lost/restored, got ${JSON.stringify(events)}`);
  }
  await lose(page);
  await page.waitForFunction(() => {
    const body = document.querySelector("#gl-lost-body")?.textContent || "";
    return body.includes("正在試著接回來") && !body.includes("接不回來");
  }, null, { timeout: 300 });
  await page.waitForFunction(() => (document.querySelector("#gl-lost-body")?.textContent || "").includes("接不回來"), null, { timeout: 5500 });
  const stuck = await page.evaluate(() => ({
    hidden: document.querySelector("#gl-lost")?.hidden === true,
    labels: getComputedStyle(document.querySelector(".labels")).visibility,
  }));
  if (stuck.hidden || stuck.labels !== "hidden") fail(`stuck card did not stay up ${JSON.stringify(stuck)}`);
  if (errors.length) fail(`phone pageerror ${errors.join(" | ")}`);
  await context.close();
  console.log("phone loss/restore and 4s copy passed");
}

async function bootLoss(browser) {
  const { context, page, errors } = await open(browser, {
    viewport: { width: 448, height: 997 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    bootLoss: true,
  });
  await page.waitForFunction(() => {
    const card = document.querySelector("#gl-lost");
    const body = document.querySelector("#gl-lost-body")?.textContent || "";
    return Boolean(card && card.hidden === false && body.includes("啟動時畫面中斷"));
  }, null, { timeout: 90000 });
  const state = await page.evaluate(() => ({
    revealed: window.__revealed === true,
    veil: Boolean(document.querySelector("#veil")),
    out: document.querySelector("#veil")?.classList.contains("out") === true,
    text: document.querySelector("#gl-lost-body")?.textContent || "",
  }));
  if (state.revealed || !state.veil || state.out) fail(`boot treated the veil as a successful reveal ${JSON.stringify(state)}`);
  const bootEvents = await page.evaluate(() => window.__glEvents || []);
  const lostBoot = bootEvents.some((event) => event.type === "lost" && event.during === "boot");
  if (!lostBoot) fail(`boot loss was not recorded ${JSON.stringify(bootEvents)}`);
  await page.locator("#gl-lost-list").click();
  await page.waitForFunction(() => document.querySelector("#ledger")?.classList.contains("open") === true, null, { timeout: 3000 });
  await page.locator("#list").click();
  await page.waitForFunction(() => document.querySelector("#ledger")?.classList.contains("open") !== true, null, { timeout: 3000 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }),
    page.locator("#gl-lost-reload").click(),
  ]);
  const hard = errors.filter((item) => !/webgl|context/i.test(item));
  if (hard.length) fail(`boot pageerror ${hard.join(" | ")}`);
  await context.close();
  console.log("boot loss card passed");
}

async function desktop(browser) {
  const { context, page, errors } = await open(browser, {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  });
  await waitReady(page);
  const state = await page.evaluate(() => ({
    hidden: document.querySelector("#gl-lost")?.hidden === true,
    body: document.body.classList.contains("gl-lost"),
    events: window.__glEvents || [],
  }));
  if (!state.hidden || state.body || state.events.length) fail(`desktop card changed ${JSON.stringify(state)}`);
  const picture = await shotMean(page);
  if (nearWhite(picture)) fail(`desktop picture was white ${JSON.stringify(picture)}`);
  await page.waitForTimeout(1000);
  const again = await page.evaluate(() => document.querySelector("#gl-lost")?.hidden === true && !document.body.classList.contains("gl-lost"));
  if (!again) fail("desktop card appeared late");
  if (errors.length) fail(`desktop pageerror ${errors.join(" | ")}`);
  await context.close();
  console.log("desktop stayed clear");
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await phoneLoss(browser);
  await bootLoss(browser);
  await desktop(browser);
  console.log("webgl loss checks passed");
} finally {
  await browser.close();
}
