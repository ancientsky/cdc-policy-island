// Original implementation for this project. Not derived from third-party source code.
import { Color, Group } from "three";
import { MESH_R } from "./hex.js";
import {
  bamboo, bloom, board, bucket, bulb, chimneyClay, cloth, cream, crate, cross, doorBrown,
  leaf, leafB, leafLit, palmLeaf, paper, pathSand, pineA, pineB, plinth, pollen, pot,
  reed, roundA, roundB, sail, sand, stone, trunkWood, wallA, wallC, wood, woodB,
} from "./palette.js";

// Colors come from palette.js. Nothing here is a national flag.
const LEAF = leaf;
const LEAF_B = leafB;
const LEAF_LIT = leafLit;
const WOOD = wood;
const WOOD_B = woodB;
const SAND = sand;
const HULL = sand;
const SAIL = sail;
const POT = pot;
const STONE = stone;
const CREAM = cream;
const PAPER = paper;
const WALL_A = wallA;
const WALL_C = wallC;
const BOARD = board;
const TEAL = sail;
const BLOOM = bloom;
const POLLEN = pollen;
const BULB = bulb;
const REED = reed;
const BUCKET = bucket;
const CRATE = crate;
const CLOTH = cloth;
const CROSS = cross;
const GROUND = 0.552;

const FENCE_OF = {
  watch: "rail",
  border: "post",
  lab: "clinic",
  vax: "picket",
  flu: "brick",
  entero: "planter",
  dengue: "bamboo",
  tb: "log",
  hiv: "reed",
  hepa: "hedge",
  ipc: "wire",
  amr: "stone",
  ready: "buoy",
  global: "rope",
};

const byIsland = new Map();
let sea = emptySea();

function emptySea() {
  return { boats: [], islets: [], boatClear: Infinity, isletClear: Infinity };
}

export function resetDecor() {
  byIsland.clear();
  sea = emptySea();
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function prepareLeaf(geo) {
  const rand = mulberry(0x51ed);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const j = 1 + (rand() * 2 - 1) * 0.08;
    pos.setXYZ(i, pos.getX(i) * j, pos.getY(i) * j, pos.getZ(i) * j);
  }
  geo.computeVertexNormals();
}

function leafHex(mode) {
  const color = new Color(LEAF);
  if (mode === "dark") color.offsetHSL(0.02, -0.05, -0.09);
  else if (mode === "lit") color.offsetHSL(-0.01, 0.04, 0.08);
  return `#${color.getHexString()}`;
}

function muteAccent(hex) {
  const color = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(hsl.h, Math.min(hsl.s, 0.32), Math.min(0.58, Math.max(0.4, hsl.l)));
  return `#${color.getHexString()}`;
}

function makeOcc(cell) {
  const buckets = new Map();
  const items = [];
  const key = (ix, iz) => `${ix},${iz}`;
  return {
    add(x, z, r) {
      const index = items.length;
      items.push({ x, z, r });
      const reach = Math.max(1, Math.ceil(r / cell));
      const ix = Math.floor(x / cell);
      const iz = Math.floor(z / cell);
      for (let dx = -reach; dx <= reach; dx += 1) {
        for (let dz = -reach; dz <= reach; dz += 1) {
          const k = key(ix + dx, iz + dz);
          let list = buckets.get(k);
          if (!list) {
            list = [];
            buckets.set(k, list);
          }
          list.push(index);
        }
      }
    },
    hit(x, z, r) {
      const reach = Math.max(1, Math.ceil(r / cell));
      const ix = Math.floor(x / cell);
      const iz = Math.floor(z / cell);
      for (let dx = -reach; dx <= reach; dx += 1) {
        for (let dz = -reach; dz <= reach; dz += 1) {
          const list = buckets.get(key(ix + dx, iz + dz));
          if (!list) continue;
          for (const index of list) {
            const spot = items[index];
            const ddx = x - spot.x;
            const ddz = z - spot.z;
            const rr = r + spot.r;
            if (ddx * ddx + ddz * ddz < rr * rr) return true;
          }
        }
      }
      return false;
    },
  };
}

function edgeFrame(edge, radius) {
  const a0 = Math.PI / 6 + edge * (Math.PI / 3);
  const a1 = a0 + Math.PI / 3;
  const a = { x: Math.cos(a0) * radius, z: Math.sin(a0) * radius };
  const b = { x: Math.cos(a1) * radius, z: Math.sin(a1) * radius };
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return { a, b, len: Math.hypot(dx, dz) || 1, ry: Math.atan2(-dz, dx) };
}

function bridgeList(self, placed) {
  const bridges = [];
  for (const other of placed) {
    if (other.id === self.id) continue;
    const dx = other.x - self.x;
    const dz = other.z - self.z;
    if (Math.hypot(dx, dz) > 4.2) continue;
    const ang = Math.atan2(dz, dx);
    let best = 0;
    let bestD = Infinity;
    for (let edge = 0; edge < 6; edge += 1) {
      const mid = Math.PI / 3 + edge * (Math.PI / 3);
      const d = Math.abs(Math.atan2(Math.sin(ang - mid), Math.cos(ang - mid)));
      if (d < bestD) {
        bestD = d;
        best = edge;
      }
    }
    bridges.push({ edge: best, toward: other.id });
  }
  return bridges;
}

function row(kind, color, x, y, z, sx, sy, sz, extra = {}) {
  return { kind, color, x, y, z, sx, sy, sz, ...extra };
}

function cluster(logical, rows) {
  return rows.map((item) => ({ ...item, logical }));
}

const VIGNETTES = {
  watch: [
    cluster("mast", [
      row("cyl", WOOD, 0, 0.28, 0, 0.035, 0.5, 0.035),
      row("box", PAPER, 0.02, 0.36, 0, 0.02, 0.16, 0.12),
      row("sphere", BULB, 0, 0.56, 0, 0.07, 0.07, 0.07, { glow: true }),
    ]),
    cluster("desk", [
      row("box", WALL_A, 0, 0.1, 0, 0.28, 0.08, 0.16),
      row("box", PAPER, -0.04, 0.16, 0.02, 0.1, 0.02, 0.08),
      row("cyl", TEAL, 0.08, 0.16, -0.02, 0.04, 0.06, 0.04),
    ]),
    cluster("glass", [
      row("cyl", BOARD, 0, 0.16, 0, 0.03, 0.28, 0.03),
      row("sphere", TEAL, -0.05, 0.32, 0, 0.05, 0.05, 0.05),
      row("sphere", TEAL, 0.05, 0.32, 0, 0.05, 0.05, 0.05),
    ]),
  ],
  border: [
    cluster("luggage", [
      row("rbox", CLOTH, -0.1, 0.07, 0, 0.14, 0.1, 0.1),
      row("rbox", SAND, 0.06, 0.06, 0.04, 0.12, 0.09, 0.08),
      row("box", TEAL, 0.02, 0.14, 0.02, 0.08, 0.04, 0.06),
    ]),
    cluster("queue", [
      row("cyl", BOARD, -0.16, 0.14, 0, 0.025, 0.26, 0.025),
      row("cyl", BOARD, 0.16, 0.14, 0, 0.025, 0.26, 0.025),
      row("cyl", SAND, 0, 0.22, 0, 0.16, 0.015, 0.015, { ry: Math.PI / 2 }),
      row("box", PAPER, 0, 0.08, 0.08, 0.1, 0.08, 0.02),
    ]),
    cluster("counter", [
      row("box", WALL_A, 0, 0.12, 0, 0.32, 0.12, 0.14),
      row("box", CREAM, 0, 0.2, 0.04, 0.16, 0.02, 0.08),
      row("cyl", WOOD, 0.12, 0.2, -0.02, 0.03, 0.08, 0.03),
    ]),
  ],
  lab: [
    cluster("rack", [
      row("box", WALL_C, 0, 0.06, 0, 0.22, 0.06, 0.1),
      row("cyl", TEAL, -0.06, 0.14, 0, 0.025, 0.1, 0.025),
      row("cyl", BLOOM, 0, 0.14, 0, 0.025, 0.12, 0.025),
      row("cyl", POLLEN, 0.06, 0.13, 0, 0.025, 0.09, 0.025),
    ]),
    cluster("scope", [
      row("box", BOARD, 0, 0.06, 0, 0.16, 0.06, 0.1),
      row("cyl", TEAL, 0, 0.16, 0, 0.04, 0.14, 0.04),
      row("sphere", CREAM, 0, 0.26, 0.04, 0.06, 0.06, 0.06),
    ]),
    cluster("cooler", [
      row("rbox", CREAM, 0, 0.08, 0, 0.18, 0.12, 0.14),
      row("box", TEAL, 0, 0.15, 0, 0.16, 0.02, 0.12),
      row("sphere", BULB, 0.06, 0.12, 0.06, 0.03, 0.03, 0.03, { glow: true }),
    ]),
  ],
  vax: [
    cluster("cooler", [
      row("rbox", CREAM, 0, 0.09, 0, 0.2, 0.14, 0.16),
      row("box", TEAL, 0, 0.17, 0, 0.18, 0.03, 0.14),
      row("box", POLLEN, 0.04, 0.08, 0.09, 0.06, 0.04, 0.02),
    ]),
    cluster("bench", [
      row("box", WOOD, 0, 0.08, 0, 0.28, 0.04, 0.1),
      row("box", WOOD_B, -0.1, 0.04, 0, 0.03, 0.08, 0.03),
      row("box", WOOD_B, 0.1, 0.04, 0, 0.03, 0.08, 0.03),
    ]),
    cluster("tray", [
      row("box", WALL_A, 0, 0.05, 0, 0.18, 0.04, 0.12),
      row("box", PAPER, -0.04, 0.09, 0, 0.06, 0.015, 0.08),
      row("box", CREAM, 0.05, 0.09, 0, 0.05, 0.015, 0.07),
    ]),
  ],
  flu: [
    cluster("tissues", [
      row("box", CREAM, 0, 0.06, 0, 0.12, 0.08, 0.08),
      row("box", PAPER, 0, 0.11, 0, 0.06, 0.02, 0.04),
      row("sphere", TEAL, 0.08, 0.05, 0.04, 0.03, 0.03, 0.03),
    ]),
    cluster("thermo", [
      row("cyl", BOARD, 0, 0.12, 0, 0.025, 0.2, 0.025),
      row("box", CROSS, 0, 0.24, 0, 0.08, 0.015, 0.03),
      row("sphere", CREAM, 0, 0.2, 0.02, 0.04, 0.04, 0.04),
    ]),
    cluster("bench", [
      row("box", WOOD, 0, 0.08, 0, 0.26, 0.04, 0.1),
      row("box", WOOD_B, -0.1, 0.04, 0.02, 0.03, 0.08, 0.03),
      row("box", WOOD_B, 0.1, 0.04, 0.02, 0.03, 0.08, 0.03),
      row("box", PAPER, 0, 0.14, -0.06, 0.12, 0.1, 0.02),
    ]),
  ],
  entero: [
    cluster("sink", [
      row("box", CREAM, 0, 0.1, 0, 0.2, 0.1, 0.14),
      row("cyl", TEAL, 0, 0.16, 0, 0.05, 0.03, 0.05),
      row("sphere", POLLEN, 0.08, 0.16, 0.02, 0.035, 0.035, 0.035),
    ]),
    cluster("poster", [
      row("box", BOARD, 0, 0.16, 0, 0.02, 0.22, 0.14),
      row("box", PAPER, 0.02, 0.18, 0, 0.015, 0.12, 0.1),
      row("sphere", POLLEN, 0.04, 0.22, 0.02, 0.02, 0.02, 0.02),
    ]),
    cluster("bin", [
      row("box", TEAL, 0, 0.08, 0, 0.16, 0.12, 0.14),
      row("sphere", POLLEN, -0.03, 0.16, 0, 0.04, 0.04, 0.04),
      row("sphere", BLOOM, 0.04, 0.15, 0.02, 0.035, 0.035, 0.035),
    ]),
  ],
  dengue: [
    cluster("pots", [
      row("cyl", POT, -0.1, 0.05, 0, 0.08, 0.08, 0.08),
      row("cyl", POT, 0.08, 0.05, 0.04, 0.07, 0.07, 0.07),
      row("leaf", LEAF, -0.1, 0.12, 0, 0.1, 0.08, 0.1),
      row("leaf", LEAF_B, 0.08, 0.11, 0.04, 0.08, 0.07, 0.08),
    ]),
    cluster("bucket", [
      row("cyl", BUCKET, 0, 0.05, 0, 0.1, 0.08, 0.1, { rx: 1.15 }),
      row("torus", TEAL, 0.04, 0.08, 0, 0.12, 0.12, 0.12, { rx: 1.2 }),
      row("sphere", SAND, -0.06, 0.04, 0.04, 0.03, 0.03, 0.03),
    ]),
    cluster("trap", [
      row("cyl", BOARD, 0, 0.16, 0, 0.025, 0.28, 0.025),
      row("sphere", BULB, 0, 0.32, 0, 0.06, 0.06, 0.06, { glow: true }),
      row("cone6", TEAL, 0, 0.38, 0, 0.08, 0.06, 0.08),
    ]),
  ],
  tb: [
    cluster("pills", [
      row("rbox", CREAM, 0, 0.04, 0, 0.16, 0.05, 0.1),
      row("sphere", POLLEN, -0.04, 0.08, 0, 0.025, 0.025, 0.025),
      row("sphere", CROSS, 0.02, 0.08, 0.02, 0.025, 0.025, 0.025),
      row("sphere", TEAL, 0.05, 0.08, -0.02, 0.02, 0.02, 0.02),
    ]),
    cluster("chair", [
      row("box", WOOD, 0, 0.08, 0, 0.14, 0.04, 0.14),
      row("box", WOOD_B, 0, 0.16, -0.06, 0.14, 0.14, 0.02),
      row("box", CREAM, 0.04, 0.1, 0.04, 0.04, 0.02, 0.04),
    ]),
    cluster("calendar", [
      row("box", BOARD, 0, 0.16, 0, 0.02, 0.2, 0.14),
      row("box", PAPER, 0.015, 0.16, 0, 0.012, 0.14, 0.1),
      row("box", CROSS, 0.03, 0.2, 0, 0.01, 0.04, 0.04),
    ]),
  ],
  hiv: [
    cluster("screen", [
      row("box", CLOTH, -0.1, 0.14, 0, 0.02, 0.22, 0.12),
      row("box", CLOTH, 0.1, 0.14, 0, 0.02, 0.22, 0.12),
      row("box", BOARD, 0, 0.04, 0, 0.08, 0.08, 0.08),
    ]),
    cluster("kit", [
      row("box", CREAM, 0, 0.05, 0, 0.14, 0.06, 0.1),
      row("box", PAPER, 0, 0.09, 0, 0.08, 0.015, 0.06),
      row("cyl", TEAL, 0.06, 0.08, 0.02, 0.02, 0.06, 0.02),
    ]),
    cluster("loop", [
      row("cyl", BOARD, 0, 0.16, 0, 0.025, 0.28, 0.025),
      row("torus", BLOOM, 0, 0.34, 0, 0.16, 0.16, 0.16, { rx: 1.1 }),
      row("box", CREAM, 0, 0.04, 0, 0.08, 0.04, 0.08),
    ]),
  ],
  hepa: [
    cluster("leaflets", [
      row("box", BOARD, 0, 0.12, 0, 0.08, 0.16, 0.08),
      row("box", PAPER, 0.02, 0.18, 0.02, 0.015, 0.1, 0.06),
      row("box", CREAM, -0.02, 0.16, 0.03, 0.015, 0.08, 0.05),
    ]),
    cluster("cooler", [
      row("rbox", CREAM, 0, 0.08, 0, 0.16, 0.12, 0.12),
      row("box", TEAL, 0, 0.15, 0, 0.14, 0.02, 0.1),
      row("sphere", POLLEN, 0.05, 0.12, 0.04, 0.03, 0.03, 0.03),
    ]),
    cluster("cup", [
      row("cyl", CREAM, -0.04, 0.06, 0, 0.05, 0.08, 0.05),
      row("cyl", TEAL, 0.06, 0.08, 0, 0.03, 0.12, 0.03),
      row("sphere", POLLEN, 0.06, 0.16, 0, 0.035, 0.035, 0.035),
    ]),
  ],
  ipc: [
    cluster("sink", [
      row("box", CREAM, 0, 0.1, 0, 0.22, 0.1, 0.14),
      row("cyl", BUCKET, 0, 0.16, 0, 0.06, 0.03, 0.06),
      row("sphere", TEAL, 0.08, 0.16, 0, 0.03, 0.03, 0.03),
    ]),
    cluster("gloves", [
      row("box", CREAM, 0, 0.08, 0, 0.12, 0.1, 0.08),
      row("box", PAPER, 0, 0.14, 0.02, 0.08, 0.02, 0.05),
      row("sphere", TEAL, 0.06, 0.08, 0.04, 0.03, 0.03, 0.03),
    ]),
    cluster("bottle", [
      row("cyl", TEAL, 0, 0.1, 0, 0.05, 0.16, 0.05),
      row("sphere", CREAM, 0, 0.2, 0, 0.04, 0.04, 0.04),
      row("box", WALL_A, 0.1, 0.08, 0, 0.08, 0.1, 0.04),
    ]),
  ],
  amr: [
    cluster("dishes", [
      row("cyl", CREAM, -0.06, 0.02, 0, 0.08, 0.025, 0.08),
      row("cyl", TEAL, 0.04, 0.025, 0.02, 0.07, 0.02, 0.07),
      row("cyl", POLLEN, 0, 0.045, -0.02, 0.06, 0.02, 0.06),
    ]),
    cluster("chart", [
      row("box", BOARD, 0, 0.14, 0, 0.015, 0.18, 0.14),
      row("box", PAPER, 0.02, 0.14, 0, 0.012, 0.12, 0.1),
      row("box", TEAL, 0.03, 0.18, 0.02, 0.008, 0.04, 0.04),
    ]),
    cluster("cabinet", [
      row("box", WALL_C, 0, 0.12, 0, 0.16, 0.18, 0.1),
      row("box", BOARD, 0, 0.12, 0.06, 0.06, 0.08, 0.015),
      row("sphere", POLLEN, 0.04, 0.12, 0.07, 0.015, 0.015, 0.015),
    ]),
  ],
  ready: [
    cluster("crates", [
      row("box", CRATE, -0.06, 0.06, 0, 0.12, 0.1, 0.12),
      row("box", WOOD, 0.08, 0.05, 0.02, 0.1, 0.08, 0.1),
      row("box", SAND, 0, 0.14, 0, 0.1, 0.08, 0.1),
    ]),
    cluster("checklist", [
      row("box", BOARD, 0, 0.14, 0, 0.015, 0.2, 0.12),
      row("box", PAPER, 0.02, 0.15, 0, 0.01, 0.14, 0.08),
      row("box", TEAL, 0.03, 0.18, 0.02, 0.008, 0.03, 0.03),
    ]),
    cluster("barrel", [
      row("cyl", WOOD_B, 0, 0.1, 0, 0.12, 0.16, 0.12),
      row("torus", BOARD, 0, 0.16, 0, 0.16, 0.16, 0.16, { rx: Math.PI / 2 }),
      row("box", SAND, 0.08, 0.08, 0.06, 0.06, 0.05, 0.06),
    ]),
  ],
  global: [
    cluster("dish", [
      row("cyl", BOARD, 0, 0.2, 0, 0.03, 0.36, 0.03),
      row("torus", TEAL, 0, 0.4, 0, 0.18, 0.18, 0.18, { rx: 1.05 }),
      row("sphere", CREAM, 0, 0.4, 0.04, 0.04, 0.04, 0.04),
    ]),
    cluster("board", [
      row("box", BOARD, 0, 0.14, 0, 0.12, 0.16, 0.015),
      row("box", PAPER, 0, 0.15, 0.02, 0.08, 0.1, 0.012),
      row("sphere", TEAL, 0.04, 0.2, 0.03, 0.02, 0.02, 0.02),
    ]),
    cluster("spool", [
      row("cyl", WOOD, 0, 0.08, 0, 0.1, 0.1, 0.1),
      row("torus", SAND, 0, 0.08, 0, 0.16, 0.16, 0.16, { rx: Math.PI / 2 }),
      row("box", BOARD, 0, 0.16, 0, 0.06, 0.03, 0.06),
    ]),
  ],
};

const INTERIOR = {
  watch: [
    { logical: "sign", kind: "box", color: PAPER, sx: 0.08, sy: 0.1, sz: 0.015, y: 0.08 },
    { logical: "crate", kind: "box", color: CRATE, sx: 0.1, sy: 0.08, sz: 0.1, y: 0.04 },
  ],
  border: [
    { logical: "luggage", kind: "rbox", color: CLOTH, sx: 0.1, sy: 0.08, sz: 0.08, y: 0.04 },
    { logical: "pole", kind: "cyl", color: BOARD, sx: 0.02, sy: 0.28, sz: 0.02, y: 0.14 },
  ],
  lab: [
    { logical: "vial", kind: "cyl", color: TEAL, sx: 0.025, sy: 0.08, sz: 0.025, y: 0.04 },
    { logical: "crate", kind: "box", color: CREAM, sx: 0.08, sy: 0.06, sz: 0.08, y: 0.03 },
  ],
  vax: [
    { logical: "cooler", kind: "rbox", color: CREAM, sx: 0.12, sy: 0.1, sz: 0.1, y: 0.05 },
    { logical: "bench", kind: "box", color: WOOD, sx: 0.16, sy: 0.04, sz: 0.08, y: 0.04 },
  ],
  flu: [
    { logical: "bench", kind: "box", color: WOOD, sx: 0.16, sy: 0.04, sz: 0.08, y: 0.04 },
    { logical: "sign", kind: "box", color: PAPER, sx: 0.08, sy: 0.1, sz: 0.015, y: 0.08 },
  ],
  entero: [
    { logical: "soap", kind: "sphere", color: POLLEN, sx: 0.04, sy: 0.04, sz: 0.04, y: 0.03 },
    { logical: "bin", kind: "box", color: TEAL, sx: 0.08, sy: 0.08, sz: 0.08, y: 0.04 },
  ],
  dengue: [
    { logical: "pot", kind: "cyl", color: POT, sx: 0.08, sy: 0.07, sz: 0.08, y: 0.035 },
    { logical: "bucket", kind: "cyl", color: BUCKET, sx: 0.08, sy: 0.07, sz: 0.08, y: 0.04, rx: 1.1 },
    { logical: "saucer", kind: "cyl", color: SAND, sx: 0.09, sy: 0.02, sz: 0.09, y: 0.015 },
  ],
  tb: [
    { logical: "chair", kind: "box", color: WOOD, sx: 0.1, sy: 0.04, sz: 0.1, y: 0.04 },
    { logical: "pills", kind: "box", color: CREAM, sx: 0.08, sy: 0.03, sz: 0.06, y: 0.02 },
  ],
  hiv: [
    { logical: "screen", kind: "box", color: CLOTH, sx: 0.015, sy: 0.16, sz: 0.1, y: 0.1 },
    { logical: "kit", kind: "box", color: CREAM, sx: 0.08, sy: 0.05, sz: 0.06, y: 0.03 },
  ],
  hepa: [
    { logical: "cup", kind: "cyl", color: CREAM, sx: 0.04, sy: 0.07, sz: 0.04, y: 0.035 },
    { logical: "cooler", kind: "rbox", color: CREAM, sx: 0.1, sy: 0.08, sz: 0.1, y: 0.04 },
  ],
  ipc: [
    { logical: "bottle", kind: "cyl", color: TEAL, sx: 0.035, sy: 0.1, sz: 0.035, y: 0.05 },
    { logical: "sign", kind: "box", color: PAPER, sx: 0.08, sy: 0.1, sz: 0.012, y: 0.08 },
  ],
  amr: [
    { logical: "dish", kind: "cyl", color: CREAM, sx: 0.07, sy: 0.02, sz: 0.07, y: 0.015 },
    { logical: "chart", kind: "box", color: PAPER, sx: 0.1, sy: 0.08, sz: 0.012, y: 0.06 },
  ],
  ready: [
    { logical: "crate", kind: "box", color: CRATE, sx: 0.1, sy: 0.08, sz: 0.1, y: 0.04 },
    { logical: "barrel", kind: "cyl", color: WOOD_B, sx: 0.08, sy: 0.1, sz: 0.08, y: 0.05 },
  ],
  global: [
    { logical: "spool", kind: "cyl", color: WOOD, sx: 0.07, sy: 0.07, sz: 0.07, y: 0.04 },
    { logical: "board", kind: "box", color: PAPER, sx: 0.1, sy: 0.08, sz: 0.012, y: 0.06 },
  ],
};

const SHARED = [
  { logical: "bench", kind: "box", color: WOOD, sx: 0.14, sy: 0.035, sz: 0.07, y: 0.03 },
  { logical: "crate", kind: "box", color: CRATE, sx: 0.09, sy: 0.07, sz: 0.09, y: 0.035 },
  { logical: "sign", kind: "box", color: PAPER, sx: 0.07, sy: 0.09, sz: 0.012, y: 0.07 },
  { logical: "flower", kind: "sphere", color: BLOOM, sx: 0.04, sy: 0.04, sz: 0.04, y: 0.03 },
];

function pushPart(kit, parent, lamps, alive, tally, spec) {
  const rec = kit.part({
    kind: spec.kind,
    parent,
    x: spec.x || 0,
    y: GROUND + (spec.y || 0),
    z: spec.z || 0,
    sx: spec.sx,
    sy: spec.sy,
    sz: spec.sz,
    rx: spec.rx || 0,
    ry: spec.ry || 0,
    rz: spec.rz || 0,
    color: spec.color,
    glow: Boolean(spec.glow),
    cast: spec.cast === true,
    alive,
  });
  if (spec.glow) lamps.push(rec);
  tally.pieces += 1;
  tally.kinds.add(spec.logical || spec.kind);
  return rec;
}

function fenceAt(put, type, x, z, ry, seg) {
  const post = (kind, color, sx, sy, sz, extra = {}) => {
    put({ logical: "fence", kind, color, x, y: sy / 2, z, sx, sy, sz, ry, ...extra });
  };
  if (type === "bamboo") post("cyl", bamboo, 0.035, 0.2, 0.035);
  else if (type === "hedge") {
    put({ logical: "fence", kind: "leaf", color: leafHex("base"), x, y: 0.1, z, sx: 0.12, sy: 0.1, sz: 0.1, ry });
    put({ logical: "fence", kind: "leaf", color: leafHex("dark"), x: x + 0.03, y: 0.14, z, sx: 0.09, sy: 0.08, sz: 0.09, ry });
  } else if (type === "stone") post("box", STONE, 0.1, 0.1, 0.08);
  else if (type === "buoy") {
    post("sphere", TEAL, 0.07, 0.07, 0.07, { y: 0.06 });
    if (seg % 2 === 0) post("cyl", SAND, 0.1, 0.015, 0.015, { y: 0.08 });
  } else if (type === "picket") post("box", CREAM, 0.03, 0.18, 0.03);
  else if (type === "log") post("cyl", WOOD, 0.1, 0.05, 0.05, { y: 0.05, rx: Math.PI / 2 });
  else if (type === "reed") post("cone6", REED, 0.04, 0.2, 0.04);
  else if (type === "brick") post("box", crate, 0.1, 0.08, 0.08);
  else if (type === "rope") {
    post("cyl", WOOD, 0.028, 0.18, 0.028);
    post("cyl", SAND, 0.09, 0.012, 0.012, { y: 0.12 });
  } else if (type === "clinic") {
    post("cyl", CREAM, 0.028, 0.18, 0.028);
    post("box", TEAL, 0.09, 0.02, 0.02, { y: 0.12 });
  } else if (type === "planter") {
    post("box", POT, 0.1, 0.08, 0.08);
    put({ logical: "fence", kind: "leaf", color: LEAF_B, x, y: 0.1, z, sx: 0.08, sy: 0.06, sz: 0.08 });
  } else if (type === "wire") {
    post("cyl", BOARD, 0.02, 0.16, 0.02);
    post("box", STONE, 0.09, 0.012, 0.012, { y: 0.12 });
  } else if (type === "post") post("box", WOOD_B, 0.04, 0.2, 0.04);
  else {
    post("box", WOOD, 0.035, 0.16, 0.035);
    post("box", WOOD_B, 0.09, 0.025, 0.025, { y: 0.1 });
  }
}

function placeCluster(put, occ, rng, parts) {
  const fixed = [
    [-0.24, -0.72],
    [0.48, -0.56],
    [-0.56, -0.48],
    [0.72, -0.24],
    [-0.72, -0.16],
    [0.16, 0.08],
    [-0.16, 0.2],
  ];
  let anchor = null;
  for (const [x, z] of fixed) {
    if (x * x + z * z > 0.9 * 0.9) continue;
    if (occ.hit(x, z, 0.12)) continue;
    occ.add(x, z, 0.12);
    anchor = { x, z };
    break;
  }
  if (!anchor) {
    for (let i = 0; i < 30; i += 1) {
      const ang = rng() * Math.PI * 2;
      const rad = 0.4 + rng() * 0.45;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      if (occ.hit(x, z, 0.14)) continue;
      occ.add(x, z, 0.14);
      anchor = { x, z };
      break;
    }
  }
  if (!anchor) return 0;
  for (const spec of parts) {
    put({
      ...spec,
      x: anchor.x + spec.x,
      z: anchor.z + spec.z,
    });
  }
  return parts.length >= 3 ? 1 : 0;
}

function layPath(put, spots) {
  const pts = spots.length <= 1 ? [[0, 0], ...(spots.length ? spots : [])] : spots;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    put({
      logical: "path",
      kind: "path",
      color: pathSand,
      x: (x1 + x2) / 2,
      y: 0.003,
      z: (z1 + z2) / 2,
      sx: 0.12,
      sy: 1,
      sz: len,
      ry: Math.atan2(dx, dz),
    });
  }
}

function placeTree(put, form, x, z, scale, ry) {
  if (form === "pine") {
    put({ logical: "tree", kind: "bole", color: trunkWood, x, y: 0.16 * scale, z, sx: 0.07 * scale, sy: 0.32 * scale, sz: 0.07 * scale, ry });
    put({ logical: "tree", kind: "pine", color: pineB, x, y: 0.4 * scale, z, sx: 0.46 * scale, sy: 0.36 * scale, sz: 0.46 * scale, ry });
    put({ logical: "tree", kind: "pine", color: pineA, x, y: 0.62 * scale, z, sx: 0.32 * scale, sy: 0.34 * scale, sz: 0.32 * scale, ry });
    return;
  }
  if (form === "round") {
    put({ logical: "tree", kind: "bole", color: trunkWood, x, y: 0.18 * scale, z, sx: 0.08 * scale, sy: 0.36 * scale, sz: 0.08 * scale, ry });
    put({ logical: "tree", kind: "round", color: roundA, x, y: 0.5 * scale, z, sx: scale * 1.7, sy: scale * 1.7, sz: scale * 1.7, ry });
    put({
      logical: "tree",
      kind: "round",
      color: roundB,
      x: x + Math.cos(ry) * 0.06 * scale,
      y: 0.64 * scale,
      z: z - Math.sin(ry) * 0.06 * scale,
      sx: scale * 1.25,
      sy: scale * 1.25,
      sz: scale * 1.25,
      ry,
    });
    return;
  }
  const lean = 0.28;
  put({ logical: "tree", kind: "bole", color: trunkWood, x, y: 0.16 * scale, z, sx: 0.06 * scale, sy: 0.34 * scale, sz: 0.06 * scale, rx: lean * 0.45, ry });
  const ox = Math.sin(ry) * 0.06 * scale;
  const oz = Math.cos(ry) * 0.06 * scale;
  put({ logical: "tree", kind: "bole", color: trunkWood, x: x + ox, y: 0.42 * scale, z: z + oz, sx: 0.05 * scale, sy: 0.3 * scale, sz: 0.05 * scale, rx: lean, ry });
  const crownY = 0.58 * scale;
  for (let i = 0; i < 5; i += 1) {
    const ang = ry + (i * Math.PI * 2) / 5;
    put({
      logical: "tree",
      kind: "frond",
      color: palmLeaf,
      x: x + ox + Math.sin(ang) * 0.04 * scale,
      y: crownY,
      z: z + oz + Math.cos(ang) * 0.04 * scale,
      sx: scale,
      sy: scale,
      sz: scale * 0.38,
      rx: Math.PI / 2.35,
      ry: ang,
    });
  }
}

export function addIslandDecor(group, island, kit, lamps, placed, houseSpots) {
  const tally = {
    pieces: 0,
    kinds: new Set(),
    vignettes: 0,
    interior: 0,
    sprigs: 0,
    trees: 0,
    forms: [],
    bridges: [],
    at: null,
  };
  byIsland.set(island.id, tally);
  const self = placed.find((item) => item.id === island.id);
  tally.at = { x: self.x, z: self.z };
  const alive = () => group.userData.lit !== false;
  const put = (spec) => pushPart(kit, group, lamps, alive, tally, spec);
  const rng = mulberry(seedFrom(island.id));
  const occ = makeOcc(0.08);
  occ.add(0, -0.22, 0.2);
  for (const [x, z] of houseSpots) occ.add(x, z, 0.24);

  const bridges = bridgeList(self, placed);
  tally.bridges = bridges;
  const bridgeEdges = new Set(bridges.map((item) => item.edge));
  const fence = FENCE_OF[island.id] || "rail";

  for (let edge = 0; edge < 6; edge += 1) {
    const frame = edgeFrame(edge, 1.2);
    const bridged = bridgeEdges.has(edge);
    for (let seg = 0; seg < 9; seg += 1) {
      if (bridged && Math.abs(seg - 4) <= 1) continue;
      const t = (seg + 0.5) / 9;
      const x = frame.a.x + (frame.b.x - frame.a.x) * t;
      const z = frame.a.z + (frame.b.z - frame.a.z) * t;
      fenceAt(put, fence, x, z, frame.ry, seg);
    }
    const va = Math.PI / 6 + edge * (Math.PI / 3);
    put({
      logical: "lamp",
      kind: "cyl",
      color: BOARD,
      x: Math.cos(va) * 1.12,
      y: 0.2,
      z: Math.sin(va) * 1.12,
      sx: 0.03,
      sy: 0.4,
      sz: 0.03,
    });
    put({
      logical: "lamp",
      kind: "sphere",
      color: BULB,
      x: Math.cos(va) * 1.12,
      y: 0.44,
      z: Math.sin(va) * 1.12,
      sx: 0.055,
      sy: 0.055,
      sz: 0.055,
      glow: true,
    });
    for (const t of [0.28, 0.72]) {
      const inset = 0.86;
      const x = (frame.a.x + (frame.b.x - frame.a.x) * t) * inset;
      const z = (frame.a.z + (frame.b.z - frame.a.z) * t) * inset;
      if (edge % 2 === 0) {
        put({ logical: "shrub", kind: "leaf", color: leafHex("base"), x, y: 0.08, z, sx: 0.12, sy: 0.1, sz: 0.12 });
        put({ logical: "shrub", kind: "leaf", color: leafHex("dark"), x: x + 0.04, y: 0.1, z: z - 0.02, sx: 0.09, sy: 0.08, sz: 0.09 });
      } else {
        put({ logical: "pot", kind: "cyl", color: POT, x, y: 0.04, z, sx: 0.07, sy: 0.07, sz: 0.07 });
        put({ logical: "pot", kind: "leaf", color: LEAF_B, x, y: 0.1, z, sx: 0.08, sy: 0.07, sz: 0.08 });
      }
    }
    if (!bridged) {
      const mid = 0.8;
      const x = (frame.a.x + frame.b.x) * 0.5 * mid;
      const z = (frame.a.z + frame.b.z) * 0.5 * mid;
      put({ logical: "flower", kind: "sphere", color: BLOOM, x, y: 0.04, z, sx: 0.045, sy: 0.045, sz: 0.045 });
      put({ logical: "flower", kind: "sphere", color: POLLEN, x: x + 0.04, y: 0.035, z, sx: 0.035, sy: 0.035, sz: 0.035 });
      put({ logical: "flower", kind: "cone6", color: REED, x, y: 0.05, z: z + 0.03, sx: 0.03, sy: 0.08, sz: 0.03 });
    }
  }

  const themes = VIGNETTES[island.id] || VIGNETTES.watch;
  for (const parts of themes) {
    tally.vignettes += placeCluster(put, occ, rng, parts);
  }

  layPath(put, houseSpots);

  const treeRng = mulberry(seedFrom(`${island.id}:trees`));
  const treeWant = 4 + Math.floor(treeRng() * 3);
  const palmIsland = island.id === "dengue" || island.id === "hepa";
  const forms = new Set();
  let trees = 0;
  let treeTries = 0;
  while (trees < treeWant && treeTries < 80) {
    treeTries += 1;
    const ang = treeRng() * Math.PI * 2;
    const rad = 0.75 + treeRng() * 0.4;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    if (houseSpots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 0.3)) continue;
    if (occ.hit(x, z, 0.2)) continue;
    const scale = 0.75 + treeRng() * 0.6;
    const ry = treeRng() * Math.PI * 2;
    let form = treeRng() < 0.5 ? "pine" : "round";
    if (palmIsland && (trees === 0 || treeRng() < 0.45)) form = "palm";
    occ.add(x, z, 0.22);
    placeTree(put, form, x, z, scale, ry);
    forms.add(form);
    trees += 1;
  }
  tally.trees = trees;
  tally.forms = [...forms].sort();

  const spacing = 0.042;
  const rowH = spacing * Math.sqrt(3) / 2;
  let sprigs = 0;
  const sprigCap = 1050;
  for (let row = -30; row <= 30 && sprigs < sprigCap; row += 1) {
    const z = row * rowH;
    const shift = (row & 1) ? spacing * 0.5 : 0;
    for (let col = -30; col <= 30 && sprigs < sprigCap; col += 1) {
      const x = col * spacing + shift;
      if (x * x + z * z > 1.02 * 1.02) continue;
      if (occ.hit(x, z, 0.015)) continue;
      const tone = sprigs % 3;
      put({
        logical: "sprig",
        kind: "sprig",
        color: tone === 0 ? LEAF : tone === 1 ? LEAF_B : LEAF_LIT,
        x,
        y: 0.035,
        z,
        sx: 0.04,
        sy: 0.07,
        sz: 0.04,
        ry: row * 0.17,
      });
      sprigs += 1;
    }
  }
  tally.sprigs = sprigs;

  const props = SHARED.concat(INTERIOR[island.id] || []);
  let interior = 0;
  let tries = 0;
  while (interior < 34 && tries < 900) {
    tries += 1;
    const ang = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * 0.9;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    if (occ.hit(x, z, 0.06)) continue;
    const spec = props[interior % props.length];
    occ.add(x, z, 0.06);
    put({ ...spec, x, z, ry: rng() * Math.PI * 2 });
    interior += 1;
  }
  tally.interior = interior;

  let tufts = 0;
  tries = 0;
  while (tufts < 40 && tries < 300) {
    tries += 1;
    const ang = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * 0.98;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    if (occ.hit(x, z, 0.03)) continue;
    occ.add(x, z, 0.03);
    put({
      logical: "tuft",
      kind: "leaf",
      color: tufts % 2 ? LEAF_B : LEAF_LIT,
      x,
      y: 0.012,
      z,
      sx: 0.05,
      sy: 0.02,
      sz: 0.05,
      ry: rng() * 6,
    });
    tufts += 1;
  }

}

function sampleRing(rng, places, minDist, maxDist, extras, gap, need) {
  const found = [];
  let guard = 0;
  while (found.length < need && guard < 9000) {
    guard += 1;
    const host = places[Math.floor(rng() * places.length)];
    const ang = rng() * Math.PI * 2;
    const dist = minDist + rng() * (maxDist - minDist);
    const x = host.x + Math.cos(ang) * dist;
    const z = host.z + Math.sin(ang) * dist;
    let near = Infinity;
    for (const place of places) near = Math.min(near, Math.hypot(x - place.x, z - place.z));
    if (near < minDist || near > maxDist) continue;
    let blocked = false;
    for (const other of extras.concat(found)) {
      if (Math.hypot(x - other.x, z - other.z) < gap) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    found.push({ x, z, near });
  }
  return found;
}

const ISLET = ["light", "hut", "mangrove", "pavilion", "rack", "reeds", "lookout", "shells", "buoy"];

function seaPut(kit, group, spec) {
  return kit.part({
    kind: spec.kind,
    parent: group,
    x: spec.x || 0,
    y: spec.y || 0,
    z: spec.z || 0,
    sx: spec.sx,
    sy: spec.sy,
    sz: spec.sz,
    rx: spec.rx || 0,
    ry: spec.ry || 0,
    color: spec.color,
    glow: Boolean(spec.glow),
    cast: spec.cast === true,
    alive: () => true,
  });
}

function addIslet(scene, kit, spot, theme) {
  const group = new Group();
  group.position.set(spot.x, 0, spot.z);
  group.userData.kind = "islet";
  scene.add(group);
  const put = (spec) => seaPut(kit, group, spec);
  put({ kind: "sphere", color: SAND, y: 0.06, sx: 0.72, sy: 0.26, sz: 0.6, cast: true });
  if (theme === "light") {
    put({ kind: "cyl", color: CREAM, y: 0.42, sx: 0.1, sy: 0.5, sz: 0.1, cast: true });
    put({ kind: "cone6", color: CROSS, y: 0.72, sx: 0.16, sy: 0.14, sz: 0.16 });
    put({ kind: "sphere", color: BULB, y: 0.84, sx: 0.08, sy: 0.08, sz: 0.08, glow: true });
  } else if (theme === "hut") {
    put({ kind: "box", color: WOOD, y: 0.28, sx: 0.28, sy: 0.2, sz: 0.24, cast: true });
    put({ kind: "cone6", color: CROSS, y: 0.46, sx: 0.36, sy: 0.16, sz: 0.32 });
  } else if (theme === "mangrove") {
    for (const [x, z] of [[-0.12, 0.04], [0.1, -0.06], [0.02, 0.12], [-0.04, -0.1]]) {
      put({ kind: "bole", color: WOOD, x, y: 0.28, z, sx: 0.05, sy: 0.32, sz: 0.05 });
      put({ kind: "leaf", color: leafHex("base"), x, y: 0.48, z, sx: 0.16, sy: 0.12, sz: 0.16 });
    }
  } else if (theme === "pavilion") {
    for (const [x, z] of [[-0.16, -0.12], [0.16, -0.12], [-0.16, 0.12], [0.16, 0.12]]) {
      put({ kind: "cyl", color: WOOD, x, y: 0.28, z, sx: 0.03, sy: 0.28, sz: 0.03 });
    }
    put({ kind: "box", color: SAND, y: 0.44, sx: 0.42, sy: 0.04, sz: 0.34 });
  } else if (theme === "rack") {
    put({ kind: "cyl", color: WOOD, x: -0.14, y: 0.24, sx: 0.025, sy: 0.28, sz: 0.025 });
    put({ kind: "cyl", color: WOOD, x: 0.14, y: 0.24, sx: 0.025, sy: 0.28, sz: 0.025 });
    put({ kind: "box", color: CLOTH, y: 0.36, sx: 0.32, sy: 0.015, sz: 0.08 });
  } else if (theme === "reeds") {
    for (let i = 0; i < 7; i += 1) {
      const ang = i * 0.9;
      put({ kind: "sprig", color: REED, x: Math.cos(ang) * 0.16, y: 0.2, z: Math.sin(ang) * 0.14, sx: 0.05, sy: 0.28, sz: 0.05 });
    }
  } else if (theme === "lookout") {
    put({ kind: "box", color: WOOD_B, y: 0.24, sx: 0.28, sy: 0.06, sz: 0.28, cast: true });
    put({ kind: "cyl", color: BOARD, y: 0.4, sx: 0.03, sy: 0.28, sz: 0.03 });
    put({ kind: "box", color: CREAM, y: 0.32, sx: 0.22, sy: 0.04, sz: 0.22 });
  } else if (theme === "shells") {
    for (let i = 0; i < 5; i += 1) {
      const ang = i * 1.2;
      put({ kind: "sphere", color: i % 2 ? CREAM : SAND, x: Math.cos(ang) * 0.14, y: 0.12, z: Math.sin(ang) * 0.12, sx: 0.08, sy: 0.05, sz: 0.07 });
    }
  } else {
    put({ kind: "sphere", color: TEAL, y: 0.22, sx: 0.16, sy: 0.16, sz: 0.16, cast: true });
    put({ kind: "cone6", color: CROSS, y: 0.36, sx: 0.08, sy: 0.14, sz: 0.08 });
  }
  return group;
}

function addBoat(scene, kit, spot, rng) {
  const group = new Group();
  group.position.set(spot.x, 0, spot.z);
  group.rotation.y = rng() * Math.PI * 2;
  group.userData.kind = "boat";
  scene.add(group);
  seaPut(kit, group, { kind: "rbox", color: HULL, y: 0.1, sx: 0.52, sy: 0.12, sz: 0.2, cast: true });
  seaPut(kit, group, { kind: "cyl", color: WOOD, y: 0.28, sx: 0.02, sy: 0.28, sz: 0.02 });
  seaPut(kit, group, { kind: "tetra", color: SAIL, y: 0.4, z: -0.02, sx: 0.22, sy: 0.28, sz: 0.12 });
  return group;
}

export function addSeaDecor(scene, kit, placed) {
  const rng = mulberry(0x5eedc0de);
  const islets = sampleRing(rng, placed, MESH_R + 1.7, MESH_R + 3.5, [], 2.1, 9);
  const boats = sampleRing(rng, placed, MESH_R + 1.2, MESH_R + 2.9, islets, 1.35, 13);
  sea.islets = islets;
  sea.boats = boats;
  sea.isletClear = islets.reduce((min, spot) => Math.min(min, spot.near), Infinity);
  sea.boatClear = boats.reduce((min, spot) => Math.min(min, spot.near), Infinity);
  islets.forEach((spot, index) => addIslet(scene, kit, spot, ISLET[index % ISLET.length]));
  for (const spot of boats) addBoat(scene, kit, spot, rng);
}

export function decorReport() {
  const decorByIsland = {};
  let pieces = 0;
  let vignettes = 0;
  let interior = 0;
  for (const [id, row] of byIsland) {
    decorByIsland[id] = {
      pieces: row.pieces,
      kinds: row.kinds.size,
      kindNames: [...row.kinds].sort(),
      vignettes: row.vignettes,
      interior: row.interior,
      sprigs: row.sprigs,
      trees: row.trees,
      forms: row.forms,
      bridges: row.bridges,
      at: row.at,
    };
    pieces += row.pieces;
    vignettes += row.vignettes;
    interior += row.interior;
  }
  return {
    decorByIsland,
    pieces,
    vignettes,
    interior,
    boats: sea.boats.length,
    islets: sea.islets.length,
    boatClear: sea.boatClear,
    isletClear: sea.isletClear,
  };
}

export function buildingParts(id, accent) {
  const body = id % 5;
  const cap = Math.floor(id / 5) % 4;
  const wing = Math.floor(id / 20) % 2;
  const wall = wallA;
  const roof = muteAccent(accent);
  const parts = [];
  const push = (kind, color, x, y, z, sx, sy, sz, rot = null, glow = false) => {
    parts.push({ kind, color, x, y, z, sx, sy, sz, rot, glow });
  };
  let top = 0.3;
  let footW = 0.34;
  let footD = 0.26;
  let frontZ = 0.13;
  let sideX = 0.17;
  let wallH = 0.28;
  let wallY = 0.14;
  if (body === 0) {
    push("box", wall, 0, 0.14, 0, 0.34, 0.28, 0.26);
    push("box", CREAM, 0, 0.16, 0.14, 0.1, 0.08, 0.02, null, true);
    top = 0.3;
  } else if (body === 1) {
    const h = 0.42 + (id % 3) * 0.04;
    push("box", wall, 0, h / 2, 0, 0.22, h, 0.2);
    push("box", CREAM, 0, h * 0.55, 0.11, 0.08, 0.1, 0.02, null, true);
    top = h;
    footW = 0.22;
    footD = 0.2;
    frontZ = 0.1;
    sideX = 0.11;
    wallH = h;
    wallY = h / 2;
  } else if (body === 2) {
    push("cyl", wall, 0, 0.18, 0, 0.26, 0.36, 0.26);
    push("box", CREAM, 0, 0.2, 0.14, 0.08, 0.1, 0.02, null, true);
    top = 0.38;
    footW = 0.26;
    footD = 0.26;
    frontZ = 0.13;
    sideX = 0.13;
    wallH = 0.36;
    wallY = 0.18;
  } else if (body === 3) {
    push("box", wall, 0, 0.12, 0, 0.48, 0.24, 0.22);
    push("box", CREAM, -0.12, 0.14, 0.12, 0.08, 0.08, 0.02, null, true);
    push("box", CREAM, 0.12, 0.14, 0.12, 0.08, 0.08, 0.02, null, true);
    top = 0.26;
    footW = 0.48;
    footD = 0.22;
    frontZ = 0.11;
    sideX = 0.24;
    wallH = 0.24;
    wallY = 0.12;
  } else {
    push("cone", wall, 0, 0.2, 0, 0.36, 0.4, 0.32);
    push("sphere", CREAM, 0, 0.18, 0.1, 0.06, 0.06, 0.04, null, true);
    top = 0.4;
    footW = 0.36;
    footD = 0.32;
    frontZ = 0.12;
    sideX = 0.16;
    wallH = 0.28;
    wallY = 0.16;
  }
  const foundationKind = body === 2 ? "cyl" : "box";
  push(foundationKind, plinth, 0, 0.015, 0, footW * 1.12, 0.03, footD * 1.12);
  push("box", doorBrown, 0, 0.07, frontZ + 0.012, 0.06, 0.11, 0.02);
  push("box", wallC, sideX, wallY, 0, 0.02, wallH * 0.92, footD * 0.82);
  push("box", wallC, -sideX, wallY, 0, 0.02, wallH * 0.92, footD * 0.82);
  if (cap === 0) push("roof", roof, 0, top + 0.08, 0, 1.15 * 1.15, 0.7, 1.05 * 1.15);
  else if (cap === 1) push("box", roof, 0, top + 0.03, 0, body === 3 ? 0.52 : 0.38, 0.06, 0.3);
  else if (cap === 2) push("torus", roof, 0, top + 0.06, 0, 0.28, 0.2, 0.28, { x: 1.15 });
  else push("sphere", roof, 0, top + 0.06, 0, 0.2, 0.14, 0.2);
  if (body === 0 || body === 3) push("box", chimneyClay, 0.07, top + 0.14, -0.04, 0.04, 0.1, 0.04);
  if (wing === 1) push("box", WOOD, 0.2, 0.08, 0.02, 0.12, 0.14, 0.14);
  else push("cyl", WOOD_B, -0.14, 0.16, -0.02, 0.035, 0.16, 0.035);
  const mark = id % 4;
  if (mark === 0) push("box", STONE, 0.1, 0.04, 0.16, 0.08, 0.06, 0.06);
  else if (mark === 1) push("sphere", STONE, -0.1, 0.05, 0.14, 0.05, 0.05, 0.05);
  else if (mark === 2) push("cyl", roof, 0.06, top + 0.16, 0, 0.03, 0.12, 0.03);
  else push("rbox", WOOD, -0.08, 0.05, 0.14, 0.1, 0.07, 0.08);
  if (id % 7 === 0) {
    push("box", CROSS, 0, top * 0.7, 0.15, 0.04, 0.12, 0.015);
    push("box", CROSS, 0, top * 0.7, 0.15, 0.12, 0.04, 0.015);
  }
  return parts;
}
