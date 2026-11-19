// Original implementation for this project. Not derived from third-party source code.
// Sleeve when there is no tissue, and rest at home:
// https://www.cdc.gov.tw/En/Category/ListContent/AHwuigegBBBmuDcbWkzoGQ?uaid=DYWruyX9T5EuFmjpFPH8lQ
// The closing line is the flu island's existing action sentence.

import { t } from "../i18n.js";
import {
  beach,
  c14756f,
  c4a6280,
  c5c6670,
  c7ec4dc,
  c8d5a3c,
  c8d6244,
  cb7d7ea,
  cb98348,
  cc4473a,
  cc48a6a,
  cd9a57a,
  ce39a3a,
  cf0c7a4,
  cf3efe4,
  cf4efe4,
  cffffff,
  cloth,
  k2a2630,
  sand,
  wallShade,
  wood,
} from "../palette.js";

const SVG = "http://www.w3.org/2000/svg";
const PAPER = cffffff;
const INK = cssColor(k2a2630);
const DROP = c4a6280;
const PUFF = cffffff;

export const ROUND_MS = 30000;
export const CLUTCH_MS = 200;
export const YAWN_CHANCE = 0.15;

export const SNEEZE = {
  id: "sneeze",
  islandId: "flu",
  titleKey: "arcadeSneezeTitle",
  ruleKey: "arcadeSneezeRule",
  closeKey: "arcadeSneezeClose",
  gestureKeys: ["arcadeElbow", "arcadeYawn", "arcadeRest"],
  gates: [8, 12, 16],
};

const CAST = [
  { role: "kid", label: "roleKid", body: cb98348, hair: ce39a3a, skin: cf0c7a4 },
  { role: "elder", label: "roleElder", body: cloth, hair: cf3efe4, skin: cd9a57a },
  { role: "nurse", label: "roleNurse", body: cf4efe4, hair: c8d6244, skin: cc48a6a },
  { role: "courier", label: "roleCourier", body: cb7d7ea, hair: ce39a3a, skin: c8d5a3c },
  { role: "officer", label: "roleOfficer", body: c14756f, hair: c8d6244, skin: cf0c7a4 },
  { role: "lab", label: "roleLab", body: cf3efe4, hair: c8d6244, skin: cd9a57a },
  { role: "chief", label: "roleChief", body: cc4473a, hair: c5c6670, skin: cc48a6a },
];

export function windMs(reduced) {
  return reduced ? 1350 : 900;
}

export function gapFor(sprayed, random = Math.random) {
  const span = sprayed ? [800, 1600] : [1200, 2500];
  const roll = Math.min(1, Math.max(0, Number(random()) || 0));
  return Math.round(span[0] + roll * (span[1] - span[0]));
}

export function feverDelay(random = Math.random) {
  const roll = Math.min(1, Math.max(0, Number(random()) || 0));
  return Math.round(7000 + roll * 2000);
}

export function rollKind(random = Math.random) {
  return random() < YAWN_CHANCE ? "yawn" : "wind";
}

export function seatOrigin(id) {
  const col = id % 2;
  const row = Math.floor(id / 2);
  return {
    id,
    x: col === 0 ? 36 : 228,
    y: 64 + row * 124,
    face: col === 0 ? 1 : -1,
  };
}

export function coneTargets(fromId) {
  const from = seatOrigin(fromId);
  const fx = from.face;
  const fromX = from.x + 48;
  const fromY = from.y + 40;
  const hits = [];
  for (let id = 0; id < 6; id += 1) {
    if (id === fromId) continue;
    const to = seatOrigin(id);
    const dx = to.x + 48 - fromX;
    const dy = to.y + 40 - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const dot = (dx / len) * fx;
    const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (ang <= Math.PI / 6) hits.push(id);
  }
  return hits;
}

export function pickReady(seats, random = Math.random) {
  const ready = seats.filter((seat) => seat.mode === "idle" && seat.readyAt <= 0);
  if (!ready.length) return -1;
  const sprayed = ready.filter((seat) => seat.sprayed);
  const pool = sprayed.length ? sprayed : ready;
  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length));
  return pool[index].id;
}

export function scoreFor(kind, combo) {
  const base = kind === "clutch" ? 150 : kind === "fever" ? 200 : kind === "block" ? 100 : 0;
  const step = Math.max(0, (Number(combo) || 1) - 1);
  return Math.round(base * (1 + step * 0.1));
}

export function resolveTap(person, now, combo) {
  if (!person) return { ok: false, kind: "idle", combo, gain: 0 };
  if (person.mode === "yawn") return { ok: true, kind: "yawn", combo: 0, gain: 0 };
  if (person.mode === "fever") {
    const next = combo + 1;
    return { ok: true, kind: "fever", combo: next, gain: scoreFor("fever", next) };
  }
  if (person.mode === "wind" && now <= person.until) {
    const kind = person.until - now <= CLUTCH_MS ? "clutch" : "block";
    const next = combo + 1;
    return { ok: true, kind, combo: next, gain: scoreFor(kind, next) };
  }
  return { ok: false, kind: "idle", combo, gain: 0 };
}

export function starsFor(stats) {
  const blocked = stats.blocked || 0;
  const sprayed = stats.sprayed || 0;
  const seen = stats.feverSeen || 0;
  const sent = stats.feverSent || 0;
  if (blocked >= 16 && sprayed === 0 && sent >= seen) return 3;
  if (blocked >= 12 && sprayed <= 1) return 2;
  if (blocked >= 8) return 1;
  return 0;
}

function facePath(mode, showHeart) {
  const eyes = "M -8 5 a 1.7 1.7 0 1 0 0.01 0 M 8 5 a 1.7 1.7 0 1 0 0.01 0";
  const smile = "M -4 10 a 4 2.2 0 1 0 8 0 a 4 2.2 0 1 0 -8 0";
  const yawn = "M -5 9 a 5 4.5 0 1 0 10 0 a 5 4.5 0 1 0 -10 0";
  const nose = "M -1.6 1 L 1.6 1 L 0 4 Z";
  const heart = "M -6 -22 C -6 -27 0 -27 0 -22 C 0 -27 6 -27 6 -22 C 6 -17 0 -13 0 -13 C 0 -13 -6 -17 -6 -22";
  const mouth = mode === "yawn" ? yawn : smile;
  const extra = mode === "wind" ? nose : "";
  return `${eyes} ${mouth} ${extra} ${showHeart ? heart : ""}`;
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

export function createSneeze(host, hooks) {
  let people = [];
  let drops = [];
  let alive = false;
  let held = false;
  let ended = false;
  let listening = false;
  let raf = 0;
  let elapsed = 0;
  let last = 0;
  let score = 0;
  let combo = 0;
  let blocked = 0;
  let sprayedPeople = 0;
  let feverSeen = 0;
  let feverSent = 0;
  let nextFever = 7000;
  let spawnLock = 0;
  let svg = null;

  function reduced() {
    return Boolean(hooks.reduced);
  }

  function play(name, id) {
    hooks.play?.(name, id);
  }

  function toast(key) {
    hooks.toast?.(key);
  }

  function start() {
    stop();
    alive = true;
    held = false;
    ended = false;
    elapsed = 0;
    score = 0;
    combo = 0;
    blocked = 0;
    sprayedPeople = 0;
    feverSeen = 0;
    feverSent = 0;
    spawnLock = 0;
    nextFever = feverDelay(Math.random);
    people = Array.from({ length: 6 }, (_, id) => {
      const spot = seatOrigin(id);
      return {
        id,
        x: spot.x,
        y: spot.y,
        face: spot.face,
        cast: id,
        mode: "idle",
        readyAt: 0,
        until: 0,
        sprayed: false,
        elbow: 0,
        coverFor: 0,
        leaveFor: 0,
        flashFor: 0,
        flash: "",
        inhale: 0,
      };
    });
    const first = Math.floor(Math.random() * people.length);
    people.forEach((person, index) => {
      person.readyAt = index === first ? 280 : 1400 + Math.random() * 800;
    });
    build();
    bind();
    paint();
    last = performance.now();
    raf = requestAnimationFrame(frame);
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
    unbind();
    host.replaceChildren();
    svg = null;
    people = [];
    drops = [];
  }

  function bind() {
    if (listening || !svg) return;
    listening = true;
    svg.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
  }

  function unbind() {
    if (!listening) return;
    listening = false;
    svg?.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("keydown", onKeyDown);
  }

  function onPointerDown(event) {
    if (!alive || held || ended) return;
    const node = event.target.closest?.("[data-seat]");
    if (!node) return;
    event.preventDefault();
    pressSeat(Number(node.dataset.seat));
  }

  function onKeyDown(event) {
    if (!alive || held || ended) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key >= "1" && event.key <= "6") {
      event.preventDefault();
      pressSeat(Number(event.key) - 1);
      return;
    }
    if (event.key === "Enter") {
      const node = event.target?.closest?.("[data-seat]");
      if (!node) return;
      event.preventDefault();
      pressSeat(Number(node.dataset.seat));
    }
  }

  function pressSeat(id) {
    const person = people[id];
    if (!person) return;
    const result = resolveTap(person, elapsed, combo);
    if (!result.ok) return;
    if (result.kind === "yawn") {
      combo = 0;
      person.mode = "idle";
      person.readyAt = gapFor(person.sprayed, Math.random);
      toast("arcadeSneezeYawn");
      paint();
      return;
    }
    combo = result.combo;
    score += result.gain;
    if (result.kind === "fever") {
      feverSent += 1;
      person.mode = "leave";
      person.leaveFor = 400;
      person.flash = "+2";
      person.flashFor = 400;
      toast("arcadeSneezeFever");
      play("good", combo);
      paint();
      return;
    }
    blocked += 1;
    person.mode = "cover";
    person.coverFor = 280;
    person.flash = "+1";
    person.flashFor = 280;
    play("muff");
    play("good", combo);
    paint();
  }

  function miss(person) {
    person.mode = "idle";
    person.flash = t("arcadeSneezeChoo");
    person.flashFor = 420;
    combo = 0;
    for (const id of coneTargets(person.id)) {
      const other = people[id];
      if (!other || other.mode === "leave") continue;
      if (!other.sprayed) sprayedPeople += 1;
      other.sprayed = true;
      other.readyAt = Math.min(other.readyAt, gapFor(true, Math.random));
    }
    spawnLock = Math.min(spawnLock, gapFor(true, Math.random));
    person.readyAt = gapFor(person.sprayed, Math.random);
    play("achoo");
    launchDrops(person);
  }

  function launchDrops(person) {
    if (reduced()) return;
    const x0 = person.x + 48 + person.face * 14;
    const y0 = person.y + 42;
    drops.forEach((drop, index) => {
      const spread = ((index - 3.5) / 3.5) * (Math.PI / 6);
      const ang = person.face > 0 ? spread : Math.PI - spread;
      const dist = 64 + (index % 3) * 18;
      drop.x0 = x0;
      drop.y0 = y0;
      drop.x1 = x0 + Math.cos(ang) * dist;
      drop.y1 = y0 + Math.sin(ang) * dist;
      drop.life = 280;
      drop.max = 280;
    });
  }

  function beginAct(person) {
    person.mode = rollKind(Math.random);
    person.until = elapsed + windMs(reduced());
    person.inhale = 0;
    person.flash = "";
    spawnLock = gapFor(people.some((item) => item.sprayed), Math.random);
  }

  function offerFever() {
    const idle = people.filter((person) => person.mode === "idle");
    if (!idle.length) {
      nextFever = elapsed + 400;
      return;
    }
    const person = idle[Math.floor(Math.random() * idle.length)];
    person.mode = "fever";
    person.flash = "";
    feverSeen += 1;
    nextFever = elapsed + feverDelay(Math.random);
  }

  function finishLeave(person) {
    person.cast = (person.cast + 1) % CAST.length;
    person.mode = "idle";
    person.sprayed = false;
    person.elbow = 0;
    person.flash = "";
    person.readyAt = gapFor(false, Math.random);
  }

  function frame(now) {
    if (!alive || held || ended) {
      raf = 0;
      return;
    }
    const dt = Math.min(80, now - last);
    last = now;
    elapsed += dt;
    for (const person of people) {
      if (person.flashFor > 0) person.flashFor -= dt;
      if (person.mode === "idle") person.readyAt -= dt;
      if (person.mode === "wind") {
        const span = windMs(reduced());
        const progress = 1 - (person.until - elapsed) / span;
        const marks = [0, 0.42, 0.75];
        while (person.inhale < marks.length && progress >= marks[person.inhale]) {
          play("inhale", person.inhale);
          person.inhale += 1;
        }
        if (elapsed >= person.until) miss(person);
      } else if (person.mode === "yawn" && elapsed >= person.until) {
        person.mode = "idle";
        person.readyAt = gapFor(person.sprayed, Math.random);
      } else if (person.mode === "cover") {
        person.coverFor -= dt;
        if (person.coverFor <= 0) {
          person.mode = "idle";
          person.flash = "";
          person.readyAt = gapFor(person.sprayed, Math.random);
        }
      } else if (person.mode === "leave") {
        person.leaveFor -= dt;
        if (person.leaveFor <= 0) finishLeave(person);
      }
      const target = person.mode === "cover" ? -70 : 0;
      const step = reduced() ? 70 : (70 * dt) / 120;
      person.elbow += Math.max(-step, Math.min(step, target - person.elbow));
    }
    spawnLock -= dt;
    const winding = people.filter((person) => person.mode === "wind" || person.mode === "yawn").length;
    if (spawnLock <= 0 && winding < 2) {
      const id = pickReady(people, Math.random);
      if (id >= 0) beginAct(people[id]);
    }
    if (elapsed >= nextFever) offerFever();
    for (const drop of drops) {
      if (drop.life > 0) drop.life -= dt;
    }
    if (elapsed >= ROUND_MS) finish();
    else paint();
    if (alive && !ended && !held) raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (ended) return;
    ended = true;
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    paint();
    hooks.onFinish?.({
      id: SNEEZE.id,
      score,
      stars: starsFor({ blocked, sprayed: sprayedPeople, feverSeen, feverSent }),
      blocked,
      sprayed: sprayedPeople,
      feverSeen,
      feverSent,
    });
  }

  function paint() {
    if (!svg) return;
    const left = svg.parentElement?.querySelector("[data-arcade-left]");
    const scoreNode = svg.parentElement?.querySelector("[data-arcade-score]");
    const comboNode = svg.parentElement?.querySelector("[data-arcade-combo]");
    if (left) left.textContent = t("arcadeSeconds", { n: Math.max(0, Math.ceil((ROUND_MS - elapsed) / 1000)) });
    if (scoreNode) scoreNode.textContent = String(score);
    if (comboNode) comboNode.textContent = combo > 1 ? t("arcadeCombo", { n: combo }) : "";
    svg.dataset.roundMs = String(ROUND_MS);
    svg.dataset.windMs = String(windMs(reduced()));
    svg.dataset.reduced = reduced() ? "1" : "0";
    svg.dataset.blocked = String(blocked);
    svg.dataset.sprayed = String(sprayedPeople);
    svg.dataset.feverSeen = String(feverSeen);
    svg.dataset.feverSent = String(feverSent);
    for (const person of people) paintPerson(person);
    for (const drop of drops) {
      if (reduced() || drop.life <= 0) {
        drop.node.setAttribute("opacity", "0");
        continue;
      }
      const u = 1 - drop.life / drop.max;
      const x = drop.x0 + (drop.x1 - drop.x0) * u;
      const y = drop.y0 + (drop.y1 - drop.y0) * u;
      drop.node.setAttribute("transform", `translate(${x} ${y})`);
      drop.node.setAttribute("opacity", "1");
    }
  }

  function paintPerson(person) {
    const cast = CAST[person.cast];
    const node = person.node;
    const showHeart = person.mode === "leave";
    const span = windMs(reduced());
    const liveTilt = !reduced() && person.mode === "wind"
      ? -18 * Math.max(0, Math.min(1, 1 - (person.until - elapsed) / span))
      : 0;
    node.setAttribute("data-mode", person.mode);
    node.setAttribute("data-sprayed", person.sprayed ? "1" : "0");
    node.setAttribute("data-role", cast.role);
    node.setAttribute("aria-label", labelFor(person, cast));
    const shift = person.mode === "leave" && !reduced() ? (1 - person.leaveFor / 400) : 0;
    const dx = (180 - person.x) * Math.max(0, Math.min(1, shift));
    const dy = (8 - person.y) * Math.max(0, Math.min(1, shift));
    node.setAttribute("transform", `translate(${person.x + dx} ${person.y + dy})`);
    person.skin.setAttribute("fill", cast.skin);
    person.hair.setAttribute("fill", cast.hair);
    person.body.setAttribute("fill", cast.body);
    person.sleeve.setAttribute("fill", cast.body);
    person.head.setAttribute("transform", `translate(48 34) rotate(${liveTilt})`);
    person.mouth.setAttribute("d", facePath(person.mode, showHeart));
    person.mouth.setAttribute("fill", INK);
    person.arm.setAttribute("transform", `translate(34 52) rotate(${person.elbow.toFixed(2)} 6 2)`);
    person.thermo.setAttribute("opacity", person.mode === "fever" ? "1" : "0");
    if (person.mode === "cover") {
      person.drop.setAttribute("cx", String(48 + person.face * 12));
      person.drop.setAttribute("cy", "40");
      person.drop.setAttribute("r", "8");
      person.drop.setAttribute("fill", PUFF);
      person.drop.setAttribute("opacity", "0.95");
    } else if (person.sprayed && person.mode !== "leave") {
      person.drop.setAttribute("cx", "66");
      person.drop.setAttribute("cy", "28");
      person.drop.setAttribute("r", "4");
      person.drop.setAttribute("fill", DROP);
      person.drop.setAttribute("opacity", "1");
    } else {
      person.drop.setAttribute("opacity", "0");
    }
    person.hint.textContent = hintFor(person);
    person.hint.setAttribute("fill", INK);
  }

  function labelFor(person, cast) {
    const name = t(cast.label);
    if (person.mode === "wind") return `${name} ${t("arcadeSneezeAh")}`;
    if (person.mode === "fever") return `${name} ${t("arcadeSneezeFever")}`;
    if (person.mode === "yawn") return `${name} ${t("arcadeYawn")}`;
    return `${name} ${person.id + 1}`;
  }

  function hintFor(person) {
    if (person.flashFor > 0 && person.flash) return person.flash;
    if (person.mode === "wind") {
      const full = t("arcadeSneezeAh");
      if (!reduced()) return full;
      const chars = Array.from(full);
      const span = windMs(true);
      const progress = Math.max(0, Math.min(1, 1 - (person.until - elapsed) / span));
      const count = Math.max(1, Math.ceil(chars.length * progress));
      return chars.slice(0, count).join("");
    }
    if (person.mode === "cover") return "+1";
    if (person.mode === "leave") return "+2";
    if (person.mode === "idle") return String(person.id + 1);
    return "";
  }

  function build() {
    host.replaceChildren();
    const hud = document.createElement("div");
    hud.className = "arcade-hud";
    hud.innerHTML = `<span data-arcade-left></span><b data-arcade-score>0</b><span data-arcade-combo></span>`;
    svg = el("svg", { viewBox: "0 0 360 480", role: "group" });
    svg.setAttribute("aria-label", t(SNEEZE.titleKey));
    el("rect", { x: 0, y: 0, width: 360, height: 480, fill: wallShade, "pointer-events": "none" }, svg);
    el("rect", { x: 0, y: 0, width: 360, height: 52, fill: c7ec4dc, "pointer-events": "none" }, svg);
    el("rect", { x: 0, y: 300, width: 360, height: 180, fill: beach, "pointer-events": "none" }, svg);
    el("rect", { x: 150, y: 8, width: 60, height: 36, rx: 6, fill: wood, "pointer-events": "none" }, svg);
    for (const person of people) {
      el("rect", {
        x: person.x + 10,
        y: person.y + 44,
        width: 76,
        height: 58,
        rx: 8,
        fill: sand,
        "pointer-events": "none",
      }, svg);
    }
    for (const person of people) buildSeat(person);
    const layer = el("g", { class: "arcade-drops", "pointer-events": "none" }, svg);
    drops = Array.from({ length: 8 }, () => {
      const node = el("circle", {
        class: "arcade-flydrop",
        r: 3,
        fill: DROP,
        opacity: 0,
      }, layer);
      return { node, x0: 0, y0: 0, x1: 0, y1: 0, life: 0, max: 280 };
    });
    host.append(hud, svg);
  }

  function buildSeat(person) {
    const node = el("g", {
      class: "arcade-seat",
      role: "button",
      tabindex: "0",
      "data-seat": person.id,
    }, svg);
    el("rect", {
      class: "arcade-hit",
      x: 0,
      y: 0,
      width: 96,
      height: 110,
      fill: PAPER,
      opacity: 0,
      "pointer-events": "all",
    }, node);
    person.body = el("rect", { x: 28, y: 48, width: 40, height: 50, rx: 10, "pointer-events": "none" }, node);
    person.head = el("g", { class: "arcade-head", "pointer-events": "none" }, node);
    person.skin = el("circle", { cx: 0, cy: 0, r: 16, "pointer-events": "none" }, person.head);
    person.hair = el("ellipse", { cx: 0, cy: -7, rx: 16, ry: 8, "pointer-events": "none" }, person.head);
    person.mouth = el("path", { "pointer-events": "none" }, person.head);
    person.arm = el("g", { class: "arcade-arm", "pointer-events": "none" }, node);
    person.sleeve = el("rect", { x: 0, y: 0, width: 12, height: 28, rx: 6, "pointer-events": "none" }, person.arm);
    person.drop = el("circle", { cx: 66, cy: 28, r: 4, opacity: 0, "pointer-events": "none" }, node);
    person.thermo = el("rect", {
      x: 64,
      y: 16,
      width: 6,
      height: 18,
      rx: 3,
      fill: cc4473a,
      opacity: 0,
      "pointer-events": "none",
    }, node);
    person.hint = el("text", {
      x: 48,
      y: 12,
      "text-anchor": "middle",
      "font-size": 12,
      fill: INK,
      "pointer-events": "none",
    }, node);
    person.node = node;
  }

  return { start, pause, stop };
}
