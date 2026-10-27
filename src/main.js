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
    onStrike: noop,
    onRepel: noop,
    celebrate: (_list, done) => { if (typeof done === "function") done(); },
    focusPerson: noop,
    clearPersonFocus: noop,
    personInfo: () => null,
    personPortrait: () => "",
    threatInfo: () => null,
    markFlow: noop,
    onMarkFlow: noop,
    playIntro: noop,
    getTheta: () => 0,
    setSafeRect: noop,
    relabel: noop,
    selfTest: () => [t("fallback")],
    debugState: () => ({ flows: 0, lit: [] }),
  };
}

// The list mounts before the 3D chunk arrives. Setters queue until createScene
// resolves; tick and readouts stay live on the fallback so the clock still moves.
let impl = fallbackScene();
let ready = false;
const queued = [];
let pick = () => {};
let arrive = () => {};
const passthrough = new Set(["tick", "resize", "isBird", "getTheta", "selfTest", "debugState"]);
const scene = new Proxy({}, {
  get(_target, key) {
    if (key === "onPick") {
      return (fn) => {
        pick = fn;
        impl.onPick(fn);
      };
    }
    if (key === "onArrive") {
      return (fn) => {
        arrive = fn;
        impl.onArrive(fn);
      };
    }
    return (...args) => {
      if (!ready && !passthrough.has(key)) {
        const index = queued.findIndex((item) => item[0] === key);
        if (index >= 0) queued.splice(index, 1);
        queued.push([key, args]);
        return undefined;
      }
      const fn = impl[key];
      return typeof fn === "function" ? fn.apply(impl, args) : fn;
    };
  },
});

const ui = mount({ scene, islands, flows });
window.addEventListener("resize", () => scene.resize());

let last = performance.now();
let onScreen = true;
let looping = false;

function loop(now) {
  if (!onScreen) {
    looping = false;
    return;
  }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ui.tick(dt);
  scene.tick(dt);
  if (!onScreen) {
    looping = false;
    return;
  }
  requestAnimationFrame(loop);
}

function startLoop() {
  if (looping || !onScreen) return;
  looping = true;
  last = performance.now();
  requestAnimationFrame(loop);
}

const screenWatch = new IntersectionObserver((entries) => {
  onScreen = entries.some((entry) => entry.isIntersecting);
  if (onScreen) startLoop();
});
screenWatch.observe(canvas);
startLoop();

function writeDiag() {
  const errors = scene.selfTest();
  const info = scene.debugState();
  const diag = document.querySelector("#diag");
  if (!diag) return;
  diag.textContent = `${errors.length ? errors.join("\n") : "PASS"}\nflows=${info.flows} lit=${(info.lit ?? []).join(",")}`;
  if (errors.length) diag.hidden = false;
}

function failWebgl(error) {
  console.error(error);
  document.body.classList.add("no-webgl");
  impl = fallbackScene();
  impl.onPick(pick);
  impl.onArrive(arrive);
  ready = true;
  for (const [name, args] of queued.splice(0)) {
    const fn = impl[name];
    if (typeof fn === "function") fn.apply(impl, args);
  }
  veil?.remove();
  const note = document.querySelector("#hero-lead");
  if (note) note.textContent = t("fallback");
  writeDiag();
}

function revealVeil() {
  const startIntro = () => {
    if (veil?.isConnected) veil.remove();
    impl.playIntro();
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!veil) {
        impl.playIntro();
        return;
      }
      if (reduced) {
        startIntro();
        return;
      }
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        startIntro();
      };
      veil.addEventListener("transitionend", (event) => {
        if (event.target !== veil || event.propertyName !== "opacity") return;
        finish();
      });
      veil.classList.add("out");
      setTimeout(finish, 900);
    });
  });
}

async function bootScene() {
  try {
    const { createScene } = await import("./scene.js");
    impl = createScene(canvas, { islands, flows }, { reduced });
    impl.onPick(pick);
    impl.onArrive(arrive);
    for (const [name, args] of queued.splice(0)) impl[name](...args);
    ready = true;
    impl.resize();
    revealVeil();
    setTimeout(writeDiag, 1800);
  } catch (error) {
    failWebgl(error);
  }
}
bootScene();
