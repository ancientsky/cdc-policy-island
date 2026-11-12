// Original implementation for this project. Not derived from third-party source code.
import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { bindSway } from "./kit.js";
import * as P from "./palette.js";

// Basin, far ridges, forest and clouds around the 14 islands.
// World +x is east, +z is south. The default camera sits on +z (theta 0.18,
// phi 1.02, radius about 22 on a 1440×900 overview) and looks toward -z,
// so north is the top of the frame. The northern quarantine island sits
// near z -7. Its shore stays open water: Taiwan meets no other country
// by land. Hills and ridge ribbons begin only after that strait.
// This camera is 38° at radius about 24, so a ring of radius 50 sits
// above the frame. The three ribbons are the north skyline instead.

const BANDS = [
  { t: 0, color: P.kb7a888 },
  { t: 0.22, color: P.k8aab74 },
  { t: 0.42, color: P.k6e9a66 },
  { t: 0.66, color: P.k62866c },
  { t: 1, color: P.k867a62 },
];
const ROCK = P.k8a7a64;

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function qualityPlan(quality) {
  if (quality === "low") return { seg: 110, trees: 2000 };
  if (quality === "mid") return { seg: 150, trees: 3500 };
  return { seg: 200, trees: 6000 };
}

export function createEnvironment(THREE, scene, { quality = "high", camera = null, clearings = [], motion = null } = {}) {
  const plan = qualityPlan(quality);
  const rng = mulberry(2285936); // hash seed
  const noise = new SimplexNoise({ random: rng });
  const meshes = [];

  function fbm(x, z) {
    let freq = 0.03;
    let amp = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < 4; i += 1) {
      sum += amp * noise.noise3d(x * freq, z * freq, 0.15);
      norm += amp;
      amp *= 0.5;
      freq *= 2.05;
    }
    return sum / norm;
  }

  function heightAt(x, z) {
    const shaped = fbm(x, z) * 0.5 + 0.5;
    // North hills sit just past the strait, low enough that the ridge
    // ribbons behind them stay inside the frame. West dune, east
    // headland, and south side reefs stay. The basin, including the
    // quarantine island near z -7, remains seabed.
    const north = smoothstep(-18.0, -19.8, z) * (1 - smoothstep(-21.2, -23.4, z));
    const westGate = 1 - smoothstep(11, 18, Math.abs(z - 5));
    const west = smoothstep(-7.8, -15, x) * westGate;
    const eastGate = 1 - smoothstep(9, 16, Math.abs(z - 7));
    const east = smoothstep(13.5, 22, x) * 0.65 * eastGate;
    const southSide = smoothstep(19.2, 27, z) * smoothstep(5, 12, Math.abs(x - 4));
    const rise = Math.max(north, west * 0.92, east, southSide * 0.55);
    // The north shore stays low. Taller ground puts the canopy over the
    // ridge ribbons and the overview shows one hill instead of three.
    const crest = (1 - north) * (0.35 + shaped * 0.45 + west * 0.5) + north * (0.48 + shaped * 0.28);
    const height = -1.6 * (1 - rise) + rise * crest;
    // +z (toward the default camera) is damped so the near side stays open.
    const towardCamera = Math.max(0, Math.cos(Math.atan2(x, z)));
    return height * (1 - 0.7 * towardCamera ** 2.2);
  }

  const terrainGeo = new THREE.PlaneGeometry(160, 160, plan.seg, plan.seg);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color();
  const grass = new THREE.Color();
  const rock = new THREE.Color(ROCK);
  const paint = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const slope = Math.hypot(heightAt(x + 1.2, z) - heightAt(x - 1.2, z), heightAt(x, z + 1.2) - heightAt(x, z - 1.2)) / 2.4;
    const bandT = smoothstep(-1.2, 7.2, y);
    let lo = BANDS[0];
    let hi = BANDS[BANDS.length - 1];
    for (let b = 0; b < BANDS.length - 1; b += 1) {
      if (bandT >= BANDS[b].t && bandT <= BANDS[b + 1].t) {
        lo = BANDS[b];
        hi = BANDS[b + 1];
        break;
      }
    }
    const span = Math.max(0.0001, hi.t - lo.t);
    sand.set(lo.color);
    grass.set(hi.color);
    paint.copy(sand).lerp(grass, (bandT - lo.t) / span);
    if (slope > 0.35) paint.lerp(rock, Math.min(1, (slope - 0.35) / 0.45));
    const wobble = 1 + noise.noise3d(x * 0.17, z * 0.17, 4) * 0.025;
    colors[i * 3] = paint.r * wobble;
    colors[i * 3 + 1] = paint.g * wobble;
    colors[i * 3 + 2] = paint.b * wobble;
  }
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.userData.kind = "terrain";
  terrain.receiveShadow = true;
  terrain.raycast = () => {};
  scene.add(terrain);
  meshes.push(terrain);

  const coneA = new THREE.ConeGeometry(0.5, 1.05, 6);
  coneA.translate(0, 0.95, 0);
  const coneB = new THREE.ConeGeometry(0.34, 0.72, 6);
  coneB.translate(0, 1.5, 0);
  const pineGeo = mergeGeometries([coneA, coneB]);
  const ballA = new THREE.IcosahedronGeometry(0.46, 0);
  ballA.translate(0, 0.95, 0);
  const ballB = new THREE.IcosahedronGeometry(0.32, 0);
  ballB.translate(0, 1.38, 0);
  const roundGeo = mergeGeometries([ballA, ballB]);
  const trunkGeo = new THREE.CylinderGeometry(0.07, 0.12, 0.7, 5);
  trunkGeo.translate(0, 0.35, 0);

  // Backdrop pines share a latitude with the northern islands. Skip a disc
  // around each island so a close camera is not standing inside a trunk.
  function inClearing(x, z) {
    for (const disc of clearings) {
      const dx = x - disc.x;
      const dz = z - disc.z;
      if (dx * dx + dz * dz < disc.r * disc.r) return true;
    }
    return false;
  }

  const spots = [];
  for (let x = -26; x <= 36; x += 0.52) {
    for (const z of [-19.5, -20.2]) {
      if (inClearing(x, z)) continue;
      const y = heightAt(x, z);
      if (y < 0.32) continue;
      const westSmall = x < -8 ? 0.2 : 0.26;
      spots.push({ x, y, z, scale: westSmall, pine: ((x * 10) & 1) === 0 });
    }
  }
  let guard = 0;
  while (spots.length < plan.trees && guard < plan.trees * 50) {
    guard += 1;
    let x;
    let z;
    const roll = rng();
    if (roll < 0.78) {
      x = -26 + rng() * 58;
      z = -19.1 - rng() * 1.6;
    } else if (roll < 0.92) {
      x = -8.5 - rng() * 12;
      z = -2 + rng() * 16;
    } else {
      x = 14 + rng() * 10;
      z = 1 + rng() * 12;
    }
    if (z > 16) continue;
    if (inClearing(x, z)) continue;
    const y = heightAt(x, z);
    if (y < 0.5 || y > 12) continue;
    if (noise.noise3d(x * 0.28, z * 0.28, 2.4) > 0.42) continue;
    const northTree = z < -14;
    const northScale = (x < -8 ? 0.2 : 0.26) + rng() * 0.06;
    spots.push({ x, y, z, scale: northTree ? northScale : 0.72 + rng() * 0.4, pine: rng() < 0.55 });
  }

  function plant(geo, list, color, sway) {
    if (!list.length) return null;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
    if (sway && motion) bindSway(mat, motion);
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.userData.kind = "forest";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    const dummy = new THREE.Object3D();
    list.forEach((spot, index) => {
      dummy.position.set(spot.x, spot.y, spot.z);
      dummy.scale.setScalar(spot.scale);
      dummy.rotation.y = spot.x * 0.2;
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    meshes.push(mesh);
    return mesh;
  }
  const pines = spots.filter((spot) => spot.pine);
  const rounds = spots.filter((spot) => !spot.pine);
  plant(pineGeo, pines, P.k5c9a70, true);
  plant(roundGeo, rounds, P.k6a9a58, true);
  plant(trunkGeo, spots, P.k9a7a58, false);

  const ridgeMix = [0.3, 0.55, 0.78];
  const ridgeBase = [new THREE.Color(P.k68967a), new THREE.Color(P.k7d92a4), new THREE.Color(P.k8aa4b4)];
  const ridgeMats = [];
  const haze = new THREE.Color();
  const nightTint = new THREE.Color(P.k24344c);
  // Three skyline ribbons behind the forest. A flat tall wall leaves
  // this 38° frame, and equal heights collapse into one edge. Each
  // crest rises toward the east so the layers stay stacked in the
  // overview. Mixes 0.3 / 0.55 / 0.78 still fade toward the horizon.
  const ridgeShade = [
    [0.62, 0.82, 0.58],
    [0.55, 0.68, 0.82],
    [0.9, 0.95, 0.98],
  ];
  const ridgeLayers = [
    { z0: -21.0, bow: 0.1, west: 0.12, rise: 0.7, base: -1.6, edge0: -10, edge1: 16 },
    { z0: -23.4, bow: 0.1, west: 0.2, rise: 1.75, base: -1.6, edge0: -14, edge1: 14 },
    { z0: -27.6, bow: 0.1, west: 0.28, rise: 1.85, base: -1.6, edge0: -14, edge1: 14 },
  ];
  ridgeLayers.forEach((layer, index) => {
    const steps = 64;
    const geo = new THREE.BufferGeometry();
    const verts = [];
    const cols = [];
    const ids = [];
    const shade = ridgeShade[index];
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      const x = -36 + u * 76;
      const z = layer.z0 - Math.sin(u * Math.PI) * layer.bow;
      const crest = layer.west + smoothstep(layer.edge0, layer.edge1, x) * layer.rise + Math.sin(x * 0.31 + index) * 0.03;
      verts.push(x, layer.base, z, x, crest, z);
      cols.push(shade[0] * 0.85, shade[1] * 0.85, shade[2] * 0.85, shade[0], shade[1], shade[2]);
      if (i < steps) {
        const a = i * 2;
        ids.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(ids);
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: ridgeBase[index], fog: false, vertexColors: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.kind = "ridge";
    mesh.raycast = () => {};
    scene.add(mesh);
    meshes.push(mesh);
    ridgeMats.push(mat);
  });

  const cloudGeo = new THREE.IcosahedronGeometry(1, 2);
  const cloudMat = new THREE.MeshBasicMaterial({
    color: P.kf3f0e8,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const cloudBase = new THREE.Color(P.kf3f0e8);
  const cloudCount = 12;
  const puffsPer = 11;
  const clouds = [];
  for (let c = 0; c < cloudCount; c += 1) {
    const yaw = rng() * Math.PI * 2;
    clouds.push({
      x: -16 + rng() * 38,
      y: 1.72 + rng() * 0.5,
      z: -8.8 - rng() * 2.4,
      yaw,
      speed: 0.55 + rng() * 0.35,
      len: 4.2 + rng() * 2.4,
    });
  }
  const cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount * puffsPer);
  cloudMesh.userData.kind = "cloud";
  cloudMesh.raycast = () => {};
  cloudMesh.frustumCulled = false;
  scene.add(cloudMesh);
  meshes.push(cloudMesh);
  const puffDummy = new THREE.Object3D();

  function writeClouds() {
    let index = 0;
    const cam = camera ? camera.position : null;
    for (const cloud of clouds) {
      const near = cam ? Math.hypot(cam.x - cloud.x, cam.y - cloud.y, cam.z - cloud.z) < 9 : false;
      for (let p = 0; p < puffsPer; p += 1) {
        const along = p < 8 ? (p / 7 - 0.5) * cloud.len : (p - 9) * 0.7;
        const mid = p < 8 ? 1 - Math.abs(p / 7 - 0.5) * 1.15 : 0.55;
        const scale = near ? 0 : Math.max(0.35, mid) * (p < 8 ? 1.15 : 0.7);
        const flat = p < 8 ? 0.72 : 0.38;
        puffDummy.position.set(
          cloud.x + Math.cos(cloud.yaw) * along,
          cloud.y - (p < 8 ? 0 : 0.55),
          cloud.z + Math.sin(cloud.yaw) * along,
        );
        puffDummy.scale.set(scale, scale * flat, scale);
        puffDummy.updateMatrix();
        cloudMesh.setMatrixAt(index, puffDummy.matrix);
        index += 1;
      }
    }
    cloudMesh.instanceMatrix.needsUpdate = true;
  }
  writeClouds();

  const shadowGeo = new THREE.CircleGeometry(4.2, 20);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const shadowCtx = shadowCanvas.getContext("2d");
  const shadowGrad = shadowCtx.createRadialGradient(32, 32, 2, 32, 32, 32);
  shadowGrad.addColorStop(0, "rgba(36, 44, 52, 1)");
  shadowGrad.addColorStop(0.55, "rgba(36, 44, 52, 0.55)");
  shadowGrad.addColorStop(1, "rgba(36, 44, 52, 0)");
  shadowCtx.fillStyle = shadowGrad;
  shadowCtx.fillRect(0, 0, 64, 64);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, cloudCount);
  shadowMesh.userData.kind = "cloud-shadow";
  shadowMesh.raycast = () => {};
  shadowMesh.frustumCulled = false;
  shadowMesh.renderOrder = 2;
  const shadowDummy = new THREE.Object3D();
  function writeShadows() {
    clouds.forEach((cloud, index) => {
      shadowDummy.position.set(cloud.x, 0.41, cloud.z);
      shadowDummy.rotation.set(0, 0, 0);
      shadowDummy.scale.set(1, 1, 1);
      shadowDummy.updateMatrix();
      shadowMesh.setMatrixAt(index, shadowDummy.matrix);
    });
    shadowMesh.instanceMatrix.needsUpdate = true;
  }
  writeShadows();
  scene.add(shadowMesh);
  meshes.push(shadowMesh);

  const lampSpots = [];
  const hamlets = [
    { x: -10, z: -19.7, n: 10 },
    { x: 1, z: -20.0, n: 12 },
    { x: 13, z: -19.6, n: 10 },
    { x: -16, z: 3.5, n: 8 },
    { x: 18, z: 6, n: 8 },
  ];
  for (const hamlet of hamlets) {
    const ground = heightAt(hamlet.x, hamlet.z);
    if (ground < 0.18) continue;
    for (let k = 0; k < hamlet.n; k += 1) {
      const x = hamlet.x + (rng() - 0.5) * 2.4;
      const z = hamlet.z + (rng() - 0.5) * 1.6;
      if (inClearing(x, z)) continue;
      const y = heightAt(x, z);
      if (y < 0.16) continue;
      lampSpots.push({ x, y: y + 0.22, z });
    }
  }
  // Hamlet boxes only catch a few dozen lamps. The rest sit on trees that
  // already cleared the ridges, so the night village reads as a village.
  const lampStride = Math.max(1, Math.floor(spots.length / 220));
  for (let i = 0; i < spots.length && lampSpots.length < 220; i += lampStride) {
    const spot = spots[i];
    lampSpots.push({ x: spot.x, y: spot.y + 0.22, z: spot.z });
  }
  const lampGeo = new THREE.SphereGeometry(0.16, 6, 5);
  const lampMat = new THREE.MeshBasicMaterial({
    color: P.glowLamp,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lamps.userData.kind = "village-light";
  lamps.raycast = () => {};
  const lampDummy = new THREE.Object3D();
  lampSpots.forEach((spot, index) => {
    lampDummy.position.set(spot.x, spot.y, spot.z);
    lampDummy.updateMatrix();
    lamps.setMatrixAt(index, lampDummy.matrix);
  });
  lamps.instanceMatrix.needsUpdate = true;
  lamps.visible = false;
  scene.add(lamps);
  meshes.push(lamps);

  function setTime(look) {
    haze.copy(look.haze);
    const night = look.night || 0;
    ridgeMats.forEach((mat, index) => {
      mat.color.copy(ridgeBase[index]).lerp(haze, ridgeMix[index]);
      if (night > 0) mat.color.lerp(nightTint, night * 0.45);
    });
    lampMat.opacity = night;
    lamps.visible = night > 0.02;
    // Stacked day-white puffs cross the night bloom threshold and wash out. Pull them toward the haze.
    cloudMat.color.copy(cloudBase).lerp(haze, 0.18 + night * 0.62);
    cloudMat.opacity = 1 - night * 0.65;
  }

  function update(dt, opts = {}) {
    if (!opts.hold) {
      for (const cloud of clouds) {
        cloud.x += dt * cloud.speed;
        if (cloud.x > 78) cloud.x = -78;
      }
    }
    writeClouds();
    writeShadows();
  }

  function cloudSample() {
    return clouds.map((cloud) => ({ x: cloud.x, y: cloud.y, z: cloud.z }));
  }

  function info() {
    return {
      draws: meshes.length,
      trees: spots.length,
      pines: pines.length,
      rounds: rounds.length,
      clouds: cloudCount,
      cloud: `#${cloudMat.color.getHexString()}`,
      cloudOpacity: cloudMat.opacity,
      lights: lampSpots.length,
      quality,
      seg: plan.seg,
    };
  }

  return { setTime, update, heightAt, info, cloudSample };
}
