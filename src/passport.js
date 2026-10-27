// Original implementation for this project. Not derived from third-party source code.

const KEY = "cdc-island-passport-v1";

function empty() {
  return { v: 1, islands: {}, items: {}, flows: {}, missions: {}, done: false, welcome: 0 };
}

function numMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const n = Number(raw);
    if (!key || !Number.isFinite(n)) continue;
    out[key] = n;
  }
  return out;
}

export function save(book) {
  try { localStorage.setItem(KEY, JSON.stringify(book)); } catch { /* private mode */ }
}

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || raw.v !== 1) throw new Error("bad");
    const islands = numMap(raw.islands);
    const items = numMap(raw.items);
    const flows = numMap(raw.flows);
    const missions = numMap(raw.missions);
    if (!islands || !items || !flows || !missions) throw new Error("bad");
    return {
      v: 1,
      islands,
      items,
      flows,
      missions,
      done: Boolean(raw.done),
      welcome: Number.isFinite(Number(raw.welcome)) ? Number(raw.welcome) : 0,
    };
  } catch {
    const fresh = empty();
    save(fresh);
    return fresh;
  }
}

function remember(book, bag, id) {
  if (!book || !id || bag[id]) return false;
  bag[id] = Date.now();
  save(book);
  return true;
}

export function stampIsland(book, id) {
  return remember(book, book.islands, id);
}

export function markItem(book, id) {
  return remember(book, book.items, id);
}

export function markFlow(book, id) {
  return remember(book, book.flows, id);
}

export function markMission(book, id) {
  return remember(book, book.missions, id);
}

export function progress(book) {
  return {
    islands: Object.keys(book.islands).length,
    items: Object.keys(book.items).length,
    flows: Object.keys(book.flows).length,
    missions: Object.keys(book.missions).length,
    done: Boolean(book.done),
  };
}

export function reset(book) {
  book.islands = {};
  book.items = {};
  book.flows = {};
  book.missions = {};
  book.done = false;
  save(book);
  return book;
}
