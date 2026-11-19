// Patrol postcard and certificate. Canvas 2D only, so a lost WebGL context can still draw it.
// The sentence on the card is an island action the player already read. No new health claim.

import { offsetToWorld } from "./hex.js";
import {
  c162230,
  c4a6280,
  c49c8d2,
  c7eaea8,
  c8d7348,
  cfffaf2,
  paper,
  sail,
  sand,
  wood,
} from "./palette.js";

const KEY = "cdc-island-postcard-v1";
const TOS = ["family", "grand", "teacher", "self"];
const CARD_W = 1080;
const CARD_H = 1350;

export function emptyPostcard() {
  return { v: 1, to: "family", sign: "", sent: 0 };
}

export function loadPostcard() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || raw.v !== 1) return emptyPostcard();
    const to = TOS.includes(raw.to) ? raw.to : "family";
    const sign = String(raw.sign || "").slice(0, 8);
    const sent = Math.max(0, Math.floor(Number(raw.sent) || 0));
    return { v: 1, to, sign, sent };
  } catch {
    return emptyPostcard();
  }
}

export function savePostcard(card) {
  const next = {
    v: 1,
    to: TOS.includes(card?.to) ? card.to : "family",
    sign: String(card?.sign || "").slice(0, 8),
    sent: Math.max(0, Math.floor(Number(card?.sent) || 0)),
  };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}

export function clearPostcard() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

export function cardDate(search = "", now = new Date()) {
  const raw = new URLSearchParams(search).get("date") || "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const stamp = new Date(Date.UTC(year, month - 1, day));
    if (stamp.getUTCFullYear() === year && stamp.getUTCMonth() === month - 1 && stamp.getUTCDate() === day) return raw;
  }
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function holdToSave(nav = navigator) {
  const ua = nav.userAgent || "";
  if (/iP(ad|hone|od)/.test(ua)) return true;
  return nav.platform === "MacIntel" && nav.maxTouchPoints > 1;
}

export function stampSpots(islands) {
  return (islands || []).map((island) => {
    const world = offsetToWorld(Number(island.col) || 0, Number(island.row) || 0);
    return {
      id: island.id,
      no: island.no || "",
      nick: island.nick || "",
      accent: island.accent || c49c8d2,
      visited: Boolean(island.visited),
      x: world.x,
      y: world.z,
    };
  });
}

function mapSpots(spots, box) {
  if (!spots.length) return [];
  const xs = spots.map((spot) => spot.x);
  const ys = spots.map((spot) => spot.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  return spots.map((spot) => ({
    ...spot,
    px: box.x + ((spot.x - minX) / spanX) * box.w,
    py: box.y + ((spot.y - minY) / spanY) * box.h,
  }));
}

export function wrapLines(ctx, text, maxWidth, maxLines) {
  const chars = [...String(text || "")];
  const lines = [];
  let line = "";
  let index = 0;
  while (index < chars.length && lines.length < maxLines) {
    const next = line + chars[index];
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = "";
      continue;
    }
    line = next;
    index += 1;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (index < chars.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function quotedFamily(family) {
  return String(family || "sans-serif").split(",").map((part) => {
    const name = part.trim().replace(/^["']|["']$/g, "");
    if (!name) return "";
    return /\s/.test(name) ? `"${name}"` : name;
  }).filter(Boolean).join(", ");
}

function font(px, weight, family) {
  return `${weight} ${px}px ${family}`;
}

async function readyFonts(family, text) {
  const link = document.getElementById("ja-fonts");
  if (link && !link.sheet) {
    await new Promise((resolve) => {
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", resolve, { once: true });
    });
  }
  if (document.fonts?.load) {
    try {
      await document.fonts.load(`700 32px ${family}`, text);
      await document.fonts.load(`400 10px ${family}`, text);
    } catch {
      // A missing face still draws with the next family in the list.
    }
  }
  if (document.fonts?.ready) await document.fonts.ready;
}

function drawBird(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = sail;
  ctx.beginPath();
  ctx.ellipse(70, 78, 46, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c7eaea8;
  ctx.beginPath();
  ctx.ellipse(108, 48, 16, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = wood;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(118, 46);
  ctx.lineTo(168, 40);
  ctx.stroke();
  ctx.fillStyle = paper;
  ctx.strokeStyle = c8d7348;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(148, 18, 36, 28);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStamp(ctx, spot, family) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(spot.px, spot.py, 22, 0, Math.PI * 2);
  ctx.textAlign = "center";
  if (spot.visited) {
    ctx.fillStyle = spot.accent;
    ctx.fill();
    ctx.fillStyle = paper;
    ctx.textBaseline = "middle";
    ctx.font = font(14, 700, family);
    ctx.fillText(spot.no, spot.px, spot.py - 6);
    ctx.font = font(11, 700, family);
    const nick = wrapLines(ctx, spot.nick, 40, 1)[0] || "";
    ctx.fillText(nick, spot.px, spot.py + 8);
  } else {
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = c4a6280;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPostmark(ctx, date, family) {
  ctx.save();
  ctx.strokeStyle = c49c8d2;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(930, 1120, 72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = c162230;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font(22, 700, family);
  ctx.fillText(date, 930, 1120);
  ctx.restore();
}

export async function drawPostcard(canvas, spec) {
  const family = quotedFamily(getComputedStyle(document.body).fontFamily || "sans-serif");
  await readyFonts(family, `${spec.footer || ""}${spec.url || ""}${spec.line || ""}${spec.greeting || ""}`);
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = cfffaf2;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  if (spec.kind === "certificate") {
    ctx.strokeStyle = c8d7348;
    ctx.lineWidth = 18;
    ctx.strokeRect(28, 28, CARD_W - 56, CARD_H - 56);
    ctx.strokeStyle = sand;
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, CARD_W - 96, CARD_H - 96);
  }
  ctx.fillStyle = c162230;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = font(40, 700, family);
  ctx.fillText(spec.kind === "certificate" ? spec.certTitle : spec.greeting, 72, 78);
  if (spec.kind === "certificate") {
    ctx.font = font(28, 700, family);
    ctx.fillText(spec.greeting, 72, 136);
  }
  drawBird(ctx, 48, 150);
  ctx.font = font(28, 700, family);
  ctx.fillStyle = c162230;
  const patrol = wrapLines(ctx, spec.patrol, 620, 3);
  patrol.forEach((line, index) => ctx.fillText(line, 300, 190 + index * 40));
  const box = { x: 140, y: 340, w: 800, h: 400 };
  const spots = mapSpots(stampSpots(spec.islands), box);
  for (const spot of spots) drawStamp(ctx, spot, family);
  ctx.fillStyle = c162230;
  ctx.font = font(24, 700, family);
  ctx.fillText(spec.teachLead, 72, 800);
  ctx.font = font(32, 700, family);
  const taught = wrapLines(ctx, spec.line, 920, 3);
  taught.forEach((line, index) => ctx.fillText(line, 72, 844 + index * 44));
  if (spec.sign) {
    ctx.font = font(24, 700, family);
    ctx.fillText(spec.sign, 72, 990);
  }
  drawPostmark(ctx, spec.date, family);
  ctx.fillStyle = c162230;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = font(10, 400, family);
  ctx.fillText(spec.footer, 72, 1288);
  ctx.fillText(spec.url, 72, 1308);
  return { width: CARD_W, height: CARD_H, spots };
}
