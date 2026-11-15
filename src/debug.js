// Original implementation for this project. Not derived from third-party source code.

import { recentErrors } from "./errors.js";

function line(label, value) {
  return `${label.padEnd(11, " ")}${value}`;
}

function format(data) {
  const errors = recentErrors();
  const events = data.events || [];
  const eventText = events.length
    ? events.map((event) => `${event.type}/${event.during}`).join(",")
    : "0";
  const errorText = errors.length ? errors.map((item) => `- ${item}`).join("\n") : "0";
  return [
    line("build", `${data.build} ${data.builtAt}`),
    line("ua", data.ua),
    line("gpu", data.gpu),
    line("fragileGpu", String(data.fragileGpu)),
    line("webgl", data.webgl),
    line("dpr", `${data.dpr}, pixel ${data.pixelRatio}`),
    line("css", data.css),
    line("buffer", data.buffer),
    line("caps", data.caps),
    line("tier", data.tier),
    line("shadow", data.shadow),
    line("programs", `${data.programs} USE_SHADOWMAP=${data.shadowPrograms}`),
    line("draws", `${data.draws} triangles=${data.triangles}`),
    line("lost", `${data.lost ? "true" : "false"} events=${eventText}`),
    line("quality", data.quality),
    line("errors", errorText),
  ].join("\n");
}

export function mountDebug({ scene }) {
  if (document.querySelector("#dbg")) return;
  const panel = document.createElement("aside");
  panel.id = "dbg";
  panel.className = "dbg";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "診斷");
  const actions = document.createElement("div");
  actions.className = "dbg-actions";
  const copy = document.createElement("button");
  copy.id = "dbg-copy";
  copy.type = "button";
  copy.className = "btn btn--solid";
  copy.textContent = "複製";
  const close = document.createElement("button");
  close.id = "dbg-close";
  close.type = "button";
  close.className = "btn";
  close.textContent = "關閉";
  const pre = document.createElement("pre");
  pre.id = "dbg-text";
  const buildId = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";
  const buildAt = typeof __BUILD_AT__ === "string" ? __BUILD_AT__ : "";
  pre.textContent = `build      ${buildId} ${buildAt}\n讀取中…`;
  actions.append(copy, close);
  panel.append(actions, pre);
  document.body.appendChild(panel);

  const paint = () => {
    const data = scene.diagnostics?.();
    if (!data) return;
    pre.textContent = format(data);
  };
  paint();
  const timer = window.setInterval(paint, 400);
  scene.onContextLoss?.(() => paint());

  copy.addEventListener("click", async () => {
    const text = pre.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = "已複製";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      copy.textContent = "請長按複製";
    }
  });
  close.addEventListener("click", () => {
    window.clearInterval(timer);
    panel.remove();
  });
}
