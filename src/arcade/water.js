// Original implementation for this project. Not derived from third-party source code.
// Weekly 巡、倒、清、刷 and scrubbing a stored-water container:
// https://www.cdc.gov.tw/Bulletin/Detail/drKkYC9lsvKwJErCP1Wl5g?typeid=9
// The seven-day board is the game clock. It does not state how many days an egg takes.

import { t } from "../i18n.js";
import {
  beach,
  bucket,
  c4a6280,
  c7ec4dc,
  cffffff,
  cloth,
  crate,
  k2a2630,
  leaf,
  pineA,
  pot,
  reed,
  sand,
  stone,
  trunkWood,
  wallShade,
  wood,
} from "../palette.js";

const SVG = "http://www.w3.org/2000/svg";
const INK = cssColor(k2a2630);
const PAPER = cffffff;

export const WATER = {
  id: "water",
  islandId: "dengue",
  titleKey: "arcadeWaterTitle",
  ruleKey: "arcadeWaterRule",
  closeKey: "arcadeWaterClose",
  gates: [6, 9, 10],
};

const ROLES = [
  { id: "cap", kind: "tip", role: "cap" },
  { id: "saucer", kind: "tip", role: "saucer" },
  { id: "bowl", kind: "tip", role: "bowl" },
  { id: "cup", kind: "tip", role: "cup" },
  { id: "tire", kind: "bin", role: "tire" },
  { id: "box", kind: "bin", role: "box" },
  { id: "bottle", kind: "bin", role: "bottle" },
  { id: "bucket", kind: "scrub", role: "bucket" },
  { id: "vase", kind: "scrub", role: "vase" },
  { id: "pan", kind: "scrub", role: "pan" },
];

const SPOTS = [
  [26, 46], [106, 42], [186, 50], [266, 40],
  [26, 130], [106, 138], [186, 126], [266, 146],
  [66, 214], [146, 222],
];

const HIDDEN = [
  [3, 6, 9],
  [0, 4, 7],
  [1, 5, 8],
  [2, 6, 7],
  [3, 4, 8],
  [1, 6, 9],
];

export const LAYOUTS = HIDDEN.map((hidden, layout) => ROLES.map((role, index) => {
  const spot = SPOTS[(index + layout * 2) % SPOTS.length];
  return {
    ...role,
    x: spot[0],
    y: spot[1],
    hidden: hidden.includes(index),
    disguise: hidden.includes(index) ? disguiseFor(role.kind) : "",
  };
}));

export function dayLength(reduced) {
  return reduced ? 9000 : 6000;
}

export function stageOf(day, hatchDay, wet) {
  if (day >= hatchDay) return "fly";
  const span = Math.max(1, hatchDay - 1);
  const progress = (day - 1) / span;
  let stage = "egg";
  if (progress >= 4 / 6) stage = "pupa";
  else if (progress >= 2 / 6) stage = "larva";
  if (wet && stage === "egg") stage = "larva";
  return stage;
}

export function applyRain(containers, day) {
  return containers.map((item) => {
    if (item.kind !== "scrub" || item.cleared || item.scrubbed || !item.tipped) return item;
    return {
      ...item,
      tipped: false,
      wet: true,
      hatchDay: Math.min(item.hatchDay, day + 2),
    };
  });
}

export function advanceDay(containers, day, hearts) {
  const next = day === 4 ? applyRain(containers, day) : containers;
  const released = releaseDue(next, day);
  return {
    containers: released.containers,
    ids: released.ids,
    flown: released.flown,
    hearts: Math.max(0, hearts - released.flown),
  };
}

export function releaseDue(containers, day) {
  let flown = 0;
  const ids = [];
  const next = containers.map((item) => {
    if (item.cleared || item.flown || day < item.hatchDay) return item;
    flown += 1;
    ids.push(item.id);
    return { ...item, flown: true };
  });
  return { containers: next, flown, ids };
}

export function starsFor(result) {
  const cleared = result.cleared || 0;
  const mosquitoes = result.mosquitoes || 0;
  const scrubbed = result.scrubbed || 0;
  const heartsLost = result.heartsLost || 0;
  if (cleared >= 10 && scrubbed >= 3 && heartsLost === 0 && mosquitoes === 0) return 3;
  if (cleared >= 9 && mosquitoes === 0) return 2;
  if (cleared >= 6) return 1;
  return 0;
}

export function scoreGain({ kind, scrubbed, combo }) {
  let gain = 100;
  if (kind === "scrub" && scrubbed) gain += 50;
  if (combo) gain += 20;
  return gain;
}

export function makeRound(index, rand = Math.random, opts = {}) {
  const layout = LAYOUTS[index % LAYOUTS.length];
  const pots = layout.map((item) => ({
    ...item,
    hatchDay: item.hidden ? 5 : 5 + Math.floor(rand() * 4),
    tipped: false,
    scrubbed: false,
    cleared: false,
    revealed: !item.hidden,
    flown: false,
    wet: false,
    precleared: false,
  }));
  if (opts.saucer) {
    const dish = pots.find((item) => item.role === "saucer");
    if (dish) {
      dish.revealed = true;
      dish.tipped = true;
      dish.cleared = true;
      dish.precleared = true;
    }
  }
  return pots;
}

export function createWater(host, hooks) {
  let containers = [];
  let alive = false;
  let held = false;
  let ended = false;
  let raf = 0;
  let elapsed = 0;
  let day = 1;
  let last = 0;
  let hearts = 3;
  let score = 0;
  let combo = 0;
  let lastClear = 0;
  let mosquitoes = 0;
  let raining = 0;
  let svg = null;
  let rainNode = null;
  let bug = null;
  let bugWrap = null;
  let session = null;
  let spaceAt = 0;
  let spaceId = "";
  const nodes = new Map();

  function reduced() {
    return Boolean(hooks.reduced);
  }

  function play(name, id) {
    hooks.play?.(name, id);
  }

  function toast(key) {
    hooks.toast?.(key);
  }

  function find(id) {
    return containers.find((item) => item.id === id);
  }

  function start(layoutIndex = Math.floor(Math.random() * LAYOUTS.length)) {
    stop();
    containers = makeRound(layoutIndex, Math.random, { saucer: Boolean(hooks.saucer?.()) });
    alive = true;
    held = false;
    ended = false;
    elapsed = 0;
    day = 1;
    hearts = 3;
    score = 0;
    combo = 0;
    lastClear = 0;
    mosquitoes = 0;
    raining = 0;
    session = null;
    build();
    paint();
    last = performance.now();
    raf = requestAnimationFrame(frame);
    if (hooks.saucer?.()) toast("arcadeWaterSaucer");
  }

  function pause(on) {
    held = Boolean(on);
    if (!alive) return;
    if (held) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function stop() {
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    session = null;
    if (svg) {
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      svg.removeEventListener("keydown", onKeyDown);
      svg.removeEventListener("keyup", onKeyUp);
    }
    host.replaceChildren();
    svg = null;
    nodes.clear();
  }

  function frame(now) {
    if (!alive || held || ended) {
      raf = 0;
      return;
    }
    const dt = Math.min(80, now - last);
    last = now;
    elapsed += dt;
    const length = dayLength(reduced());
    const nextDay = Math.min(7, Math.floor(elapsed / length) + 1);
    if (nextDay !== day) enterDay(nextDay);
    if (raining > 0) {
      raining -= dt;
      if (rainNode) rainNode.setAttribute("opacity", raining > 0 ? "1" : "0");
    }
    if (elapsed >= length * 7) finish();
    if (alive && !ended && !held) raf = requestAnimationFrame(frame);
  }

  function enterDay(next) {
    const stepped = advanceDay(containers, next, hearts);
    day = next;
    containers = stepped.containers;
    hearts = stepped.hearts;
    if (next === 4) {
      raining = 2000;
      if (rainNode) rainNode.setAttribute("opacity", "1");
      toast("arcadeWaterRain");
    }
    if (stepped.flown) {
      mosquitoes += stepped.flown;
      play("miss");
      showBug(stepped.ids[0]);
    }
    paint();
  }

  function finish() {
    if (ended) return;
    ended = true;
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    const cleared = containers.filter((item) => item.cleared).length;
    const scrubbed = containers.filter((item) => item.scrubbed).length;
    hooks.onFinish?.({
      id: WATER.id,
      score,
      stars: starsFor({ cleared, mosquitoes, scrubbed, heartsLost: 3 - hearts }),
      cleared,
      mosquitoes,
      scrubbed,
      heartsLost: 3 - hearts,
    });
  }

  function clearPot(item, now, sound) {
    if (!item || item.cleared || item.flown || !item.revealed) return;
    item.cleared = true;
    const chained = lastClear && now - lastClear <= 2000;
    if (chained) combo += 1;
    else combo = 1;
    const gain = scoreGain({ kind: item.kind, scrubbed: item.scrubbed, combo: chained });
    score += gain;
    lastClear = now;
    play(sound);
    play("good", combo);
    play("clear");
    paint();
    if (containers.every((pot) => pot.cleared)) finish();
  }

  function reveal(item) {
    if (!item || item.revealed) return;
    item.revealed = true;
    play("rustle");
    paint();
  }

  function tipScrub(item) {
    if (!item || item.kind !== "scrub" || item.tipped || item.cleared) return;
    item.tipped = true;
    play("splash");
    toast("arcadeWaterScrub");
    paint();
  }

  function scrub(item, now) {
    if (!item || item.kind !== "scrub" || !item.tipped || item.scrubbed || item.cleared || !item.revealed) return;
    item.scrubbed = true;
    clearPot(item, now, "scrub");
  }

  function onDown(event) {
    if (!alive || held) return;
    const group = event.target.closest?.("[data-pot]");
    if (!group) return;
    event.preventDefault();
    svg.setPointerCapture?.(event.pointerId);
    session = {
      id: group.dataset.pot,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ax: event.clientX,
      ay: event.clientY,
      angle: null,
      reversals: [],
      dist: 0,
    };
  }

  function onMove(event) {
    if (!session || session.pointer !== event.pointerId) return;
    const dx = event.clientX - session.x;
    const dy = event.clientY - session.y;
    session.dist = Math.max(session.dist, Math.hypot(dx, dy));
    const item = find(session.id);
    if (!item) return;
    if (!item.revealed && session.dist > 30) reveal(item);
    if (item.kind === "bin" && item.revealed && !item.cleared) movePot(item, dx, dy);
    if (item.kind === "scrub" && item.revealed && item.tipped && !item.scrubbed) noteScrub(session, event);
  }

  function onUp(event) {
    if (!session || session.pointer !== event.pointerId) return;
    const item = find(session.id);
    const dist = session.dist;
    const current = session;
    session = null;
    if (!item || !alive || held) return;
    if (!item.revealed) {
      if (dist <= 18 || dist > 30) reveal(item);
      return;
    }
    if (item.cleared || item.flown) {
      resetMove(item);
      return;
    }
    const now = performance.now();
    if (item.kind === "tip" && dist <= 18) clearPot(item, now, "splash");
    else if (item.kind === "scrub" && !item.tipped && dist <= 18) tipScrub(item);
    else if (item.kind === "bin") {
      resetMove(item);
      if (overBin(event.clientX, event.clientY)) clearPot(item, now, "thud");
    }
    else resetMove(item);
    current.reversals = [];
  }

  function noteScrub(state, event) {
    const dx = event.clientX - state.ax;
    const dy = event.clientY - state.ay;
    if (Math.hypot(dx, dy) < 24) return;
    const angle = Math.atan2(dy, dx);
    if (state.angle != null) {
      let turn = Math.abs(angle - state.angle);
      if (turn > Math.PI) turn = Math.PI * 2 - turn;
      if (turn > Math.PI * 0.55) state.reversals.push(event.timeStamp || performance.now());
    }
    state.angle = angle;
    state.ax = event.clientX;
    state.ay = event.clientY;
    const now = event.timeStamp || performance.now();
    state.reversals = state.reversals.filter((stamp) => now - stamp <= 1200);
    if (state.reversals.length >= 3) scrub(find(state.id), performance.now());
  }

  function onKeyDown(event) {
    const group = event.target.closest?.("[data-pot]");
    if (!group || !alive || held) return;
    if (event.key === "Enter") {
      event.preventDefault();
      keyboardAct(group.dataset.pot);
    } else if (event.key === " ") {
      event.preventDefault();
      if (event.repeat) return;
      spaceAt = performance.now();
      spaceId = group.dataset.pot;
    }
  }

  function onKeyUp(event) {
    if (event.key !== " " || !spaceId) return;
    const id = spaceId;
    const heldFor = performance.now() - spaceAt;
    spaceId = "";
    if (heldFor >= 1000) scrub(find(id), performance.now());
  }

  function keyboardAct(id) {
    const item = find(id);
    if (!item) return;
    if (!item.revealed) {
      reveal(item);
      return;
    }
    const now = performance.now();
    if (item.kind === "tip") clearPot(item, now, "splash");
    else if (item.kind === "bin") clearPot(item, now, "thud");
    else if (item.kind === "scrub" && !item.tipped) tipScrub(item);
  }

  function movePot(item, dx, dy) {
    const group = nodes.get(item.id);
    const board = svg.getBoundingClientRect();
    if (!group || board.width < 1) return;
    const sx = 360 / board.width;
    const sy = 480 / board.height;
    group.setAttribute("transform", `translate(${item.x + dx * sx} ${item.y + dy * sy})`);
  }

  function resetMove(item) {
    const group = nodes.get(item.id);
    if (group) group.setAttribute("transform", `translate(${item.x} ${item.y})`);
  }

  function overBin(x, y) {
    const bin = svg?.querySelector("#arcade-bin");
    if (!bin) return false;
    const rect = bin.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function showBug(id) {
    const item = id ? find(id) : null;
    if (!bug || !bugWrap || !item) return;
    bugWrap.setAttribute("transform", `translate(${item.x + 24} ${item.y + 16})`);
    bug.classList.remove("fly");
    void bug.getBoundingClientRect();
    bug.classList.add("fly");
  }

  function paint() {
    for (const item of containers) drawPot(item);
    paintHud();
  }

  function paintHud() {
    const dayNode = host.querySelector("[data-arcade-day]");
    const leftNode = host.querySelector("[data-arcade-left]");
    const scoreNode = host.querySelector("[data-arcade-score]");
    const comboNode = host.querySelector("[data-arcade-combo]");
    const heartsNode = host.querySelector("[data-arcade-hearts]");
    if (dayNode) dayNode.textContent = t("arcadeDay", { n: day });
    if (leftNode) leftNode.textContent = t("arcadeLeft", { n: Math.max(0, 7 - day) });
    if (scoreNode) scoreNode.textContent = String(score);
    if (comboNode) comboNode.textContent = combo > 1 ? t("arcadeCombo", { n: combo }) : "";
    if (heartsNode) {
      heartsNode.setAttribute("aria-label", t("arcadeHearts", { n: hearts }));
      heartsNode.querySelectorAll("i").forEach((dot, index) => {
        dot.classList.toggle("off", index >= hearts);
      });
    }
    host.dataset.dayMs = String(dayLength(reduced()));
    host.dataset.day = String(day);
  }

  function build() {
    host.replaceChildren();
    const hud = document.createElement("div");
    hud.className = "arcade-hud";
    hud.innerHTML = `<span data-arcade-day></span><span data-arcade-left></span><b data-arcade-score>0</b><span data-arcade-combo></span><span class="arcade-hearts" data-arcade-hearts><i></i><i></i><i></i></span>`;
    svg = el("svg", { viewBox: "0 0 360 480", role: "group" });
    svg.setAttribute("aria-label", t("arcadeWaterTitle"));
    el("rect", { class: "arcade-sky", x: 0, y: 0, width: 360, height: 300, fill: c7ec4dc }, svg);
    el("rect", { x: 0, y: 280, width: 360, height: 200, fill: beach }, svg);
    rainNode = el("g", { class: reduced() ? "arcade-rain-hold" : "arcade-rain", opacity: 0 }, svg);
    if (reduced()) {
      el("rect", { class: "arcade-rain-veil", x: 0, y: 0, width: 360, height: 300, fill: stone }, rainNode);
    } else {
      for (let i = 0; i < 20; i += 1) {
        const x = 8 + (i * 18) % 350;
        const y = 16 + (i % 5) * 28;
        el("line", { x1: x, y1: y, x2: x - 8, y2: y + 16, stroke: c4a6280, "stroke-width": 1.2 }, rainNode);
      }
    }
    for (const item of containers) {
      const group = el("g", {
        role: "button",
        tabindex: "0",
        "data-pot": item.id,
        "data-kind": item.kind,
        transform: `translate(${item.x} ${item.y})`,
      }, svg);
      nodes.set(item.id, group);
    }
    const bin = el("g", { id: "arcade-bin", transform: "translate(144 400)" }, svg);
    el("rect", { width: 72, height: 72, rx: 8, fill: wood }, bin);
    el("rect", { x: 10, y: 10, width: 52, height: 52, rx: 4, fill: trunkWood }, bin);
    const label = el("text", { x: 36, y: 40, "text-anchor": "middle", "font-size": 12, fill: PAPER }, bin);
    label.textContent = t("arcadeToss");
    bugWrap = el("g", {}, svg);
    bug = el("g", { id: "arcade-bug", class: "arcade-bug" }, bugWrap);
    el("ellipse", { cx: 0, cy: 0, rx: 3.2, ry: 8, fill: INK }, bug);
    el("rect", { x: -3.2, y: -3, width: 6.4, height: 1.3, fill: PAPER }, bug);
    el("rect", { x: -3.2, y: 0.2, width: 6.4, height: 1.3, fill: PAPER }, bug);
    el("rect", { x: -3.2, y: 3.4, width: 6.4, height: 1.3, fill: PAPER }, bug);
    el("path", { d: "M -1 -2 C -12 -10 -16 -2 -8 2", fill: "none", stroke: PAPER, "stroke-width": 0.8 }, bug);
    el("path", { d: "M 1 -2 C 12 -10 16 -2 8 2", fill: "none", stroke: PAPER, "stroke-width": 0.8 }, bug);
    el("path", { d: "M -2 2 L -8 7 M 2 2 L 8 7 M -1 6 L -7 12 M 1 6 L 7 12", fill: "none", stroke: INK, "stroke-width": 0.7 }, bug);
    host.append(hud, svg);
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    svg.dataset.reduced = reduced() ? "1" : "0";
    svg.addEventListener("keydown", onKeyDown);
    svg.addEventListener("keyup", onKeyUp);
    svg.addEventListener("blur", () => { spaceId = ""; }, true);
  }

  function drawPot(item) {
    const group = nodes.get(item.id);
    if (!group) return;
    const stage = item.cleared || item.flown ? "" : stageOf(day, item.hatchDay, item.wet);
    group.setAttribute("transform", `translate(${item.x} ${item.y})`);
    group.setAttribute("aria-label", potLabel(item, stage));
    group.replaceChildren();
    el("rect", { class: "arcade-hit", x: 0, y: 0, width: 48, height: 48, fill: PAPER, opacity: 0, "pointer-events": "all" }, group);
    if (!item.revealed) {
      drawDisguise(group, item.disguise);
      return;
    }
    const body = el("g", { class: item.cleared ? "is-clear" : "" }, group);
    drawBody(body, item);
    if (!item.cleared && !item.flown) drawLife(body, stage);
    if (item.cleared) {
      el("path", { d: "M 14 26 l 6 6 l 14 -14", fill: "none", stroke: leaf, "stroke-width": 2.4, "stroke-linecap": "round" }, group);
    }
  }

  return { start, pause, stop };
}

function disguiseFor(kind) {
  if (kind === "tip") return "leaves";
  if (kind === "bin") return "bush";
  return "ac";
}

function potLabel(item, stage) {
  if (!item.revealed) return t("arcadeLook");
  if (item.kind === "tip") return t("arcadeTip");
  if (item.kind === "bin") return t("arcadeToss");
  if (!item.tipped) return t("arcadeTip");
  if (stage) return `${t("arcadeScrub")} ${stage === "pupa" ? t("arcadePupa") : t("arcadeLarva")}`;
  return t("arcadeScrub");
}

function drawDisguise(group, kind) {
  if (kind === "bush") {
    el("circle", { cx: 16, cy: 28, r: 10, fill: pineA }, group);
    el("circle", { cx: 30, cy: 26, r: 12, fill: leaf }, group);
    el("circle", { cx: 24, cy: 18, r: 8, fill: reed }, group);
    return;
  }
  if (kind === "ac") {
    el("rect", { x: 6, y: 14, width: 36, height: 22, rx: 2, fill: wallShade }, group);
    el("rect", { x: 10, y: 28, width: 28, height: 6, fill: stone }, group);
    return;
  }
  el("ellipse", { cx: 16, cy: 26, rx: 12, ry: 6, fill: pineA }, group);
  el("ellipse", { cx: 30, cy: 24, rx: 10, ry: 5, fill: leaf }, group);
}

function drawBody(group, item) {
  const water = item.tipped || item.cleared ? 0 : 0.85;
  if (item.role === "cap") {
    el("ellipse", { cx: 24, cy: 28, rx: 12, ry: 6, fill: pot }, group);
    el("ellipse", { cx: 24, cy: 26, rx: 8, ry: 3, fill: c7ec4dc, opacity: water }, group);
  } else if (item.role === "saucer") {
    el("ellipse", { cx: 24, cy: 30, rx: 16, ry: 6, fill: sand }, group);
    el("ellipse", { cx: 24, cy: 28, rx: 10, ry: 3.5, fill: c7ec4dc, opacity: water }, group);
  } else if (item.role === "bowl") {
    el("path", { d: "M 10 20 h 28 l -4 14 h -20 z", fill: cloth }, group);
    el("ellipse", { cx: 24, cy: 24, rx: 10, ry: 3, fill: c7ec4dc, opacity: water }, group);
  } else if (item.role === "cup") {
    el("rect", { x: 16, y: 16, width: 16, height: 18, rx: 2, fill: crate }, group);
    el("rect", { x: 18, y: 22, width: 12, height: 6, fill: c7ec4dc, opacity: water }, group);
  } else if (item.role === "tire") {
    el("circle", { cx: 24, cy: 26, r: 14, fill: INK }, group);
    el("circle", { cx: 24, cy: 26, r: 6, fill: stone }, group);
  } else if (item.role === "box") {
    el("rect", { x: 10, y: 16, width: 28, height: 20, rx: 2, fill: crate }, group);
    el("path", { d: "M 10 22 h 28", stroke: wood, "stroke-width": 1 }, group);
  } else if (item.role === "bottle") {
    el("rect", { x: 20, y: 10, width: 8, height: 6, fill: bucket }, group);
    el("rect", { x: 16, y: 16, width: 16, height: 22, rx: 3, fill: bucket }, group);
  } else if (item.role === "bucket") {
    el("path", { d: "M 12 16 h 24 l -3 20 h -18 z", fill: bucket }, group);
    el("rect", { x: 16, y: 22, width: 16, height: 6, fill: c7ec4dc, opacity: water }, group);
  } else if (item.role === "vase") {
    el("path", { d: "M 18 12 h 12 l 4 24 h -20 z", fill: pot }, group);
    el("rect", { x: 18, y: 22, width: 12, height: 6, fill: c7ec4dc, opacity: water }, group);
  } else {
    el("rect", { x: 8, y: 20, width: 32, height: 12, rx: 2, fill: wallShade }, group);
    el("rect", { x: 12, y: 24, width: 24, height: 4, fill: c7ec4dc, opacity: water }, group);
  }
}

function drawLife(group, stage) {
  if (stage === "egg") {
    el("circle", { cx: 18, cy: 30, r: 1.5, fill: INK }, group);
    el("circle", { cx: 24, cy: 31, r: 1.5, fill: INK }, group);
    el("circle", { cx: 30, cy: 30, r: 1.5, fill: INK }, group);
    return;
  }
  if (stage === "larva") {
    const line = el("polyline", {
      points: "12,32 20,26 28,33 36,24",
      fill: "none",
      stroke: INK,
      "stroke-width": 1.6,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }, group);
    if (stillPicture(group)) label(group, t("arcadeLarva"));
    else line.setAttribute("class", "arcade-wiggle");
    return;
  }
  if (stage === "pupa") {
    el("path", {
      d: "M 30 16 q 8 8 1 14 q -6 3 -1 7",
      fill: "none",
      stroke: INK,
      "stroke-width": 1.8,
      "stroke-linecap": "round",
    }, group);
    if (stillPicture(group)) label(group, t("arcadePupa"));
  }
}

function stillPicture(node) {
  const root = node.ownerSVGElement;
  if (root?.dataset.reduced === "1") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function label(group, text) {
  const node = el("text", { x: 4, y: 12, "font-size": 10, fill: INK }, group);
  node.textContent = text;
}

function cssColor(value) {
  if (typeof value === "number") return `#${value.toString(16).padStart(6, "0")}`;
  return value;
}

function el(name, attrs, parent) {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value != null && value !== "") node.setAttribute(key, String(value));
  }
  if (parent) parent.append(node);
  return node;
}
