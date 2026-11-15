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
const phone = {
  viewport: { width: 448, height: 997 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
};
const fields = ["build", "ua", "gpu", "fragileGpu", "webgl", "dpr", "css", "buffer", "caps", "tier", "shadow", "programs", "draws", "lost", "quality", "errors"];

function fail(message) {
  throw new Error(message);
}

function field(text, name) {
  const row = text.split("\n").find((line) => line.startsWith(name));
  if (!row) fail(`missing ${name}\n${text}`);
  const value = row.slice(name.length).trim();
  if (!value) fail(`empty ${name}\n${text}`);
  return value;
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

async function open(browser, options = {}) {
  const context = await browser.newContext(phone);
  await context.addInitScript(() => {
    window.__revealed = false;
    document.addEventListener("cdc-revealed", () => {
      window.__revealed = true;
    });
  });
  if (options.powervr) {
    await context.addInitScript(() => {
      const orig = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function getParameter(pname) {
        if (pname === 0x9246) return "ANGLE (Imagination Technologies, PowerVR D-Series DXT-48-1536, OpenGL ES 3.2)";
        return orig.call(this, pname);
      };
    });
  }
  const page = await context.newPage();
  const urls = [];
  page.on("request", (request) => urls.push(request.url()));
  page.setDefaultTimeout(90000);
  return { context, page, urls };
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
    if (!window.__loseExt) return false;
    window.__loseExt.restoreContext();
    return true;
  });
  if (!ok) fail("could not restore");
}

await runBuild();
const preview = await ensurePreview();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const shown = await open(browser);
  await shown.page.goto(`${base}?debug=1`, { waitUntil: "domcontentloaded" });
  await shown.page.waitForFunction(() => {
    const text = document.querySelector("#dbg-text")?.textContent || "";
    return text.includes("fragileGpu") && !text.includes("讀取中");
  }, null, { timeout: 90000 });
  const text = await shown.page.locator("#dbg-text").innerText();
  for (const name of fields) field(text, name);
  if (!field(text, "build").startsWith("dev")) fail(`build id ${field(text, "build")}`);
  if (!field(text, "quality").startsWith("rung=")) fail("quality should name a rung");
  await shown.context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await shown.page.locator("#dbg-copy").click();
  const copied = await shown.page.evaluate(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  });
  const copyLabel = await shown.page.locator("#dbg-copy").innerText();
  if (!copied.includes("build") && copyLabel !== "請長按複製") fail(`copy failed ${copyLabel}`);
  await shown.page.waitForFunction(() => {
    const row = (document.querySelector("#dbg-text")?.textContent || "").split("\n").find((line) => line.startsWith("quality"));
    return row && row.includes("pending=null") && !row.includes("ok=null");
  }, null, { timeout: 25000 });
  await lose(shown.page);
  await shown.page.waitForFunction(() => {
    const row = (document.querySelector("#dbg-text")?.textContent || "").split("\n").find((line) => line.startsWith("lost"));
    return row && row.includes("true");
  }, null, { timeout: 3000 });
  const lostText = await shown.page.locator("#dbg-text").innerText();
  const errorPart = lostText.split("\n").filter((line) => line.startsWith("errors") || line.startsWith("- ")).join("\n");
  if (/shader error/i.test(errorPart)) fail(`shader misreport\n${errorPart}`);
  await restore(shown.page);
  await shown.page.waitForFunction(() => {
    const row = (document.querySelector("#dbg-text")?.textContent || "").split("\n").find((line) => line.startsWith("lost"));
    return row && row.includes("false");
  }, null, { timeout: 3000 });
  await shown.context.close();
  console.log("debug panel fields, copy, and context loss passed");

  const gpu = await open(browser, { powervr: true });
  await gpu.page.goto(`${base}?debug=1`, { waitUntil: "domcontentloaded" });
  await gpu.page.waitForFunction(() => (document.querySelector("#dbg-text")?.textContent || "").includes("fragileGpu"), null, { timeout: 90000 });
  const gpuText = await gpu.page.locator("#dbg-text").innerText();
  if (field(gpuText, "fragileGpu") !== "true") fail(`fragileGpu ${field(gpuText, "fragileGpu")}\n${gpuText}`);
  if (!field(gpuText, "shadow").startsWith("false")) fail(`shadow ${field(gpuText, "shadow")}`);
  if (!field(gpuText, "programs").includes("USE_SHADOWMAP=0")) fail(field(gpuText, "programs"));
  if (!field(gpuText, "gpu").includes("PowerVR")) fail(field(gpuText, "gpu"));
  await gpu.context.close();
  console.log("fake PowerVR panel passed");

  const plain = await open(browser);
  await plain.page.goto(base, { waitUntil: "domcontentloaded" });
  await plain.page.waitForFunction(() => window.__revealed === true, null, { timeout: 90000 });
  const debugUrl = (url) => /debug-[^/]+\.js/.test(url) || url.includes("/src/debug.js");
  if (plain.urls.some(debugUrl)) fail(`debug chunk loaded early ${plain.urls.filter(debugUrl).join(" ")}`);
  await plain.page.locator("#brand-title").dispatchEvent("pointerdown", { pointerId: 1, button: 0, clientX: 30, clientY: 20 });
  await plain.page.waitForTimeout(200);
  await plain.page.locator("#brand-title").dispatchEvent("pointerup", { pointerId: 1, button: 0, clientX: 30, clientY: 20 });
  await plain.page.waitForTimeout(1400);
  if (await plain.page.locator("#dbg").count()) fail("a short press opened the panel");
  if (plain.urls.some(debugUrl)) fail("a short press downloaded the debug chunk");
  await plain.page.locator("#brand-title").dispatchEvent("pointerdown", { pointerId: 2, button: 0, clientX: 30, clientY: 20 });
  await plain.page.waitForSelector("#dbg", { timeout: 4000 });
  if (!plain.urls.some(debugUrl)) fail("long press did not download the debug chunk");
  await plain.context.close();
  console.log("long press and quiet network passed");
  console.log("debug checks passed");
} finally {
  await browser.close();
  if (preview) preview.kill();
}
