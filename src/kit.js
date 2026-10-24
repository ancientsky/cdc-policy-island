// Original implementation for this project. Not derived from third-party source code.
import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
} from "three";
import { glowLamp } from "./palette.js";

// One solid material and one glowing material. Instance color carries the paint.
// Windows and lamps share the glow material and a per-instance aGlow.
const glowMat = new MeshStandardMaterial({
  color: "#ffffff",
  emissive: glowLamp, emissiveIntensity: 0,
  roughness: 0.28,
  metalness: 0,
});
glowMat.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying float vGlow;")
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;");
};

const solidMat = new MeshStandardMaterial({ roughness: 0.78, metalness: 0 });

const dummy = new Object3D();
const world = new Matrix4();
const local = new Matrix4();
const le = local.elements;

function writeLocal(x, y, z, rx, ry, rz, sx, sy, sz) {
  if (rx === 0 && rz === 0) {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    le[0] = c * sx; le[1] = 0; le[2] = -s * sx; le[3] = 0;
    le[4] = 0; le[5] = sy; le[6] = 0; le[7] = 0;
    le[8] = s * sz; le[9] = 0; le[10] = c * sz; le[11] = 0;
    le[12] = x; le[13] = y; le[14] = z; le[15] = 1;
    return;
  }
  dummy.position.set(x, y, z);
  dummy.rotation.set(rx, ry, rz);
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  const src = dummy.matrix.elements;
  for (let i = 0; i < 16; i += 1) le[i] = src[i];
}

function writeWorld(parent) {
  const pe = parent.matrixWorld.elements;
  const te = world.elements;
  const a0 = le[0]; const a1 = le[1]; const a2 = le[2]; const a3 = le[3];
  const a4 = le[4]; const a5 = le[5]; const a6 = le[6]; const a7 = le[7];
  const a8 = le[8]; const a9 = le[9]; const a10 = le[10]; const a11 = le[11];
  const a12 = le[12]; const a13 = le[13]; const a14 = le[14]; const a15 = le[15];
  for (let row = 0; row < 4; row += 1) {
    const p0 = pe[row];
    const p1 = pe[4 + row];
    const p2 = pe[8 + row];
    const p3 = pe[12 + row];
    te[row] = p0 * a0 + p1 * a1 + p2 * a2 + p3 * a3;
    te[4 + row] = p0 * a4 + p1 * a5 + p2 * a6 + p3 * a7;
    te[8 + row] = p0 * a8 + p1 * a9 + p2 * a10 + p3 * a11;
    te[12 + row] = p0 * a12 + p1 * a13 + p2 * a14 + p3 * a15;
  }
}

function labelFor(kind, glow) {
  if (kind === "trunk" || kind === "crown" || kind === "crown2") return kind;
  if (glow && kind === "box") return "window";
  if (glow) return `glow-${kind}`;
  return kind;
}

export function createKit() {
  const geos = new Map();
  const records = [];
  const meshes = [];
  const buckets = [];
  const bucketOf = new Map();
  let built = false;

  function bucketFor(parent) {
    let bucket = bucketOf.get(parent);
    if (!bucket) {
      bucket = { parent, records: [], dirty: true };
      bucketOf.set(parent, bucket);
      buckets.push(bucket);
    }
    return bucket;
  }

  function geo(kind, geometry) {
    geos.set(kind, geometry);
  }

  function part(opts) {
    let kind = opts.kind;
    let glow = Boolean(opts.glow);
    if (kind === "glowbox") {
      kind = "box";
      glow = true;
    } else if (kind === "glowsphere") {
      kind = "sphere";
      glow = true;
    }
    if (!geos.has(kind)) throw new Error(`missing kit geometry ${kind}`);
    const n = records.length;
    const jitter = 1 + (((n * 7) % 9) - 4) * 0.0018;
    const shadowless = kind === "trunk" || kind === "leaf" || kind === "sprig" || kind === "bole";
    let label = labelFor(kind, glow);
    if (!glow && !shadowless && opts.cast === false) label = `flat-${label}`;
    const rec = {
      kind,
      label,
      glow,
      parent: opts.parent,
      x: opts.x || 0,
      y: opts.y || 0,
      z: opts.z || 0,
      sx: (opts.sx ?? 1) * jitter,
      sy: (opts.sy ?? 1) * jitter,
      sz: (opts.sz ?? 1) * jitter,
      rx: opts.rx || 0,
      ry: opts.ry || 0,
      rz: opts.rz || 0,
      color: new Color(opts.color || "#ffffff"),
      glowAmount: glow ? 1 : 0,
      alive: opts.alive || null,
      mesh: null,
      index: -1,
      glowAttr: null,
    };
    records.push(rec);
    bucketFor(opts.parent).records.push(rec);
    return rec;
  }

  function makeInstances(label, source, material, list, glow) {
    const geoCopy = source.clone();
    let mesh;
    // Separate constructors so each family is its own draw: trunks, crowns, windows.
    if (label === "trunk") mesh = new InstancedMesh(geoCopy, material, list.length);
    else if (label === "crown") mesh = new InstancedMesh(geoCopy, material, list.length);
    else if (label === "crown2") mesh = new InstancedMesh(geoCopy, material, list.length);
    else if (label === "window") mesh = new InstancedMesh(geoCopy, material, list.length);
    else mesh = new InstancedMesh(geoCopy, material, list.length);
    mesh.name = `kit-${label}`;
    mesh.frustumCulled = false;
    const noCast = glow || label === "trunk" || label === "leaf" || label === "sprig" || label === "bole" || label.startsWith("flat-");
    mesh.castShadow = !noCast;
    mesh.receiveShadow = !glow && label !== "leaf" && label !== "sprig";
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    if (glow) {
      const attr = new InstancedBufferAttribute(new Float32Array(list.length).fill(1), 1);
      geoCopy.setAttribute("aGlow", attr);
      mesh.userData.glowAttr = attr;
    }
    list.forEach((rec, index) => {
      rec.mesh = mesh;
      rec.index = index;
      rec.glowAttr = mesh.userData.glowAttr || null;
    });
    return mesh;
  }

  function build(scene) {
    const groups = new Map();
    for (const rec of records) {
      const list = groups.get(rec.label) || [];
      list.push(rec);
      groups.set(rec.label, list);
    }
    for (const [label, list] of groups) {
      const glow = list[0].glow;
      const mesh = makeInstances(label, geos.get(list[0].kind), glow ? glowMat : solidMat, list, glow);
      scene.add(mesh);
      meshes.push(mesh);
    }
    built = true;
    sync();
  }

  function touch() {
    for (const bucket of buckets) bucket.dirty = true;
  }

  function sync() {
    if (!built) return;
    const dirty = new Set();
    const colorDirty = new Set();
    const glowDirty = new Set();
    for (const bucket of buckets) {
      const parent = bucket.parent;
      parent.updateWorldMatrix(true, false);
      const ud = parent.userData;
      let cache = ud._kitE;
      if (!cache) {
        cache = new Float64Array(16);
        ud._kitE = cache;
        ud._kitGen = 0;
      }
      const src = parent.matrixWorld.elements;
      let moved = ud._kitGen === 0;
      if (!moved) {
        for (let i = 0; i < 16; i += 1) {
          if (cache[i] !== src[i]) {
            moved = true;
            break;
          }
        }
      }
      if (moved) {
        cache.set(src);
        ud._kitGen += 1;
      }
      if (!moved && !bucket.dirty) continue;
      const stamp = ud._kitGen;
      for (const rec of bucket.records) {
        const show = rec.alive ? rec.alive() : true;
        const glowNow = show ? rec.glowAmount : 0;
        if (rec._gen === stamp && rec._show === show && rec._glow === glowNow) continue;
        const pose = rec._gen !== stamp || rec._wrote !== true;
        const showChanged = rec._show !== show;
        rec._gen = stamp;
        rec._show = show;
        rec._glow = glowNow;
        if (pose || showChanged) {
          const s = show ? 1 : 0;
          writeLocal(rec.x, rec.y, rec.z, rec.rx, rec.ry, rec.rz, rec.sx * s, rec.sy * s, rec.sz * s);
          writeWorld(rec.parent);
          rec.mesh.setMatrixAt(rec.index, world);
          dirty.add(rec.mesh);
          rec._wrote = true;
        }
        if (!rec._colored) {
          rec.mesh.setColorAt(rec.index, rec.color);
          rec._colored = true;
          colorDirty.add(rec.mesh);
        }
        if (rec.glowAttr && (rec._glowWrote !== true || rec.glowAttr.getX(rec.index) !== glowNow)) {
          rec.glowAttr.setX(rec.index, glowNow);
          rec._glowWrote = true;
          glowDirty.add(rec.mesh);
        }
      }
      bucket.dirty = false;
    }
    for (const mesh of dirty) mesh.instanceMatrix.needsUpdate = true;
    for (const mesh of colorDirty) {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const mesh of glowDirty) {
      if (mesh.userData.glowAttr) mesh.userData.glowAttr.needsUpdate = true;
    }
  }

  function instanceCount() {
    return meshes.reduce((sum, mesh) => sum + mesh.count, 0);
  }

  return { geo, part, build, sync, touch, glowMat, instanceCount, meshCount: () => meshes.length };
}
