// Original implementation for this project. Not derived from third-party source code.

const buffer = [];

export function noteError(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!text) return;
  buffer.push(text);
  if (buffer.length > 20) buffer.splice(0, buffer.length - 20);
}

export function recentErrors() {
  return buffer.slice();
}

window.addEventListener("error", (event) => {
  noteError(event.message || "error");
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  noteError(reason instanceof Error ? reason.message : reason);
});
const report = console.error.bind(console);
console.error = (...args) => {
  noteError(args.map((item) => (item instanceof Error ? item.message : String(item))).join(" "));
  report(...args);
};
