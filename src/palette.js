// Original implementation for this project. Not derived from third-party source code.
// 3D colors live here. scene.js does not carry hex literals.
// Nature: sRGB S 0.15-0.40, L 0.45-0.75. Walls: L >= 0.80.
// One high-chroma accent is for selection and the primary control.
// Island accents stay near L 0.55 and S <= 0.45.
// Daytime materials stay at L >= 0.20. Night sky stops may be darker.

export const c070b12 = "#070b12";
export const c121a24 = "#121a24";
export const c07141c = "#07141c";
export const cb7c6ea = "#bfc9e2";
export const c4a6280 = "#4a6280";
export const c1c2834 = "#1c2834";
export const cc5d4ee = "#cbd6e8";
export const c1a1424 = "#1a1424";
export const c4a3040 = "#543648";
export const c0c1e28 = "#0c1e28";
export const ce7b090 = "#d5b5a2";
export const c4a3848 = "#4a3848";
export const c241810 = "#241810";
export const cc49880 = "#c49880";
export const cf3c7a0 = "#dec8b5";
export const cf7e6cf = "#eee5d8";
export const c7eaea8 = "#7eaea8";
export const c3eb0b4 = "#4da2a5";
export const cfff1d4 = "#f2ece1";
export const cf4dcc0 = "#e8dbcc";
export const c8d7348 = "#8d7348";
export const cf0c4a0 = "#ddc6b3";
export const c7ec4dc = "#8fbccb";
export const ce7f7f6 = "#e9f5f4";
export const cb7ddd6 = "#b7ddd6";
export const c49c8d2 = "#65b0b6";
export const cfffaf2 = "#fbf9f6";
export const ce9f7f5 = "#ebf5f4";
export const ca09068 = "#a09068";
export const cc5e6ee = "#cbe2e8";
export const c3a1844 = "#572466";
export const ce07a48 = "#bb876d";
export const c1a2030 = "#1a2030";
export const c1a3c48 = "#255465";
export const cffb089 = "#dabcae";
export const ce8a888 = "#d3af9d";
export const c4a2c1c = "#643b26";
export const ce09070 = "#c79a89";
export const c162230 = "#162230";
export const c9eb0dc = "#a4b2d6";
export const cffe6bf = "#ebe2d3";
export const c0a3c48 = "#3e6870";
export const c8ee4dc = "#9ed4cf";
export const ce9d6a8 = "#ddd1b4";
export const c041014 = "#5e6a6e";
export const cffffff = "#fbf8f2";
export const leaf = "#7d9a68";
export const leafB = "#8aa56e";
export const leafLit = "#a8c090";
export const wood = "#a67c52";
export const woodB = "#b08968";
export const sand = "#dcc79a";
export const sail = "#5f8f86";
export const pot = "#c4a07a";
export const stone = "#d7d1c6";
export const trim = "#fbf8f2";
export const wallFace = "#f4ede0";
export const wallShade = "#e6dccb";
export const cream = trim;
export const paper = trim;
export const wallA = wallFace;
export const wallB = wallFace;
export const wallC = wallShade;
export const beach = "#d7c7a5";
export const cliff = "#c4a57a";
export const skirtSoil = "#a8875c";
export const pineA = "#4f995d";
export const pineB = "#47a16d";
export const roundA = "#6aa35a";
export const roundB = "#79ad5c";
export const palmLeaf = "#5c9751";
export const trunkWood = "#9f6f49";
export const pathSand = "#d7c8a5";
export const plinth = "#d2c4a9";
export const doorBrown = "#9e6d4a";
export const chimneyClay = "#b9846a";
export const board = "#9a7d62";
export const bloom = "#d99098";
export const pollen = "#cbb98a";
export const bulb = "#f3ead2";
export const reed = "#8eaa72";
export const bucket = "#c5d4d8";
export const crate = "#c4a484";
export const cloth = "#e7d3c4";
export const cross = "#c98980";
export const bamboo = "#c4b07a";
export const glowLamp = "#e6c7a4";

function mixHex(a, b, t) {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift) => {
    const av = (pa >> shift) & 255;
    const bv = (pb >> shift) & 255;
    return Math.round(av + (bv - av) * t);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

export function paintGround(g, id, land) {
  const grout = mixHex(land, cream, 0.62);
  const speckle = mixHex(land, beach, 0.35);
  const line = mixHex(land, board, 0.35);
  g.fillStyle = land;
  g.fillRect(0, 0, 256, 256);
  if (id === "lab" || id === "ipc") {
    g.fillStyle = speckle;
    for (let i = 0; i < 90; i += 1) {
      g.globalAlpha = 0.4;
      g.fillRect((i * 47) % 256, (i * 91) % 256, 4, 3);
    }
    g.globalAlpha = 1;
    return;
  }
  if (id === "border" || id === "watch" || id === "vax" || id === "tb" || id === "hiv" || id === "global") {
    g.strokeStyle = grout;
    g.lineWidth = 3;
    for (let i = 20; i < 256; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 256);
      g.moveTo(0, i);
      g.lineTo(256, i);
      g.stroke();
    }
    return;
  }
  if (id === "ready") {
    g.strokeStyle = line;
    g.lineWidth = 5;
    for (let y = 24; y < 256; y += 40) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y);
      g.stroke();
    }
    return;
  }
  if (id === "entero" || id === "hepa" || id === "dengue" || id === "amr") {
    g.strokeStyle = line;
    g.lineWidth = 2;
    const w = 28;
    const h = 14;
    for (let row = 0; row < 20; row += 1) {
      for (let col = -1; col < 12; col += 1) {
        const x = col * w + (row % 2 ? w / 2 : 0);
        g.strokeRect(x, row * h, w - 2, h - 2);
      }
    }
    return;
  }
  g.fillStyle = speckle;
  for (let i = 0; i < 60; i += 1) {
    g.globalAlpha = 0.3;
    g.beginPath();
    g.arc((i * 53) % 256, (i * 97) % 256, 7 + (i % 5), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}
export const cf0c7a4 = "#dec8b6";
export const cd9a57a = "#c8a68b";
export const cc48a6a = "#bc8c72";
export const c8d5a3c = "#895b40";
export const c14756f = "#5f8f86";
export const cf3efe4 = "#f3efe4";
export const ce39a3a = "#b79466";
export const ce1992d = "#b59563";
export const cd7e4ea = "#d7e4ea";
export const cb7d7ea = "#bfd5e2";
export const cf4f0e6 = "#f4f0e6";
export const cf2d48a = "#d7c8a5";
export const c0e8a80 = "#63b5af";
export const cffd0a8 = "#e2d0bd";
export const c8ed15a = "#91bb70";
export const c3f6e24 = "#6f8f62";
export const ce7f0cf = "#e5ebd4";
export const c2a2630 = "#6e6674";
export const cf2ede2 = "#f2ede2";
export const cdff3ff = "#d5e4ea";
export const cd2694a = "#b77765";
export const c5aa86a = "#5aa86a";
export const cd5e4ff = "#e2e8f2";
export const c8d6244 = "#8d6244";
export const cf7f4ee = "#f4ede0";
export const cffe1a8 = "#e2d5c0";
export const cc4473a = "#ad5a51";
export const c2f6f9e = "#426c8b";
export const cd9e2e4 = "#d9e2e4";
export const cb7e0e4 = "#bbdde0";
export const cd4544a = "#b76d67";
export const cd7c7a2 = "#d7c7a2";
export const cb98348 = "#ae8353";
export const cf3efe2 = "#f2efe3";
export const c5c6670 = "#5c6670";
export const c2a9a90 = "#3f857f";
export const ce0a04a = "#bb9b6f";
export const c6a8f4e = "#6a8f4e";
export const cf4efe4 = "#f3efe5";
export const cc4546a = "#b56373";
export const cc47a4a = "#b27e5c";
export const c6e8f62 = "#6e8f62";
export const cd5dbde = "#d5dbde";
export const cf2f6ff = "#f6f8fb";
export const cefe6d4 = "#ede5d6";
