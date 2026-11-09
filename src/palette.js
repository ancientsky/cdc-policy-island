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
export const c1a2030 = "#2f3956";
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
export const flowPaper = "#fff7ea";
export const pureWhite = "#ffffff";
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
export const glowLamp = "#ffc27a";

// 0x color numbers moved here. Each value matches the literal it replaced.
export const k070d18 = 0x070d18;
export const k071a2b = 0x071a2b;
export const k0e8a80 = 0x0e8a80;
export const k0f1c2e = 0x0f1c2e;
export const k12384a = 0x12384a;
export const k141c26 = 0x141c26;
export const k1a2232 = 0x1a2232;
export const k1a3c48 = 0x1a3c48;
export const k1b2a44 = 0x1b2a44;
export const k1b86a0 = 0x1b86a0;
export const k1e3050 = 0x1e3050;
export const k24344c = 0x24344c;
export const k2a2026 = 0x2a2026;
export const k2a2440 = 0x2a2440;
export const k2a2630 = 0x2a2630;
export const k2a2f4a = 0x2a2f4a;
export const k2a3d66 = 0x2a3d66;
export const k2a3f70 = 0x2a3f70;
export const k2a7f8f = 0x2a7f8f;
export const k2f8f72 = 0x2f8f72;
export const k368093 = 0x368093;
export const k3a2a3a = 0x3a2a3a;
export const k3b2a5c = 0x3b2a5c;
export const k3e6d78 = 0x3e6d78;
export const k3f6680 = 0x3f6680;
export const k3fa882 = 0x3fa882;
export const k5c9a70 = 0x5c9a70;
export const k5fb0e0 = 0x5fb0e0;
export const k62866c = 0x62866c;
export const k68967a = 0x68967a;
export const k6a5a78 = 0x6a5a78;
export const k6a5a7a = 0x6a5a7a;
export const k6a80c0 = 0x6a80c0;
export const k6a9a58 = 0x6a9a58;
export const k6e9a66 = 0x6e9a66;
export const k7a68c0 = 0x7a68c0;
export const k7a7ab0 = 0x7a7ab0;
export const k7d92a4 = 0x7d92a4;
export const k7ec8e0 = 0x7ec8e0;
export const k867a62 = 0x867a62;
export const k86e3d4 = 0x86e3d4;
export const k8a7a5c = 0x8a7a5c;
export const k8a7a64 = 0x8a7a64;
export const k8a8f93 = 0x8a8f93;
export const k8aa4b4 = 0x8aa4b4;
export const k8aab74 = 0x8aab74;
export const k8aafd6 = 0x8aafd6;
export const k8d9a96 = 0x8d9a96;
export const k98e7da = 0x98e7da;
export const k9a7a58 = 0x9a7a58;
export const k9cc4e8 = 0x9cc4e8;
export const k9ec9cf = 0x9ec9cf;
export const k9ed9c4 = 0x9ed9c4;
export const k9edfcf = 0x9edfcf;
export const k9fb4e8 = 0x9fb4e8;
export const k9fc8e6 = 0x9fc8e6;
export const ka9d3cf = 0xa9d3cf;
export const kb0a07c = 0xb0a07c;
export const kb4e6d2 = 0xb4e6d2;
export const kb7a07a = 0xb7a07a;
export const kb7a888 = 0xb7a888;
export const kb7c3be = 0xb7c3be;
export const kb8a0b0 = 0xb8a0b0;
export const kbfe6e2 = 0xbfe6e2;
export const kc45a3a = 0xc45a3a;
export const kc46a45 = 0xc46a45;
export const kc5d0d4 = 0xc5d0d4;
export const kc98a8a = 0xc98a8a;
export const kcfe8f5 = 0xcfe8f5;
export const kd2694a = 0xd2694a;
export const kd5d0c6 = 0xd5d0c6;
export const kd5dde6 = 0xd5dde6;
export const kd5ebe8 = 0xd5ebe8;
export const kd7efe8 = 0xd7efe8;
export const kd8c8e4 = 0xd8c8e4;
export const kd8eef0 = 0xd8eef0;
export const kd98f6e = 0xd98f6e;
export const kdff3f6 = 0xdff3f6;
export const kdff3ff = 0xdff3ff;
export const ke1992d = 0xe1992d;
export const ke4dcc8 = 0xe4dcc8;
export const ke6f4ff = 0xe6f4ff;
export const ke9a07e = 0xe9a07e;
export const kf39a6b = 0xf39a6b;
export const kf3f0e8 = 0xf3f0e8;
export const kf4f1ea = 0xf4f1ea;
export const kf4f7fb = 0xf4f7fb;
export const kf6e2c8 = 0xf6e2c8;
export const kfbe3c8 = 0xfbe3c8;
export const kfde8d0 = 0xfde8d0;
export const kff9a5c = 0xff9a5c;
export const kffb59a = 0xffb59a;
export const kffcf8a = 0xffcf8a;
export const kffd0a8 = 0xffd0a8;
export const kffd7a8 = 0xffd7a8;
export const kffd9b8 = 0xffd9b8;
export const kffe1a8 = 0xffe1a8;
export const kfff3df = 0xfff3df;
export const kfff4e8 = 0xfff4e8;
export const kfff6e6 = 0xfff6e6;
export const kfff7ee = 0xfff7ee;
export const kfff8ea = 0xfff8ea;

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
