// Original implementation for this project. Not derived from third-party source code.

const KEY = "cdc-island-gfx-v1";
const RELOAD_KEY = "cdc-island-gfx-reload";
const ORDER = ["full", "noshadow", "nopost", "rescue"];

let live = null;

function stamp() {
  return new Date().toISOString();
}

function nextRung(rung) {
  const index = ORDER.indexOf(rung);
  if (index < 0) return "noshadow";
  return ORDER[Math.min(index + 1, ORDER.length - 1)];
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !ORDER.includes(data.rung)) return null;
    return data;
  } catch {
    return null;
  }
}

function writeStored(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 1,
      rung: state.rung,
      pending: state.pending,
      ok: state.ok,
      gpu: state.gpu,
      at: state.at,
    }));
  } catch {
    // Private mode keeps no record. The page still draws.
  }
}

export function gpuName(gl) {
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
    const vendorName = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : "";
    const fallbackR = gl.getParameter(gl.RENDERER);
    const fallbackV = gl.getParameter(gl.VENDOR);
    return [rendererName || fallbackR, vendorName || fallbackV].filter(Boolean).join(" / ") || "unknown";
  } catch {
    return "unknown";
  }
}

export function bootQuality() {
  const record = read();
  let rung = "full";
  let stepped = null;
  if (record) {
    rung = record.rung;
    if (record.pending && ORDER.includes(record.pending)) {
      stepped = record.pending;
      rung = nextRung(record.pending);
      console.error(`quality: stepped down from ${stepped} (page died while pending)`);
    }
  }
  return { rung, rescue: rung === "rescue", stepped, record };
}

export function settleQuality(plan, gpu, { powervr = false, openedRescue = false } = {}) {
  let rung = ORDER.includes(plan?.rung) ? plan.rung : "full";
  let stepped = plan?.stepped || null;
  const record = plan?.record;
  if (record && record.gpu && record.gpu !== gpu) {
    rung = "full";
    stepped = null;
  }
  if (openedRescue) rung = "rescue";
  const shadow = rung === "full" && !powervr;
  const post = rung === "full" || rung === "noshadow";
  live = {
    v: 1,
    rung,
    pending: rung,
    ok: null,
    gpu,
    at: stamp(),
    shadow,
    post,
    stepped,
  };
  writeStored(live);
  return live;
}

export function markQualityOk() {
  if (!live || live.ok === live.rung) return;
  live.pending = null;
  live.ok = live.rung;
  live.at = stamp();
  writeStored(live);
}

export function noteQualityLoss() {
  if (!live) return { reload: false };
  if (live.ok === live.rung) return { reload: false };
  const from = live.rung;
  live.rung = nextRung(from);
  live.pending = null;
  live.ok = null;
  live.stepped = from;
  live.shadow = false;
  live.post = live.rung === "full" || live.rung === "noshadow";
  live.at = stamp();
  writeStored(live);
  console.error(`quality: stepped down from ${from} (context lost before ok)`);
  return { reload: requestReload() };
}

export function requestReload() {
  try {
    const count = Number(sessionStorage.getItem(RELOAD_KEY) || "0") || 0;
    if (count >= 2) return false;
    sessionStorage.setItem(RELOAD_KEY, String(count + 1));
    return true;
  } catch {
    return false;
  }
}

export function resetQuality() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Private mode has nothing to clear.
  }
}

export function qualityText(contacts = 0, visible = false) {
  if (!live) return "n/a";
  return [
    `rung=${live.rung}`,
    `shadow=${live.shadow ? "true" : "false"}`,
    `pending=${live.pending ?? "null"}`,
    `ok=${live.ok ?? "null"}`,
    `stepped=${live.stepped || "none"}`,
    `contacts=${contacts}`,
    `visible=${visible ? "true" : "false"}`,
  ].join(" ");
}
