// Original implementation for this project. Not derived from third-party source code.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
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

const base = process.env.CDC_PREVIEW || "http://[::1]:4173/";

function fail(message) {
  throw new Error(message);
}

function row(text, name) {
  const line = text.split("\n").find((item) => item.startsWith(name));
  if (!line) fail(`missing ${name}\n${text}`);
  return line.slice(name.length).trim();
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

async function open(browser, contextOptions, { priv = false } = {}) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", {
      configurable: true,
      get() { return 8; },
    });
  });
  if (priv) {
    await context.addInitScript(() => {
      const deny = (method) => {
        const orig = Storage.prototype[method];
        Storage.prototype[method] = function denied(...args) {
          if (this === localStorage) throw new Error("private");
          return orig.apply(this, args);
        };
      };
      deny("getItem");
      deny("setItem");
      deny("removeItem");
    });
  } else {
    await context.addInitScript(() => {
      window.__gfxWrites = [];
      window.__draws = 0;
      window.__shadowSources = 0;
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (key === "cdc-island-gfx-v1") window.__gfxWrites.push({ value, draws: window.__draws });
        return set.call(this, key, value);
      };
      const countDraw = () => { window.__draws += 1; };
      const elements = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function drawElements(...args) {
        countDraw();
        return elements.apply(this, args);
      };
      const arrays = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function drawArrays(...args) {
        countDraw();
        return arrays.apply(this, args);
      };
      const source = WebGL2RenderingContext.prototype.shaderSource;
      WebGL2RenderingContext.prototype.shaderSource = function shaderSource(shader, code) {
        if (typeof code === "string" && code.includes("#define USE_SHADOWMAP")) window.__shadowSources += 1;
        return source.call(this, shader, code);
      };
    });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  return { context, page };
}

async function panel(page) {
  await page.waitForFunction(() => {
    const text = document.querySelector("#dbg-text")?.textContent || "";
    return text.includes("rung=") && !text.includes("讀取中");
  }, null, { timeout: 90000 });
  return page.locator("#dbg-text").innerText();
}

function qualityOf(text) {
  return row(text, "quality");
}

async function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("cdc-island-gfx-v1")));
}

async function setPending(page, pending) {
  await page.evaluate((next) => {
    const data = JSON.parse(localStorage.getItem("cdc-island-gfx-v1"));
    data.pending = next;
    data.ok = null;
    localStorage.setItem("cdc-island-gfx-v1", JSON.stringify(data));
  }, pending);
}

await runBuild();
const preview = await ensurePreview();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const fresh = await open(browser, phone);
  const stepped = [];
  fresh.page.on("console", (msg) => {
    if (msg.type() === "error") stepped.push(msg.text());
  });
  await fresh.page.goto(`${base}?debug=1`, { waitUntil: "domcontentloaded" });
  await fresh.page.waitForFunction(() => (window.__gfxWrites || []).length > 0, null, { timeout: 90000 });
  const first = await fresh.page.evaluate(() => window.__gfxWrites[0]);
  const firstData = JSON.parse(first.value);
  if (first.draws !== 0) fail(`pending was written after ${first.draws} draws`);
  if (!firstData.pending || firstData.pending !== firstData.rung) fail(`first record ${first.value}`);
  await fresh.page.waitForFunction(() => {
    const data = JSON.parse(localStorage.getItem("cdc-island-gfx-v1") || "null");
    return data && data.pending === null && data.ok === data.rung;
  }, null, { timeout: 25000 });
  const proven = await stored(fresh.page);
  if (proven.ok !== proven.rung) fail(`ok ${proven.ok} rung ${proven.rung}`);
  console.log("pending clears after a steady run");

  await setPending(fresh.page, "full");
  await fresh.page.reload({ waitUntil: "domcontentloaded" });
  const noshadowText = await panel(fresh.page);
  const noshadow = qualityOf(noshadowText);
  const shadows = await fresh.page.evaluate(() => window.__shadowSources);
  if (!noshadow.includes("rung=noshadow") || !noshadow.includes("shadow=false")) fail(noshadow);
  if (!noshadow.includes("visible=true") || !/contacts=[1-9]/.test(noshadow)) fail(noshadow);
  if (shadows !== 0) fail(`USE_SHADOWMAP sources ${shadows}`);
  if (!row(noshadowText, "shadow").startsWith("false")) fail(row(noshadowText, "shadow"));
  if (!stepped.some((line) => line.includes("quality: stepped down from full (page died while pending)"))) {
    fail(`missing step log\n${stepped.join("\n")}`);
  }
  console.log("pending full steps to noshadow");

  await setPending(fresh.page, "noshadow");
  await fresh.page.reload({ waitUntil: "domcontentloaded" });
  const nopostText = await panel(fresh.page);
  const nopost = qualityOf(nopostText);
  if (!nopost.includes("rung=nopost") || !row(nopostText, "tier").includes("draw=false")) fail(`${nopost}\n${row(nopostText, "tier")}`);
  console.log("pending noshadow steps to nopost");

  await setPending(fresh.page, "nopost");
  await fresh.page.reload({ waitUntil: "domcontentloaded" });
  const rescueText = await panel(fresh.page);
  const rescue = qualityOf(rescueText);
  const cssWidth = Number(/^(\d+)/.exec(row(rescueText, "css"))?.[1]);
  const bufferWidth = Number(/^(\d+)/.exec(row(rescueText, "buffer"))?.[1]);
  const pixel = Number(/pixel\s+([0-9.]+)/.exec(row(rescueText, "dpr"))?.[1]);
  if (!rescue.includes("rung=rescue")) fail(rescue);
  if (pixel !== 1 || !cssWidth || cssWidth !== bufferWidth) fail(`rescue pixel ${pixel} css ${cssWidth} buffer ${bufferWidth}`);
  console.log("pending nopost steps to rescue");
  await fresh.context.close();

  const crashes = await open(browser, phone);
  await crashes.page.goto(`${base}?debug=1`, { waitUntil: "domcontentloaded" });
  async function waitRung(page) {
    await page.waitForFunction(() => {
      const data = JSON.parse(localStorage.getItem("cdc-island-gfx-v1") || "null");
      return data && data.pending === data.rung;
    }, null, { timeout: 90000 });
    return page.evaluate(() => JSON.parse(localStorage.getItem("cdc-island-gfx-v1")).rung);
  }
  async function lose(page) {
    const loaded = page.waitForEvent("load", { timeout: 12000 }).then(() => "load").catch(() => "stay");
    await page.evaluate(() => {
      const gl = document.querySelector("#c").getContext("webgl2");
      const ext = gl && gl.getExtension("WEBGL_lose_context");
      if (!ext) throw new Error("missing WEBGL_lose_context");
      ext.loseContext();
    }).catch(() => {});
    return loaded;
  }
  const firstRung = await waitRung(crashes.page);
  if ((await lose(crashes.page)) !== "load") fail("first loss did not reload");
  const secondRung = await waitRung(crashes.page);
  if (secondRung === firstRung) fail(`rung stayed ${secondRung}`);
  if ((await lose(crashes.page)) !== "load") fail("second loss did not reload");
  const thirdRung = await waitRung(crashes.page);
  if (thirdRung === secondRung) fail(`second rung stayed ${thirdRung}`);
  await crashes.page.evaluate(() => { window.__alive = 1; });
  if ((await lose(crashes.page)) !== "stay") fail("third loss reloaded");
  const alive = await crashes.page.evaluate(() => window.__alive).catch(() => 0);
  if (alive !== 1) fail("third loss left the page");
  await crashes.page.waitForFunction(() => {
    const card = document.querySelector("#gl-lost");
    return card && !card.hidden;
  }, null, { timeout: 20000 });
  console.log("unproven loss reloads twice then stays on the card");
  await crashes.context.close();

  const steady = await open(browser, phone);
  await steady.page.goto(`${base}?debug=1`, { waitUntil: "domcontentloaded" });
  await steady.page.waitForFunction(() => {
    const data = JSON.parse(localStorage.getItem("cdc-island-gfx-v1") || "null");
    return data && data.pending === null && data.ok === data.rung;
  }, null, { timeout: 25000 });
  const before = await stored(steady.page);
  await steady.page.evaluate(() => { window.__alive = 1; });
  const ext = await steady.page.evaluate(() => {
    const gl = document.querySelector("#c").getContext("webgl2");
    const lose = gl && gl.getExtension("WEBGL_lose_context");
    if (!lose) return false;
    window.__loseExt = lose;
    lose.loseContext();
    return true;
  });
  if (!ext) fail("could not lose a proven context");
  await steady.page.waitForTimeout(400);
  if ((await steady.page.evaluate(() => window.__alive)) !== 1) fail("proven loss reloaded");
  await steady.page.evaluate(() => window.__loseExt.restoreContext());
  await steady.page.waitForFunction(() => {
    const text = document.querySelector("#dbg-text")?.textContent || "";
    return /lost\s+false/.test(text);
  }, null, { timeout: 8000 });
  const after = await stored(steady.page);
  if (after.rung !== before.rung || after.ok !== before.ok) fail(`proven rung changed ${before.rung}/${before.ok} -> ${after.rung}/${after.ok}`);
  console.log("proven loss restores without stepping down");
  await steady.context.close();

  const desk = await open(browser, desktop);
  await desk.page.goto(`${base}?debug=1`, { waitUntil: "domcontentloaded" });
  const deskText = await panel(desk.page);
  const deskQuality = qualityOf(deskText);
  const tier = row(deskText, "tier");
  if (!deskQuality.includes("rung=full") || !deskQuality.includes("visible=false")) fail(deskQuality);
  if (!tier.includes("tier=full") || !tier.includes("gtao") || !tier.includes("samples=4")) fail(tier);
  console.log("desktop full keeps the current tier and hides contact discs");
  await desk.context.close();

  const hidden = await open(browser, phone, { priv: true });
  await hidden.page.goto(`${base}?debug=1`, { waitUntil: "domcontentloaded" });
  const hiddenText = await panel(hidden.page);
  if (!qualityOf(hiddenText).includes("rung=full")) fail(qualityOf(hiddenText));
  console.log("private storage still draws");
  await hidden.context.close();

  console.log("quality ladder checks passed");
} finally {
  await browser.close();
  if (preview) preview.kill();
}
