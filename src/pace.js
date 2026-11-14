// Break startup work into macrotasks. Awaiting an already-finished promise
// only queues a microtask, and the browser still counts that as one long task.
// Callers must await the promise `step` returns, and must not await the null.

const SLICE_MS = 36;
let sliceAt = 0;

export function beginSlice() {
  sliceAt = performance.now();
}

function yieldToMain() {
  return new Promise((resolve) => {
    const done = () => resolve();
    try {
      const host = globalThis.scheduler;
      const schedulerYield = host && host.yield;
      if (typeof schedulerYield === "function") {
        Promise.resolve(schedulerYield.call(host)).then(done, () => {
          setTimeout(done, 0);
        });
        return;
      }
    } catch {
      // A partial scheduler throws. A timeout still gives the browser a turn.
    }
    setTimeout(done, 0);
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
