// Season board. Pure dates, no DOM. Kid sentences live in i18n and quote existing actions.
// Sources were opened before the copy shipped. Case counts stay off the board.
// WAAW is 18–24 November, including 2026:
// https://www.who.int/campaigns/world-amr-awareness-week
// The antibiotic sentence is the island action. CDC list:
// https://www.cdc.gov.tw/Category/List/m6WabdS8tHTXcOkBGtlaew
// Flu note uses only the 2026-11-03 dates (opens 10/1, second stage 11/2):
// https://www.cdc.gov.tw/Bulletin/Detail/57M9H7NQtbjNyO5ygCgNiA?typeid=9
// Enterovirus page is the 2014-06-10 peak bulletin (handwashing, sleepy, twitching, vomiting).
// Dengue page is the 2014-10-28 peak bulletin (clear water containers).
// Summer page is the 2013-06-20 bulletin (summer trips, enteric and vector season).
// The 4–6 week clinic line is the existing border action.

export const LUNAR_NEW_YEAR = {
  2027: "02-06",
  2028: "01-26",
  2029: "02-13",
  2030: "02-03",
};

const WHO_WAAW = "https://www.who.int/campaigns/world-amr-awareness-week";
const FLU_SRC = "https://www.cdc.gov.tw/Bulletin/Detail/57M9H7NQtbjNyO5ygCgNiA?typeid=9";
const ENTERO_SRC = "https://www.cdc.gov.tw/Category/ListContent/xdiZ0NuS67snzX0a7DGUHg?uaid=-NnRIHS7OhT3rS_QtOD4hg";
const DENGUE_SRC = "https://www.cdc.gov.tw/Category/ListContent/z3l-ni_hN8XQhdqusEuKQA?uaid=XpvlmlYnSv3Grwy23-j9Rg";
const SUMMER_SRC = "https://www.cdc.gov.tw/Category/ListContent/z3l-ni_hN8XQhdqusEuKQA?uaid=QT8bFGLH8mM2ZXwiTcwS6Q";
const TRAVEL_SRC = "https://www.cdc.gov.tw/Category/List/3GJWZ0ETfmdGzIS7H0Jucg";
const LEPTO_SRC = "https://www.cdc.gov.tw/Disease/SubIndex/T5nLeG_WEMafixCPa1M7Jw";
const HAND_SRC = "https://www.cdc.gov.tw/Category/List/cdY5T1LSwpw6wKrEAt7yCw";
const HIV_SRC = "https://www.cdc.gov.tw/Disease/SubIndex/651";
const TB_SRC = "https://www.cdc.gov.tw/Disease/SubIndex/j5_xY8JbRq3IzXAqxbnAvQ";
const HEPA_SRC = "https://at.cdc.gov.tw/72dPFo";
const AIDS_DAY_SRC = "https://at.cdc.gov.tw/h2o704";

function row(id, from, to, rank, order, island, sticker, src, spans = null) {
  return {
    id,
    from,
    to,
    spans,
    rank,
    order,
    island,
    sticker,
    src,
    sayKey: `seasonSay_${id}`,
    taskKey: `seasonTask_${id}`,
    noteKey: `seasonNote_${id}`,
    stickerKey: `seasonSticker_${id}`,
  };
}

export const SEASONS = [
  row("amrweek", "11-18", "11-24", 3, 1, "amr", "amrweek", WHO_WAAW),
  row("aids", "11-28", "12-04", 3, 2, "hiv", "aids", AIDS_DAY_SRC),
  row("tbday", "03-21", "03-27", 3, 3, "tb", "tbday", TB_SRC),
  row("hand", "05-02", "05-08", 3, 4, "ipc", "hand", HAND_SRC),
  row("hepa", "07-25", "07-31", 3, 5, "hepa", "hepa", HEPA_SRC),
  row("school", "02-10", "02-28", 2, 7, "entero", "school", ENTERO_SRC, [["02-10", "02-28"], ["08-25", "09-15"]]),
  row("summer", "07-01", "08-31", 2, 8, "border", "summer", SUMMER_SRC),
  row("entero", "04-01", "06-30", 1, 9, "entero", "entero", ENTERO_SRC),
  row("flu", "10-01", "03-31", 1, 10, "flu", "flu", FLU_SRC),
  row("dengue", "06-01", "11-30", 1, 11, "dengue", "dengue", DENGUE_SRC),
  row("storm", "07-01", "10-31", 1, 12, "dengue", "storm", LEPTO_SRC),
];

const LUNAR_SEASON = row("lunar", "01-01", "01-01", 2, 6, "border", "lunar", TRAVEL_SRC);

const BY_ID = new Map(SEASONS.map((item) => [item.id, item]));
BY_ID.set("lunar", LUNAR_SEASON);

const KEY = "cdc-island-season-v1";

function monthDay(token) {
  const [month, day] = String(token || "").split("-").map(Number);
  return month * 100 + day;
}

function inSpan(date, from, to) {
  const cur = (date.getMonth() + 1) * 100 + date.getDate();
  const start = monthDay(from);
  const end = monthDay(to);
  if (start <= end) return cur >= start && cur <= end;
  return cur >= start || cur <= end;
}

function covers(season, date) {
  if (season.spans) return season.spans.some(([from, to]) => inSpan(date, from, to));
  return inSpan(date, season.from, season.to);
}

function ymd(date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function shiftDay(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function lunarHit(date) {
  const years = [date.getFullYear() - 1, date.getFullYear()];
  for (const year of years) {
    const token = LUNAR_NEW_YEAR[year];
    if (!token) continue;
    const [month, day] = token.split("-").map(Number);
    const center = new Date(year, month - 1, day);
    const start = shiftDay(center, -10);
    const end = shiftDay(center, 5);
    const cur = ymd(date);
    if (cur >= ymd(start) && cur <= ymd(end)) return { ...LUNAR_SEASON };
  }
  return null;
}

export function parseDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const stamp = new Date(year, month - 1, day);
  if (stamp.getFullYear() !== year || stamp.getMonth() !== month - 1 || stamp.getDate() !== day) return null;
  return stamp;
}

export function isoDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function yearKey(date, id) {
  return `${date.getFullYear()}-${id}`;
}

export function seasonById(id) {
  return BY_ID.get(id) || null;
}

export function activeSeasons(date) {
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const hits = SEASONS.filter((item) => covers(item, when));
  const lunar = lunarHit(when);
  if (lunar) hits.push(lunar);
  hits.sort((a, b) => b.rank - a.rank || a.order - b.order);
  return hits;
}

export function seasonBoard(date) {
  const all = activeSeasons(date);
  return { theme: all[0] || null, notes: all.slice(1, 3), all };
}

export function seasonNoteKey(season, date) {
  if (!season) return "";
  if (season.id === "dengue") {
    const month = date.getMonth() + 1;
    if (month === 11) return "seasonNote_dengueTail";
    if (month === 10) return "seasonNote_denguePeak";
  }
  return season.noteKey;
}

export function pipiHome(date) {
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const md = (when.getMonth() + 1) * 100 + when.getDate();
  return md >= 1001 || md <= 415 ? "winter" : "summer";
}

export function seasonDone(season, book) {
  if (!season || !book) return false;
  const islands = book.islands || {};
  const eggs = book.eggs || {};
  if (season.id === "flu") return Boolean(islands.flu || islands.vax);
  if (season.id === "storm") return Boolean(islands.dengue || eggs.lepto);
  return Boolean(islands[season.island]);
}

function emptySeason() {
  return { v: 1, seen: {}, stickers: {} };
}

function keyOk(key) {
  return /^\d{4}-[a-z]+$/.test(key);
}

function seenMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!keyOk(key) || typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) continue;
    out[key] = raw;
  }
  return out;
}

function stickerMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const n = Number(raw);
    if (!keyOk(key) || !Number.isFinite(n) || n <= 0) continue;
    out[key] = n;
  }
  return out;
}

export function loadSeason() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || raw.v !== 1) return emptySeason();
    return { v: 1, seen: seenMap(raw.seen), stickers: stickerMap(raw.stickers) };
  } catch {
    return emptySeason();
  }
}

export function saveSeason(card) {
  const next = {
    v: 1,
    seen: seenMap(card?.seen),
    stickers: stickerMap(card?.stickers),
  };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}

export function clearSeason() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

export function seasonSelfTest() {
  const errors = [];
  const expect = [
    ["2026-11-18", ["amrweek", "flu", "dengue"]],
    ["2026-11-30", ["aids", "flu", "dengue"]],
    ["2026-12-01", ["aids", "flu"]],
    ["2027-01-15", ["flu"]],
    ["2027-02-06", ["lunar", "flu"]],
    ["2027-02-15", ["school", "flu"]],
    ["2027-03-24", ["tbday", "flu"]],
    ["2027-04-20", ["entero"]],
    ["2027-05-05", ["hand", "entero"]],
    ["2027-07-10", ["summer", "dengue", "storm"]],
    ["2027-07-28", ["hepa", "summer", "dengue", "storm"]],
    ["2027-10-15", ["flu", "dengue", "storm"]],
  ];
  if (expect.length !== 12) errors.push("season date table is not 12 rows");
  for (const [iso, ids] of expect) {
    const got = activeSeasons(parseDay(iso)).map((item) => item.id);
    if (got.join(",") !== ids.join(",")) errors.push(`${iso} seasons ${got.join(",")} want ${ids.join(",")}`);
  }
  const rows = [...SEASONS, LUNAR_SEASON];
  for (const item of rows) {
    if (!item.src || !item.src.startsWith("https://")) errors.push(`${item.id} src is empty`);
  }
  const nov = seasonBoard(parseDay("2026-11-18"));
  if (nov.theme?.id !== "amrweek") errors.push("2026-11-18 theme is not antibiotic week");
  if (nov.notes.map((item) => item.id).join(",") !== "flu,dengue") errors.push("2026-11-18 notes are not flu then dengue");
  if (seasonNoteKey(nov.notes[1], parseDay("2026-11-18")) !== "seasonNote_dengueTail") errors.push("November dengue note is not the tail");
  const july = seasonBoard(parseDay("2027-07-10"));
  if (july.theme?.id !== "summer") errors.push("2027-07-10 theme is not summer travel");
  const april = seasonBoard(parseDay("2027-04-20"));
  if (april.theme?.id !== "entero" || april.notes.length !== 0) errors.push("2027-04-20 is not entero alone");
  const school = seasonBoard(parseDay("2027-02-15"));
  if (school.theme?.id !== "school") errors.push("2027-02-15 theme is not school");
  if (school.all.some((item) => item.id === "entero" || item.id === "lunar")) errors.push("2027-02-15 also matched entero or lunar");
  if (pipiHome(parseDay("2026-11-18")) !== "winter") errors.push("November Pipi is not wintering");
  if (pipiHome(parseDay("2027-04-15")) !== "winter") errors.push("April 15 Pipi is not wintering");
  if (pipiHome(parseDay("2027-04-16")) !== "summer") errors.push("April 16 Pipi is not away");
  if (pipiHome(parseDay("2027-07-10")) !== "summer") errors.push("July Pipi is not away");
  if (pipiHome(parseDay("2027-10-01")) !== "winter") errors.push("October 1 Pipi is not wintering");
  if (!HIV_SRC.startsWith("https://")) errors.push("hiv src missing");
  return errors;
}
