// Break startup work into macrotasks. Awaiting an already-finished promise
// only queues a microtask, and the browser still counts that as one long task.
// Callers must await the promise `step` returns, and must not await the null.

const SLICE_MS = 36;
let sliceAt = 0;

export function beginSlice() {
  sliceAt = performance.now();
}

function yieldToMain() {
  const schedulerYield = globalThis.scheduler && globalThis.scheduler.yield;
  if (typeof schedulerYield === "function") return schedulerYield.call(globalThis.scheduler);
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function step() {
  if (performance.now() - sliceAt < SLICE_MS) return null;
  return yieldToMain().then(() => {
    sliceAt = performance.now();
  });
}

export function breakTask() {
  return yieldToMain().then(() => {
    sliceAt = performance.now();
  });
}

export function paintFirst() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}
