// Original implementation for this project. Not derived from third-party source code.
import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Basin, far ridges, forest and clouds around the 14 islands.
// World +x is east, +z is south. The default camera sits on +z (theta 0.18,
// phi 1.02, radius about 22 on a 1440×900 overview) and looks toward -z,
// so north is the top of the frame. A ring of radius 22 already lies on
// that top pixel row, and radius 50 is above the frame. The north hills
// therefore start just past the northern islets, not on that ring.

const BANDS = [
  { t: 0, color: 0xb7a888 },
  { t: 0.22, color: 0x8aab74 },
  { t: 0.42, color: 0x6e9a66 },
  { t: 0.66, color: 0x62866c },
  { t: 1, color: 0x867a62 },
];
const ROCK = 0x8a7a64;

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

export function createEnvironment(THREE, scene, { quality = "high", camera = null } = {}) {
  const plan = qualityPlan(quality);
  const rng = mulberry(0x22e170);
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
    // North hills (top of the default view), a west dune, a low east
    // headland, and side reefs south of the chain. The island basin stays
    // at the seabed: policy islands sit near z 0..16 and x -2..8.
    // Climb just north of the islets, then drop back so the far side
    // leaves a band of sky for the three ridge ribbons and the clouds.
    const north = smoothstep(-4.6, -8.8, z) * (1 - smoothstep(-9.4, -15.5, z));
    const westGate = 1 - smoothstep(11, 18, Math.abs(z - 5));
    const west = smoothstep(-7.8, -15, x) * westGate;
    const eastGate = 1 - smoothstep(9, 16, Math.abs(z - 7));
    const east = smoothstep(13.5, 22, x) * 0.65 * eastGate;
    const southSide = smoothstep(19.2, 27, z) * smoothstep(5, 12, Math.abs(x - 4));
    const rise = Math.max(north, west * 0.92, east, southSide * 0.55);
    const crest = 0.42 + shaped * (0.62 + north * 0.85) + west * 0.5;
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

  const spots = [];
  for (let x = -26; x <= 36; x += 0.52) {
    for (const z of [-7.55, -8.15]) {
      const y = heightAt(x, z);
      if (y < 0.32) continue;
      spots.push({ x, y, z, scale: 0.78, pine: ((x * 10) & 1) === 0 });
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
      z = -6.8 - rng() * 1.8;
    } else if (roll < 0.92) {
      x = -8.5 - rng() * 12;
      z = -2 + rng() * 16;
    } else {
      x = 14 + rng() * 10;
      z = 1 + rng() * 12;
    }
    if (z > 16) continue;
    const y = heightAt(x, z);
    if (y < 0.5 || y > 12) continue;
    if (noise.noise3d(x * 0.28, z * 0.28, 2.4) > 0.42) continue;
    spots.push({ x, y, z, scale: 0.72 + rng() * 0.4, pine: rng() < 0.55 });
  }

  function plant(geo, list, color) {
    if (!list.length) return null;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
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
  plant(pineGeo, pines, 0x5c9a70);
  plant(roundGeo, rounds, 0x6a9a58);
  plant(trunkGeo, spots, 0x9a7a58);

  const ridgeMix = [0.3, 0.55, 0.78];
  const ridgeBase = [new THREE.Color(0x68967a), new THREE.Color(0x7d92a4), new THREE.Color(0x8aa4b4)];
  const ridgeMats = [];
  const haze = new THREE.Color();
  const nightTint = new THREE.Color(0x24344c);
  // Three north-coast ribbons. A circle at radius 50/66/86 sits above this
  // camera, so each ribbon is an arc just beyond the hills that do show.
  const ridgeLayers = [
    { z0: -10.2, bow: 0.15, base: 0.25, crest: 2.9 },
    { z0: -11.5, bow: 0.15, base: 0.25, crest: 3.15 },
    { z0: -12.8, bow: 0.15, base: 0.25, crest: 3.35 },
  ];
  ridgeLayers.forEach((layer, index) => {
    const steps = 48;
    const geo = new THREE.BufferGeometry();
    const verts = [];
    const ids = [];
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      const x = -28 + u * 62;
      const z = layer.z0 - Math.sin(u * Math.PI) * layer.bow;
      const sky = 0.55 + 0.45 * Math.sin(u * 11 + index);
      const crest = layer.base + sky * layer.crest;
      verts.push(x, layer.base, z, x, crest, z);
      if (i < steps) {
        const a = i * 2;
        ids.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(ids);
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: ridgeBase[index], fog: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.kind = "ridge";
    mesh.raycast = () => {};
    scene.add(mesh);
    meshes.push(mesh);
    ridgeMats.push(mat);
  });

  const cloudGeo = new THREE.IcosahedronGeometry(1, 2);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xf3f0e8 });
  const cloudBase = new THREE.Color(0xf3f0e8);
  const cloudCount = 12;
  const puffsPer = 11;
  const clouds = [];
  for (let c = 0; c < cloudCount; c += 1) {
    const yaw = rng() * Math.PI * 2;
    clouds.push({
      x: -16 + rng() * 38,
      y: 2.55 + rng() * 0.65,
      z: -9.8 - rng() * 1.6,
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

  const lampSpots = [];
  let lampGuard = 0;
  while (lampSpots.length < 36 && lampGuard < 200) {
    lampGuard += 1;
    const x = -18 + rng() * 42;
    const z = -7.3 - rng() * 1.5;
    const y = heightAt(x, z);
    if (y < 0.35) continue;
    const n = 4 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k += 1) {
      lampSpots.push({
        x: x + (rng() - 0.5) * 1.8,
        y: y + 0.28,
        z: z + (rng() - 0.5) * 1.4,
      });
    }
  }
  const lampGeo = new THREE.SphereGeometry(0.12, 6, 5);
  const lampMat = new THREE.MeshBasicMaterial({
    color: 0xffc27a,
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
    cloudMat.color.copy(cloudBase).lerp(haze, 0.18);
  }

  function update(dt) {
    for (const cloud of clouds) {
      cloud.x += dt * cloud.speed;
      if (cloud.x > 78) cloud.x = -78;
    }
    writeClouds();
  }

  function info() {
    return {
      draws: meshes.length,
      trees: spots.length,
      pines: pines.length,
      rounds: rounds.length,
      clouds: cloudCount,
      lights: lampSpots.length,
      quality,
      seg: plan.seg,
    };
  }

  return { setTime, update, heightAt, info };
}
