// Original implementation for this project. Not derived from third-party source code.

import { t, uiText } from "./i18n.js";
import { play } from "./sfx.js";
import {
  LAYOUTS,
  WATER,
  advanceDay,
  applyRain,
  createWater,
  dayLength,
  makeRound,
  releaseDue,
  starsFor,
} from "./arcade/water.js";

const KEY = "cdc-island-arcade-v1";
const CHALLENGES = [WATER];
const POLITE = /です|ます|ください|ました/;

function empty() {
  return { v: 1, best: {}, plays: {}, ext: {} };
}

function cleanBest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!key || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const score = Number(raw.score);
    const stars = Number(raw.stars);
    const at = Number(raw.at);
    if (!Number.isFinite(score) || !Number.isFinite(stars)) continue;
    out[key] = {
      score: Math.max(0, Math.min(10000000, Math.floor(score))),
      stars: Math.max(0, Math.min(3, Math.floor(stars))),
      at: Number.isFinite(at) ? at : 0,
    };
  }
  return out;
}

function cleanPlays(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const count = Number(raw);
    if (!key || !Number.isFinite(count) || count < 0) continue;
    out[key] = Math.min(10000000, Math.floor(count));
  }
  return out;
}

function cleanExt(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const stamp = Number(raw);
    if (!key || !Number.isFinite(stamp) || stamp <= 0) continue;
    out[key] = stamp;
  }
  return out;
}

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || raw.v !== 1 || typeof raw !== "object") return empty();
    return { v: 1, best: cleanBest(raw.best), plays: cleanPlays(raw.plays), ext: cleanExt(raw.ext) };
  } catch {
    return empty();
  }
}

function save(book) {
  try {
    localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    /* private mode */
  }
}

export function record(id, score, stars) {
  const book = load();
  const prev = book.best[id];
  const safeStars = Math.max(0, Math.min(3, Math.floor(Number(stars) || 0)));
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const firstStar = safeStars >= 1 && !(prev && prev.stars >= 1);
  book.plays[id] = (book.plays[id] || 0) + 1;
  if (!prev || safeStars > prev.stars || (safeStars === prev.stars && safeScore > prev.score)) {
    book.best[id] = { score: safeScore, stars: safeStars, at: Date.now() };
  }
  if (id === "water" && safeStars >= 1 && !book.ext.m7) book.ext.m7 = Date.now();
  save(book);
  return { firstStar, best: book.best[id] || { score: safeScore, stars: safeStars, at: 0 } };
}

export function bestOf(id) {
  return load().best[id] || null;
}

export function starSum(book = load()) {
  return Object.values(book.best).reduce((sum, row) => sum + (row.stars || 0), 0);
}

export function clearArcade() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

export function missionExtension(id) {
  return id === "water" ? "m7" : "";
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

export function createArcade({ setPaused, onReward, onClose, saucer }) {
  const root = document.createElement("section");
  root.id = "arcade";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "arcade-title");
  root.innerHTML = `<button type="button" class="arcade-x" data-arcade="back"></button><div class="arcade-stage"><div class="arcade-panel" data-panel="cover"><h2 id="arcade-title"></h2><p class="arcade-rule"></p><ul class="arcade-gestures"></ul><p class="arcade-note" data-saucer hidden></p><button type="button" class="btn btn--solid" data-arcade="start"></button></div><div class="arcade-panel" data-panel="count" hidden><b class="arcade-count">3</b></div><div class="arcade-panel" data-panel="play" hidden><div class="arcade-board"></div><p class="arcade-toast" role="status"></p></div><div class="arcade-panel" data-panel="pause" hidden><button type="button" class="btn btn--solid" data-arcade="resume"></button></div><div class="arcade-panel" data-panel="result" hidden><p class="arcade-result-stars"></p><p class="arcade-best"></p><div class="sheet-say"><div class="guide-face"></div><p class="arcade-close-line"></p></div><button type="button" class="btn btn--solid" data-arcade="again"></button><button type="button" class="btn" data-arcade="back"></button></div></div>`;
  document.body.append(root);

  const board = root.querySelector(".arcade-board");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let phase = "closed";
  let paused = false;
  let countLeft = 0;
  let countTimer = 0;
  let lastInfo = null;
  let returnFocus = null;
  const parked = [];

  const water = createWater(board, {
    reduced,
    saucer,
    play,
    toast(key) {
      const node = root.querySelector(".arcade-toast");
      if (!node) return;
      node.textContent = t(key);
    },
    onFinish(result) {
      const saved = record(result.id, result.score, result.stars);
      lastInfo = { ...result, firstStar: saved.firstStar, best: saved.best };
      onReward?.(lastInfo);
      showResult(lastInfo);
    },
  });

  function show(name) {
    for (const panel of root.querySelectorAll("[data-panel]")) {
      panel.hidden = panel.dataset.panel !== name;
    }
    if (name !== "pause") phase = name;
  }

  function fillCover() {
    root.querySelector("#arcade-title").textContent = t(WATER.titleKey);
    root.querySelector(".arcade-rule").textContent = t(WATER.ruleKey);
    root.querySelector(".arcade-gestures").innerHTML = ["arcadeLook", "arcadeTip", "arcadeToss", "arcadeScrub"]
      .map((key) => `<li><b>${esc(t(key))}</b></li>`)
      .join("");
    const note = root.querySelector("[data-saucer]");
    const tipped = Boolean(saucer?.());
    note.hidden = !tipped;
    note.textContent = tipped ? t("arcadeWaterSaucer") : "";
    root.querySelector(".arcade-x").textContent = "×";
    root.querySelector(".arcade-x").setAttribute("aria-label", t("arcadeBack"));
    root.querySelector("[data-arcade=start]").textContent = t("arcadeStart");
    root.querySelector("[data-arcade=resume]").textContent = t("arcadePause");
    root.querySelector("[data-arcade=again]").textContent = t("arcadeAgain");
    root.querySelector("[data-arcade=back]").textContent = t("arcadeBack");
    root.querySelector(".guide-face").textContent = t("guideMark");
  }

  function open() {
    setPaused?.(true);
    returnFocus = document.activeElement;
    lastInfo = null;
    paused = false;
    root.hidden = false;
    park(true);
    fillCover();
    show("cover");
    root.querySelector("[data-arcade=start]").focus();
  }

  function close() {
    window.clearInterval(countTimer);
    water.stop();
    show("closed");
    phase = "closed";
    root.hidden = true;
    park(false);
    setPaused?.(false);
    const info = lastInfo;
    const back = returnFocus;
    if (back && typeof back.focus === "function") back.focus();
    onClose?.(info);
  }

  function beginCount() {
    paused = false;
    countLeft = 3;
    show("count");
    root.querySelector(".arcade-count").textContent = "3";
    play("tick");
    window.clearInterval(countTimer);
    countTimer = window.setInterval(stepCount, 400);
  }

  function stepCount() {
    if (paused || phase === "closed") return;
    countLeft -= 1;
    if (countLeft <= 0) {
      window.clearInterval(countTimer);
      beginPlay(false);
      return;
    }
    root.querySelector(".arcade-count").textContent = String(countLeft);
    play("tick");
  }

  function beginPlay() {
    paused = false;
    show("play");
    water.start();
  }

  function showResult(info) {
    window.clearInterval(countTimer);
    show("result");
    const marks = `${"★".repeat(info.stars)}${"☆".repeat(3 - info.stars)}`;
    root.querySelector(".arcade-result-stars").textContent = marks;
    root.querySelector(".arcade-best").textContent = t("arcadeBest", {
      stars: info.best?.stars || 0,
      score: info.best?.score || 0,
    });
    root.querySelector(".arcade-close-line").textContent = t(WATER.closeKey);
    if (info.stars >= 1) play("star");
    root.querySelector("[data-arcade=again]").focus();
  }

  function hold(on) {
    if (phase !== "count" && phase !== "play") return;
    paused = on;
    if (on) {
      window.clearInterval(countTimer);
      water.pause(true);
      root.querySelector("[data-panel=pause]").hidden = false;
      root.querySelector("[data-arcade=resume]").focus();
      return;
    }
    root.querySelector("[data-panel=pause]").hidden = true;
    if (phase === "count") countTimer = window.setInterval(stepCount, 400);
    else water.pause(false);
  }

  function park(on) {
    if (on) {
      parked.length = 0;
      for (const node of document.body.children) {
        if (node === root || node.inert) continue;
        node.inert = true;
        parked.push(node);
      }
      return;
    }
    for (const node of parked) node.inert = false;
    parked.length = 0;
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-arcade]");
    if (!button) return;
    const action = button.dataset.arcade;
    if (action === "start") beginCount();
    else if (action === "again") beginPlay();
    else if (action === "back") close();
    else if (action === "resume") hold(false);
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hold(true);
  });
  window.addEventListener("blur", () => {
    if (phase === "count" || phase === "play") hold(true);
  });

  return {
    open,
    close,
    isOpen: () => phase !== "closed" && !root.hidden,
  };
}

export function selfTest() {
  const errors = [];
  for (const challenge of CHALLENGES) {
    if (!challenge.islandId) errors.push(`arcade ${challenge.id} has no island`);
    const gates = challenge.gates || [];
    for (let i = 1; i < gates.length; i += 1) {
      if (!(gates[i] > gates[i - 1])) errors.push(`arcade ${challenge.id} star gates do not increase`);
    }
    for (const code of ["zh", "en", "ja"]) {
      for (const key of [challenge.titleKey, challenge.ruleKey, challenge.closeKey]) {
        if (!uiText(code, key)) errors.push(`arcade ${challenge.id} missing ${code} ${key}`);
      }
    }
    for (const key of ["arcadeWaterRule", "arcadeWaterClose", "arcadeWaterRain", "arcadeWaterScrub", "arcadeWaterSaucer", "arcadeWaterExtend", "arcadePause"]) {
      const line = uiText("ja", key);
      if (!POLITE.test(line)) errors.push(`arcade ja ${key} is not polite`);
    }
  }
  if (missionExtension("water") !== "m7") errors.push("water does not extend m7");
  if (dayLength(false) * 7 !== 42000) errors.push("water day length is not 42s");
  if (!(dayLength(true) > dayLength(false))) errors.push("reduced days are not longer");
  const rained = applyRain([{ id: "bucket", kind: "scrub", tipped: true, scrubbed: false, cleared: false, hatchDay: 8 }], 4);
  if (!(rained[0].hatchDay < 8) || rained[0].hatchDay !== 6) errors.push(`rain hatch ${rained[0].hatchDay}`);
  const kept = applyRain([{ id: "bucket", kind: "scrub", tipped: true, scrubbed: true, cleared: false, hatchDay: 8 }], 4);
  if (kept[0].hatchDay !== 8 || kept[0].tipped !== true) errors.push("scrubbed bucket was refilled");
  const released = releaseDue([{ id: "cup", kind: "tip", cleared: false, flown: false, hatchDay: 7 }], 7);
  if (released.flown !== 1) errors.push("day 7 did not release");
  const heart = advanceDay([{ id: "cup", kind: "tip", cleared: false, flown: false, hatchDay: 7 }], 7, 3);
  if (heart.flown !== 1 || heart.hearts !== 2) errors.push("day 7 kept a heart");
  const shortened = advanceDay([{ id: "bucket", kind: "scrub", tipped: true, scrubbed: false, cleared: false, hatchDay: 8 }], 4, 3);
  if (shortened.containers[0].hatchDay !== 6) errors.push("day 4 did not shorten the hatch");
  const spared = releaseDue([{ id: "cup", kind: "tip", cleared: true, flown: false, hatchDay: 7 }], 7);
  if (spared.flown !== 0) errors.push("cleared pot still released");
  if (starsFor({ cleared: 5, mosquitoes: 0, scrubbed: 0, heartsLost: 0 }) !== 0) errors.push("five clears scored a star");
  if (starsFor({ cleared: 6, mosquitoes: 1, scrubbed: 0, heartsLost: 1 }) !== 1) errors.push("six clears missed a star");
  if (starsFor({ cleared: 9, mosquitoes: 0, scrubbed: 1, heartsLost: 0 }) !== 2) errors.push("nine clears missed two stars");
  if (starsFor({ cleared: 10, mosquitoes: 0, scrubbed: 3, heartsLost: 0 }) !== 3) errors.push("full clear missed three stars");
  if (starsFor({ cleared: 10, mosquitoes: 1, scrubbed: 3, heartsLost: 1 }) !== 1) errors.push("a mosquito still scored two stars");
  if (LAYOUTS.length !== 6) errors.push(`layouts ${LAYOUTS.length}`);
  for (const layout of LAYOUTS) {
    if (layout.length !== 10) errors.push("layout is not 10 pots");
    const kinds = { tip: 0, bin: 0, scrub: 0 };
    const hidden = { tip: 0, bin: 0, scrub: 0 };
    for (const item of layout) {
      kinds[item.kind] += 1;
      if (item.hidden) hidden[item.kind] += 1;
    }
    if (kinds.tip !== 4 || kinds.bin !== 3 || kinds.scrub !== 3) errors.push("layout kind counts");
    if (hidden.tip !== 1 || hidden.bin !== 1 || hidden.scrub !== 1) errors.push("hidden kinds");
  }
  const round = makeRound(0, () => 0);
  for (const item of round) {
    if (item.hidden && item.hatchDay !== 5) errors.push("hidden hatch is not 5");
    if (!item.hidden && (item.hatchDay < 5 || item.hatchDay > 8)) errors.push("hatch out of range");
  }
  if (typeof document !== "undefined") {
    const host = document.createElement("div");
    const game = createWater(host, { play() {}, toast() {}, saucer: () => false, reduced: false, onFinish() {} });
    game.start(0);
    const count = host.querySelectorAll("svg, svg *").length;
    game.stop();
    if (count > 150) errors.push(`svg nodes ${count}`);
  }
  return errors;
}
