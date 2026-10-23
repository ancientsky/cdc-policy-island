import "./style.css";

const serifFont = new URL("./fonts/NotoSerifTC-Bold.subset.woff2", import.meta.url);
const preloadFont = document.createElement("link");
preloadFont.rel = "preload";
preloadFont.as = "font";
preloadFont.type = "font/woff2";
preloadFont.crossOrigin = "anonymous";
preloadFont.href = serifFont.href;
document.head.appendChild(preloadFont);
import { flows, islands, validate } from "./data.js";
import { assertHexFrame } from "./hex.js";
import { applyLocale, savedLang, t } from "./i18n.js";
import { createScene } from "./scene.js";
import { mount } from "./ui.js";

assertHexFrame();
validate();
applyLocale(savedLang());

const canvas = document.querySelector("#c");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const veil = document.querySelector("#veil");

function fallbackScene() {
  const noop = () => {};
  return {
    tick: noop,
    resize: noop,
    setMinutes: noop,
    setPhase: noop,
    setPillars: noop,
    setQuery: noop,
    focusIslands: noop,
    overview: noop,
    setShowAllFlows: noop,
    setFreeze: noop,
    setBird: noop,
    isBird: () => false,
    setNames: noop,
    setCargo: noop,
    setHotItem: noop,
    onPick: noop,
    onArrive: noop,
    getTheta: () => 0,
    setSafeRect: noop,
    relabel: noop,
    selfTest: () => [t("fallback")],
    debugState: () => ({ flows: 0, lit: [] }),
  };
}

let scene;
try {
  scene = createScene(canvas, { islands, flows }, { reduced });
} catch (error) {
  console.error(error);
  document.body.classList.add("no-webgl");
  scene = fallbackScene();
  veil.remove();
  const note = document.querySelector("#hero-lead");
  if (note) note.textContent = t("fallback");
}

const ui = mount({ scene, islands, flows });
window.addEventListener("resize", () => scene.resize());

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ui.tick(dt);
  scene.tick(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

if (!document.body.classList.contains("no-webgl")) {
  setTimeout(() => veil?.remove(), reduced ? 0 : 900);
}
requestAnimationFrame(() => scene.resize());
setTimeout(() => {
  const errors = scene.selfTest();
  const info = scene.debugState();
  const diag = document.querySelector("#diag");
  diag.textContent = `${errors.length ? errors.join("\n") : "PASS"}\nflows=${info.flows} lit=${info.lit.join(",")}`;
  if (errors.length) diag.hidden = false;
}, 1800);
