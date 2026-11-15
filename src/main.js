import "./errors.js";
import "./style.css";
import { beginSlice, paintFirst } from "./pace.js";
import { bootQuality, requestReload } from "./quality.js";

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
    onDuty: noop,
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
    onContextLoss: () => () => {},
    isLost: () => false,
    diagnostics: () => null,
  };
}

// The list mounts before the 3D chunk arrives. Setters queue until createScene
// resolves; tick and readouts stay live on the fallback so the clock still moves.
let impl = fallbackScene();
let ready = false;
const queued = [];
let pick = () => {};
let arrive = () => {};
const passthrough = new Set(["tick", "resize", "isBird", "getTheta", "selfTest", "debugState", "onContextLoss", "isLost", "diagnostics"]);
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

function canvasInView() {
  const rect = canvas.getBoundingClientRect();
  const viewH = window.innerHeight || 0;
  const viewW = window.innerWidth || 0;
  return rect.width > 2 && rect.height > 2
    && rect.bottom > 0 && rect.right > 0
    && rect.top < viewH && rect.left < viewW;
}

const screenWatch = new IntersectionObserver((entries) => {
  const hit = entries.some((entry) => entry.isIntersecting);
  onScreen = hit || canvasInView();
  if (onScreen) startLoop();
});
screenWatch.observe(canvas);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !canvasInView()) return;
  onScreen = true;
  startLoop();
});
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
  document.dispatchEvent(new CustomEvent("cdc-revealed"));
  const note = document.querySelector("#hero-lead");
  if (note) note.textContent = t("fallback");
  const diag = document.querySelector("#diag");
  if (!diag) return;
  const reason = error instanceof Error ? error.message : "";
  diag.textContent = reason ? `${t("fallback")}\n${reason}` : t("fallback");
  diag.hidden = false;
}

let revealed = false;

function paintLossCard() {
  const card = document.querySelector("#gl-lost");
  if (!card) return;
  const title = document.querySelector("#gl-lost-title");
  const body = document.querySelector("#gl-lost-body");
  const reload = document.querySelector("#gl-lost-reload");
  const list = document.querySelector("#gl-lost-list");
  if (title) title.textContent = t("glLostTitle");
  if (body) {
    const stuck = card.dataset.stuck === "1";
    const boot = card.dataset.mode === "boot";
    body.textContent = stuck ? t("glLostStuck") : (boot ? t("glLostBoot") : t("glLostBody"));
  }
  if (reload) reload.textContent = t("glLostReload");
  if (list) list.textContent = t("glLostList");
}

function showLossCard(mode) {
  const card = document.querySelector("#gl-lost");
  if (!card) return;
  card.dataset.mode = mode;
  card.dataset.stuck = "0";
  card.hidden = false;
  document.body.classList.add("gl-lost");
  paintLossCard();
  window.clearTimeout(showLossCard.timer);
  showLossCard.timer = window.setTimeout(() => {
    if (card.hidden) return;
    const still = canvas.dataset.glLost === "1" || (typeof impl.isLost === "function" && impl.isLost());
    if (!still) return;
    card.dataset.stuck = "1";
    paintLossCard();
  }, 4000);
}

function hideLossCard() {
  const card = document.querySelector("#gl-lost");
  if (card) card.hidden = true;
  document.body.classList.remove("gl-lost");
  window.clearTimeout(showLossCard.timer);
}

document.querySelector("#gl-lost-reload")?.addEventListener("click", () => {
  if (!requestReload()) return;
  location.reload();
});
document.querySelector("#gl-lost-list")?.addEventListener("click", () => {
  document.querySelector("#list")?.click();
});

let revealPending = false;

function contextIsLost() {
  return canvas.dataset.glLost === "1" || (typeof impl.isLost === "function" && impl.isLost());
}

function revealVeil() {
  if (revealed || revealPending) return;
  revealPending = true;
  const startIntro = () => {
    if (revealed) return;
    revealPending = false;
    if (contextIsLost()) {
      if (veil) veil.classList.remove("out");
      showLossCard("boot");
      return;
    }
    revealed = true;
    if (veil?.isConnected) veil.remove();
    document.dispatchEvent(new CustomEvent("cdc-revealed"));
    impl.playIntro();
    setTimeout(writeDiag, 1800);
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (contextIsLost()) {
        revealPending = false;
        if (veil) veil.classList.remove("out");
        showLossCard("boot");
        return;
      }
      if (!veil) {
        startIntro();
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

document.addEventListener("cdc-webgl-failed", (event) => {
  if (document.body.classList.contains("no-webgl")) return;
  if (canvas.dataset.glLost === "1" || (typeof impl.isLost === "function" && impl.isLost())) {
    showLossCard(revealed ? "play" : "boot");
    return;
  }
  const reason = event.detail instanceof Error ? event.detail : new Error("WebGL");
  failWebgl(reason);
});

async function bootScene() {
  try {
    await paintFirst();
    const { createScene } = await import("./scene.js");
    await paintFirst();
    beginSlice();
    const gfxBoot = bootQuality();
    impl = await createScene(canvas, { islands, flows }, { reduced, rescue: gfxBoot.rescue, gfx: gfxBoot });
    impl.onPick(pick);
    impl.onArrive(arrive);
    for (const [name, args] of queued.splice(0)) impl[name](...args);
    impl.onContextLoss((lost) => {
      if (lost) {
        if (!revealed && veil) veil.classList.remove("out");
        showLossCard(revealed ? "play" : "boot");
        return;
      }
      const resume = !revealed;
      hideLossCard();
      if (resume) revealVeil();
    });
    ready = true;
    if (impl.isLost()) {
      showLossCard("boot");
      return;
    }
    impl.resize();
    revealVeil();
  } catch (error) {
    if (canvas.dataset.glLost === "1") {
      console.error(error);
      ready = true;
      showLossCard("boot");
      return;
    }
    failWebgl(error);
  }
}
bootScene();

let debugLoading = null;

function openDebug() {
  if (document.querySelector("#dbg") || debugLoading) return;
  debugLoading = import("./debug.js")
    .then((mod) => {
      debugLoading = null;
      mod.mountDebug({ scene, canvas });
    })
    .catch((error) => {
      debugLoading = null;
      console.error(error);
    });
}

if (new URLSearchParams(location.search).has("debug")) openDebug();

const brandTitle = document.querySelector("#brand-title");
if (brandTitle) {
  brandTitle.addEventListener("pointerdown", (event) => {
    if (event.button > 0) return;
    const id = event.pointerId;
    const origin = { x: event.clientX, y: event.clientY };
    const timer = window.setTimeout(() => openDebug(), 1200);
    const end = (ev) => {
      if (ev.pointerId !== id) return;
      window.clearTimeout(timer);
      brandTitle.removeEventListener("pointerup", end);
      brandTitle.removeEventListener("pointercancel", end);
      brandTitle.removeEventListener("pointermove", move);
    };
    const move = (ev) => {
      if (ev.pointerId !== id) return;
      if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) > 12) end(ev);
    };
    brandTitle.addEventListener("pointerup", end);
    brandTitle.addEventListener("pointercancel", end);
    brandTitle.addEventListener("pointermove", move);
  });
}
