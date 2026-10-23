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

// One solid material and one glowing material. Instance color carries the paint.
// Windows and lamps share the glow material and a per-instance aGlow.
const glowMat = new MeshStandardMaterial({
  color: "#ffffff",
  emissive: "#ffb15a",
  emissiveIntensity: 0.35,
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
  let built = false;

  function geo(kind, geometry) {
    geos.set(kind, geometry);
  }

  function part(opts) {
    const kind = opts.kind;
    if (!geos.has(kind)) throw new Error(`missing kit geometry ${kind}`);
    const rec = {
      kind,
      label: labelFor(kind, Boolean(opts.glow)),
      glow: Boolean(opts.glow),
      parent: opts.parent,
      x: opts.x || 0,
      y: opts.y || 0,
      z: opts.z || 0,
      sx: opts.sx ?? 1,
      sy: opts.sy ?? 1,
      sz: opts.sz ?? 1,
      rx: opts.rx || 0,
      ry: opts.ry || 0,
      rz: opts.rz || 0,
      color: new Color(opts.color || "#ffffff"),
      glowAmount: opts.glow ? 1 : 0,
      alive: opts.alive || null,
      mesh: null,
      index: -1,
      glowAttr: null,
    };
    records.push(rec);
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
    mesh.castShadow = label !== "trunk" && !glow;
    mesh.receiveShadow = !glow;
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

  function sync() {
    if (!built) return;
    const dirty = new Set();
    for (const rec of records) {
      const show = rec.alive ? rec.alive() : true;
      dummy.position.set(rec.x, rec.y, rec.z);
      dummy.rotation.set(rec.rx, rec.ry, rec.rz);
      dummy.scale.set(show ? rec.sx : 0, show ? rec.sy : 0, show ? rec.sz : 0);
      dummy.updateMatrix();
      rec.parent.updateWorldMatrix(true, false);
      world.multiplyMatrices(rec.parent.matrixWorld, dummy.matrix);
      rec.mesh.setMatrixAt(rec.index, world);
      rec.mesh.setColorAt(rec.index, rec.color);
      if (rec.glowAttr) rec.glowAttr.setX(rec.index, show ? rec.glowAmount : 0);
      dirty.add(rec.mesh);
    }
    for (const mesh of dirty) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (mesh.userData.glowAttr) mesh.userData.glowAttr.needsUpdate = true;
    }
  }

  function instanceCount() {
    return meshes.reduce((sum, mesh) => sum + mesh.count, 0);
  }

  return { geo, part, build, sync, glowMat, instanceCount, meshCount: () => meshes.length };
}
