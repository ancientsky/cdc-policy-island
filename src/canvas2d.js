// Original implementation for this project. Not derived from third-party source code.
// Texture canvases stay in CPU memory so a GPU-process crash cannot wipe them.

export const CPU2D = { willReadFrequently: true };

export function textureCanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, g: canvas.getContext("2d", CPU2D) };
}
