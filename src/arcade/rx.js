// Original implementation for this project. Not derived from third-party source code.
// Four don'ts and one do, plus handwashing and vaccines:
// https://www.cdc.gov.tw/Category/ListContent/Hh094B49-DRwe2RR4eFfrQ?uaId=6NhYstXA0WPZCex8po38mw
// Cold viruses and finishing a prescribed course also match the amr island's existing actions.
// The closing line is that island's first action sentence.

import { t } from "../i18n.js";
import { c3eb0b4, c4a6280, c7eaea8, c8d7348, bloom, c49c8d2, cross, leaf, sail, wood } from "../palette.js";

const SVG = "http://www.w3.org/2000/svg";
export const CARD_MS = 3000;
export const CARD_MS_REDUCED = 4500;
export const REVEAL_MS = 1200;
export const SWIPE_PX = 80;
export const SWIPE_V = 0.5;

export const RX = {
  id: "rx",
  islandId: "amr",
  titleKey: "arcadeRxTitle",
  ruleKey: "arcadeRxRule",
  closeKey: "arcadeRxClose",
  gestureKeys: ["arcadeRxRight", "arcadeRxLeft", "arcadeRxAsk"],
  gates: [5, 7, 8],
};

const STRIPES = [bloom, sail, wood, cross, c3eb0b4, leaf, c8d7348, c49c8d2];

export const CARDS = [
  { id: "01", ok: false, icon: "drip" },
  { id: "02", ok: false, icon: "save" },
  { id: "03", ok: false, icon: "friend" },
  { id: "04", ok: false, icon: "home" },
  { id: "05", ok: false, icon: "shop" },
  { id: "06", ok: false, icon: "stop" },
  { id: "07", ok: true, icon: "clock" },
  { id: "08", ok: true, icon: "ask" },
  { id: "09", ok: true, icon: "soap" },
  { id: "10", ok: true, icon: "days" },
  { id: "11", ok: true, icon: "hour" },
  { id: "12", ok: true, icon: "share" },
];

export function cardMs(reduced) {
  return reduced ? CARD_MS_REDUCED : CARD_MS;
}

export function scoreFor(leftMs) {
  const tenths = Math.max(0, Math.floor(Number(leftMs) / 100) || 0);
  return 100 + tenths * 5;
}

export function starsFor(right, wrong) {
  const yes = Math.max(0, Math.floor(Number(right) || 0));
  const no = Math.max(0, Math.floor(Number(wrong) || 0));
  if (yes >= 8 && no === 0) return 3;
  if (yes >= 7) return 2;
  if (yes >= 5) return 1;
  return 0;
}

function shuffle(list, random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const roll = Math.min(0.999999, Math.max(0, Number(random()) || 0));
    const j = Math.floor(roll * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function dealRound(random = Math.random) {
  const yes = CARDS.filter((card) => card.ok);
  const no = CARDS.filter((card) => !card.ok);
  const take = (list) => shuffle(list, random).slice(0, 4);
  return shuffle([...take(yes), ...take(no)], random);
}

export function swipeCall(dx, dt) {
  const distance = Number(dx) || 0;
  const span = Math.max(0, Number(dt) || 0);
  const speed = span > 0 ? Math.abs(distance) / span : 0;
  if (Math.abs(distance) <= SWIPE_PX && speed <= SWIPE_V) return "";
  return distance > 0 ? "right" : distance < 0 ? "left" : "";
}

function el(name, attrs, parent) {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
  if (parent) parent.append(node);
  return node;
}

function icon(kind) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  const stroke = { fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round" };
  if (kind === "drip") el("path", { ...stroke, d: "M16 5c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13z" }, svg);
  else if (kind === "save") el("path", { ...stroke, d: "M8 6h12l4 4v16H8zM12 6v6h8M12 22h8" }, svg);
  else if (kind === "friend") {
    el("circle", { ...stroke, cx: 12, cy: 12, r: 3 }, svg);
    el("circle", { ...stroke, cx: 21, cy: 13, r: 2.4 }, svg);
    el("path", { ...stroke, d: "M6 24c1-4 3.4-6 6-6s5 2 6 6M18 20c1.6-1.2 3-1.6 4.6-1.2 2 .6 3.2 2.4 3.8 5.2" }, svg);
  } else if (kind === "home") el("path", { ...stroke, d: "M6 15 16 7l10 8M9 14v11h14V14" }, svg);
  else if (kind === "shop") el("path", { ...stroke, d: "M6 13h20l-2 13H8zM9 13V9h14v4" }, svg);
  else if (kind === "stop") {
    el("circle", { ...stroke, cx: 16, cy: 16, r: 9 }, svg);
    el("path", { ...stroke, d: "M11 16h10" }, svg);
  } else if (kind === "clock") {
    el("circle", { ...stroke, cx: 16, cy: 16, r: 9 }, svg);
    el("path", { ...stroke, d: "M16 10v6l4 2" }, svg);
  } else if (kind === "ask") el("path", { ...stroke, d: "M8 8h16v10H13l-5 4v-4H8z" }, svg);
  else if (kind === "soap") el("path", { ...stroke, d: "M8 14h16v10H8zM12 14V10h8v4M11 19h10" }, svg);
  else if (kind === "days") el("path", { ...stroke, d: "M8 8h16v16H8zM8 13h16M13 6v4M19 6v4" }, svg);
  else if (kind === "hour") el("path", { ...stroke, d: "M10 8h12M16 8v16M12 24h8" }, svg);
  else el("path", { ...stroke, d: "M8 16h16M16 8v16" }, svg);
  return svg;
}

export function createRx(host, hooks) {
  const reduced = Boolean(hooks.reduced);
  const limit = cardMs(reduced);
  let alive = false;
  let held = false;
  let ended = false;
  let phase = "play";
  let raf = 0;
  let clock = 0;
  let pauseAt = 0;
  let until = 0;
  let queue = [];
  let seen = 0;
  let right = 0;
  let wrong = 0;
  let combo = 0;
  let score = 0;
  let stripes = 0;
  let drag = null;
  let root = null;
  let stack = null;
  let germ = null;
  let body = null;
  let scoreNode = null;
  let countNode = null;
  let comboNode = null;

  function stamp() {
    return performance.now();
  }

  function play(name, id) {
    hooks.play?.(name, id);
  }

  function toast(key) {
    hooks.toast?.(key || "");
  }

  function paintGerm() {
    germ.replaceChildren();
    body = el("g", {}, germ);
    el("ellipse", { cx: 46, cy: 78, rx: 28, ry: 40, fill: c7eaea8, stroke: c4a6280, "stroke-width": 3 }, body);
    el("ellipse", { cx: 46, cy: 62, rx: 22, ry: 6, fill: "none", stroke: c4a6280, "stroke-width": 3 }, body);
    el("ellipse", { cx: 46, cy: 86, rx: 24, ry: 6, fill: "none", stroke: c4a6280, "stroke-width": 3 }, body);
    for (let i = 0; i < stripes; i += 1) {
      const y = 48 + i * 8;
      el("ellipse", {
        cx: 46,
        cy: Math.min(108, y),
        rx: 20 + (i % 3),
        ry: 5,
        fill: "none",
        stroke: STRIPES[i % STRIPES.length],
        "stroke-width": 4,
      }, body);
    }
  }

  function topCard() {
    return stack?.querySelector(".arcade-rx-card");
  }

  function paintDrag(dx) {
    const card = topCard();
    if (!card || reduced) return;
    const rot = Math.max(-12, Math.min(12, (dx / SWIPE_PX) * 12));
    card.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
    const fade = Math.max(0, Math.min(1, Math.abs(dx) / SWIPE_PX));
    card.querySelector(".arcade-rx-hint-yes").style.opacity = dx > 0 ? String(fade) : "0";
    card.querySelector(".arcade-rx-hint-no").style.opacity = dx < 0 ? String(fade) : "0";
  }

  function clearDrag() {
    const card = topCard();
    drag = null;
    if (!card) return;
    card.style.transform = "";
    card.querySelector(".arcade-rx-hint-yes").style.opacity = "0";
    card.querySelector(".arcade-rx-hint-no").style.opacity = "0";
  }

  function render() {
    stack.replaceChildren();
    queue.slice(0, 3).forEach((card, depth) => {
      const node = document.createElement("article");
      node.className = "arcade-rx-card";
      node.dataset.id = card.id;
      node.dataset.ok = card.ok ? "1" : "0";
      node.dataset.depth = String(depth);
      node.style.zIndex = String(3 - depth);
      const face = document.createElement("div");
      face.className = "arcade-rx-face";
      const mark = document.createElement("span");
      mark.className = "arcade-rx-icon";
      mark.append(icon(card.icon));
      const line = document.createElement("p");
      line.textContent = t(`rxCard${card.id}`);
      const bar = document.createElement("i");
      bar.className = "arcade-rx-bar";
      const fill = document.createElement("b");
      bar.append(fill);
      const no = document.createElement("span");
      no.className = "arcade-rx-hint arcade-rx-hint-no";
      no.textContent = "✗";
      const yes = document.createElement("span");
      yes.className = "arcade-rx-hint arcade-rx-hint-yes";
      yes.textContent = "✓";
      face.append(mark, line, bar, no, yes);
      const why = document.createElement("p");
      why.className = "arcade-rx-why";
      node.append(face, why);
      stack.append(node);
    });
    countNode.textContent = t("arcadeRxOf", { n: Math.min(DEAL, seen + 1) });
    scoreNode.textContent = String(score);
    comboNode.textContent = combo > 1 ? t("arcadeCombo", { n: combo }) : "";
  }

  const DEAL = 8;

  function showWhy(key) {
    const card = topCard();
    if (!card) return;
    card.querySelector(".arcade-rx-why").textContent = t(key);
    card.classList.add(reduced ? "is-tell" : "is-flip");
  }

  function answer(saidYes, timedOut) {
    if (phase !== "play" || !queue.length) return;
    const card = queue[0];
    const left = Math.max(0, limit - (stamp() - clock));
    const hit = !timedOut && card.ok === saidYes;
    clearDrag();
    if (hit) {
      right += 1;
      combo += 1;
      score += scoreFor(left);
      play("good", combo);
      toast("");
      topCard()?.classList.add(reduced ? "is-fade" : saidYes ? "is-out-right" : "is-out-left");
      phase = "leave";
      until = stamp() + (reduced ? 180 : 280);
    } else {
      wrong += 1;
      combo = 0;
      stripes += 1;
      play("miss");
      paintGerm();
      toast("arcadeRxTrick");
      showWhy(timedOut ? "arcadeRxTimeout" : `rxWhy${card.id}`);
      phase = "wait";
      until = stamp() + REVEAL_MS;
    }
    scoreNode.textContent = String(score);
    comboNode.textContent = combo > 1 ? t("arcadeCombo", { n: combo }) : "";
  }

  function advance() {
    if (!queue.length) return;
    queue.shift();
    seen += 1;
    if (!queue.length) {
      if (wrong === 0) {
        germ.classList.add(reduced ? "is-gone" : "is-sunk");
        phase = "sink";
        until = stamp() + (reduced ? 0 : 700);
        return;
      }
      finish();
      return;
    }
    phase = "play";
    clock = stamp();
    render();
  }

  function finish() {
    if (ended) return;
    ended = true;
    alive = false;
    window.cancelAnimationFrame(raf);
    hooks.onFinish?.({
      id: "rx",
      score,
      stars: starsFor(right, wrong),
      right,
      wrong,
    });
  }

  function frame() {
    if (!alive) return;
    raf = window.requestAnimationFrame(frame);
    if (held) return;
    if (phase === "play") {
      const left = limit - (stamp() - clock);
      const bar = topCard()?.querySelector(".arcade-rx-bar b");
      if (bar) bar.style.transform = `scaleX(${Math.max(0, left / limit)})`;
      if (left <= 0) answer(false, true);
      return;
    }
    if ((phase === "wait" || phase === "leave" || phase === "sink") && stamp() >= until) {
      if (phase === "sink") finish();
      else advance();
    }
  }

  function onKey(event) {
    if (!alive || phase !== "play") return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    answer(event.key === "ArrowRight", false);
  }

  function onDown(event) {
    if (!alive || phase !== "play" || event.button > 0) return;
    const card = topCard();
    if (!card?.contains(event.target)) return;
    drag = { id: event.pointerId, x: event.clientX, t: stamp(), dx: 0 };
    card.setPointerCapture?.(event.pointerId);
  }

  function onMove(event) {
    if (!drag || event.pointerId !== drag.id || phase !== "play") return;
    drag.dx = event.clientX - drag.x;
    paintDrag(drag.dx);
  }

  function onUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const call = swipeCall(drag.dx, stamp() - drag.t);
    clearDrag();
    if (phase === "play" && call) answer(call === "right", false);
  }

  function onClick(event) {
    const button = event.target.closest?.("[data-rx]");
    if (!button || phase !== "play") return;
    answer(button.dataset.rx === "yes", false);
  }

  function mount() {
    host.replaceChildren();
    root = document.createElement("div");
    root.className = "arcade-rx";
    if (reduced) root.classList.add("is-reduced");
    const hud = document.createElement("p");
    hud.className = "arcade-rx-hud";
    countNode = document.createElement("b");
    scoreNode = document.createElement("b");
    comboNode = document.createElement("span");
    hud.append(countNode, scoreNode, comboNode);
    const main = document.createElement("div");
    main.className = "arcade-rx-main";
    stack = document.createElement("div");
    stack.className = "arcade-rx-stack";
    germ = document.createElementNS(SVG, "svg");
    germ.setAttribute("viewBox", "0 0 92 150");
    germ.setAttribute("class", "arcade-rx-germ");
    germ.setAttribute("aria-hidden", "true");
    main.append(stack, germ);
    const actions = document.createElement("div");
    actions.className = "arcade-rx-actions";
    const no = document.createElement("button");
    no.type = "button";
    no.className = "btn";
    no.dataset.rx = "no";
    no.textContent = t("arcadeRxNo");
    const yes = document.createElement("button");
    yes.type = "button";
    yes.className = "btn btn--solid";
    yes.dataset.rx = "yes";
    yes.textContent = t("arcadeRxYes");
    actions.append(no, yes);
    root.append(hud, main, actions);
    host.append(root);
    actions.addEventListener("click", onClick);
    stack.addEventListener("pointerdown", onDown);
    stack.addEventListener("pointermove", onMove);
    stack.addEventListener("pointerup", onUp);
    stack.addEventListener("pointercancel", onUp);
    paintGerm();
  }

  function start() {
    stop();
    alive = true;
    ended = false;
    held = false;
    phase = "play";
    seen = 0;
    right = 0;
    wrong = 0;
    combo = 0;
    score = 0;
    stripes = 0;
    queue = dealRound();
    mount();
    render();
    clock = stamp();
    window.addEventListener("keydown", onKey);
    raf = window.requestAnimationFrame(frame);
  }

  function pause(on) {
    if (!alive) return;
    if (on && !held) {
      held = true;
      pauseAt = stamp();
      return;
    }
    if (!on && held) {
      const delta = stamp() - pauseAt;
      clock += delta;
      if (until) until += delta;
      held = false;
    }
  }

  function stop() {
    alive = false;
    ended = true;
    held = false;
    drag = null;
    window.cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey);
    host.replaceChildren();
    root = null;
    stack = null;
  }

  return { start, pause, stop };
}
