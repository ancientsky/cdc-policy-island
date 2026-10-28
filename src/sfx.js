// Original implementation for this project. Not derived from third-party source code.

const KEY = "cdc-island-sound";

let ctx = null;
let master = null;
let compressor = null;
let started = false;
let enabled = readEnabled();
let ocean = null;
const counts = {};
const attempts = {};
const notes = [];
const hoverAt = new Map();
let arriveAt = 0;

function readEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function writeEnabled(on) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private mode */
  }
}

function remember(freq) {
  notes.push(freq);
  if (notes.length > 32) notes.shift();
}

function count(name) {
  counts[name] = (counts[name] || 0) + 1;
}

function attempt(name) {
  attempts[name] = (attempts[name] || 0) + 1;
}

function tone({ type, freq, freqTo, dur, gain, delay = 0, vibrato }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.frequency.setValueAtTime(freq, t0);
  if (freqTo != null) osc.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vibrato.rate;
    const depth = ctx.createGain();
    depth.gain.value = vibrato.depth;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.03);
  }
  osc.connect(amp);
  amp.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
  remember(freq);
  if (freqTo != null) remember(freqTo);
}

function noise({ dur, gain, band, q }) {
  const rate = ctx.sampleRate;
  const frames = Math.max(1, Math.ceil(rate * dur));
  const buffer = ctx.createBuffer(1, frames, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = band;
  filter.Q.value = q;
  const amp = ctx.createGain();
  const t0 = ctx.currentTime;
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(amp);
  amp.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.03);
}

function startOcean() {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 2);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last;
  }
  let mean = 0;
  for (let i = 0; i < length; i += 1) mean += data[i];
  mean /= length;
  let peak = 0;
  for (let i = 0; i < length; i += 1) {
    data[i] -= mean;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  const scale = peak > 0 ? 0.8 / peak : 1;
  const fade = Math.min(Math.floor(rate * 0.03), length >> 2);
  for (let i = 0; i < length; i += 1) data[i] *= scale;
  for (let i = 0; i < fade; i += 1) {
    const k = i / fade;
    const end = length - fade + i;
    data[end] = data[end] * (1 - k) + data[i] * k;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const amp = ctx.createGain();
  amp.gain.value = 0.021;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const depth = ctx.createGain();
  depth.gain.value = 0.009;
  lfo.connect(depth);
  depth.connect(amp.gain);
  src.connect(filter);
  filter.connect(amp);
  amp.connect(master);
  src.start();
  lfo.start();
  ocean = src;
}

function unlock() {
  if (ctx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.6 : 0;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    started = true;
    try {
      startOcean();
    } catch {
      ocean = null;
    }
    if (ctx.state === "suspended") {
      const job = ctx.resume();
      if (job && typeof job.catch === "function") job.catch(() => {});
    }
  } catch {
    ctx = null;
    master = null;
    compressor = null;
    started = false;
    ocean = null;
  }
}

document.addEventListener("pointerdown", unlock, true);
document.addEventListener("keydown", unlock, true);
document.addEventListener("visibilitychange", () => {
  if (!ctx) return;
  const job = document.visibilityState === "hidden" ? ctx.suspend() : ctx.resume();
  if (job && typeof job.catch === "function") job.catch(() => {});
});

export function play(name, id) {
  if (!ctx || !started || !enabled) return;
  if (name === "hover") {
    if (id == null) return;
    attempt(name);
    const now = performance.now();
    const prev = hoverAt.get(id) || 0;
    if (now - prev < 300) return;
    hoverAt.set(id, now);
    count(name);
    tone({ type: "sine", freq: 880, dur: 0.04, gain: 0.035 });
    return;
  }
  if (name === "select") {
    count(name);
    tone({ type: "triangle", freq: 523, dur: 0.09, gain: 0.12 });
    // The 70ms gap starts when the first note ends, so the second note starts at 160ms.
    tone({ type: "triangle", freq: 784, dur: 0.09, gain: 0.12, delay: 0.16 });
    return;
  }
  if (name === "item") {
    count(name);
    tone({ type: "triangle", freq: 659, dur: 0.08, gain: 0.09 });
    return;
  }
  if (name === "hit") {
    count(name);
    noise({ dur: 0.12, gain: 0.18, band: 1200, q: 2 });
    tone({ type: "sine", freq: 600, freqTo: 180, dur: 0.15, gain: 0.15 });
    return;
  }
  if (name === "repel") {
    count(name);
    tone({ type: "sine", freq: 1047, dur: 0.07, gain: 0.1 });
    tone({ type: "sine", freq: 1319, dur: 0.07, gain: 0.1, delay: 0.07 });
    tone({ type: "sine", freq: 1568, dur: 0.07, gain: 0.1, delay: 0.14 });
    return;
  }
  if (name === "stamp") {
    count(name);
    tone({ type: "sine", freq: 120, dur: 0.08, gain: 0.25 });
    tone({ type: "sine", freq: 1320, dur: 0.15, gain: 0.06, delay: 0.05 });
    return;
  }
  if (name === "arrive") {
    attempt(name);
    const now = performance.now();
    if (now - arriveAt < 1500) return;
    arriveAt = now;
    count(name);
    tone({ type: "sine", freq: 660, dur: 0.22, gain: 0.05, vibrato: { rate: 3, depth: 8 } });
    return;
  }
  if (name === "mission") {
    count(name);
    [523, 659, 784, 1047].forEach((freq, index) => {
      tone({ type: "triangle", freq, dur: 0.08, gain: 0.1, delay: index * 0.08 });
    });
  }
}

export function isOn() {
  return enabled;
}

export function setOn(on) {
  enabled = Boolean(on);
  writeEnabled(enabled);
  // The surf sits after master, so gain 0 silences it with everything else.
  if (master) master.gain.value = enabled ? 0.6 : 0;
}

export function toggle() {
  setOn(!enabled);
  return enabled;
}

if (import.meta.env.DEV) {
  window.__sfx = {
    state() {
      return {
        started,
        enabled,
        state: ctx ? ctx.state : "none",
        counts: { ...counts },
        attempts: { ...attempts },
        notes: notes.slice(),
        masterGain: master ? master.gain.value : null,
        threshold: compressor ? compressor.threshold.value : null,
        ratio: compressor ? compressor.ratio.value : null,
        ocean: Boolean(ocean),
      };
    },
    play,
    toggle,
    isOn,
  };
}
