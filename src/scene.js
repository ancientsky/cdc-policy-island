// Original implementation for this project. Not derived from third-party source code.
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { MESH_R, offsetToWorld } from "./hex.js";
import { hourCovers } from "./data.js";
import { t } from "./i18n.js";

// Meeple front is local -z: the nose sits at z < 0, the pack sits at z > 0.
// rotation.y = atan2(-dir.x, -dir.z) turns that -z axis onto dir.
// Check: dir (1, 0, 0) => rotation.y = -π/2 => local -z lands on world +x.

const _tangent = new THREE.Vector3();
const _threatDir = new THREE.Vector3();
const _crewDir = new THREE.Vector3();
const _crewFace = new THREE.Vector3();
const _crewAt = new THREE.Vector3();
const mixA = new THREE.Color();
const mixB = new THREE.Color();
const lookTop = new THREE.Color();
const lookHor = new THREE.Color();
const lookBot = new THREE.Color();
const lookWater = new THREE.Color();
const lookSun = new THREE.Color();
const lookHemi = new THREE.Color();
const lookGround = new THREE.Color();
const lookFill = new THREE.Color();

const LOOKS = [
  { h: 0, top: "#070b12", hor: "#121a24", bot: "#05080e", water: "#07141c", sun: "#b7c6ea", hemi: "#4a6280", ground: "#1c2834", fill: "#c5d4ee", exposure: 1.05, hemiI: 0.85, stars: 1 },
  { h: 5, top: "#1a1424", hor: "#4a3040", bot: "#141820", water: "#0c1e28", sun: "#e7b090", hemi: "#4a3848", ground: "#241810", fill: "#c49880", exposure: 0.74, hemiI: 0.32, stars: 0.55 },
  { h: 8.33, top: "#f3c7a0", hor: "#f7e6cf", bot: "#7eaea8", water: "#3eb0b4", sun: "#fff1d4", hemi: "#f4dcc0", ground: "#8d7348", fill: "#f0c4a0", exposure: 1.12, hemiI: 0.78, stars: 0 },
  { h: 12.5, top: "#7ec4dc", hor: "#e7f7f6", bot: "#b7ddd6", water: "#49c8d2", sun: "#fffaf2", hemi: "#e9f7f5", ground: "#a09068", fill: "#c5e6ee", exposure: 1.22, hemiI: 0.88, stars: 0 },
  { h: 18.67, top: "#3a1844", hor: "#e07a48", bot: "#1a2030", water: "#1a3c48", sun: "#ffb089", hemi: "#e8a888", ground: "#4a2c1c", fill: "#e09070", exposure: 0.92, hemiI: 0.5, stars: 0.2 },
  { h: 22, top: "#070b12", hor: "#162230", bot: "#05080e", water: "#07141c", sun: "#9eb0dc", hemi: "#4a6280", ground: "#1c2834", fill: "#c5d4ee", exposure: 1.05, hemiI: 0.85, stars: 0.95 },
  { h: 24, top: "#070b12", hor: "#121a24", bot: "#05080e", water: "#07141c", sun: "#b7c6ea", hemi: "#4a6280", ground: "#1c2834", fill: "#c5d4ee", exposure: 1.05, hemiI: 0.85, stars: 1 },
];

function norm(s) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, "");
}

function damp(current, goal, dt, speed) {
  return current + (goal - current) * (1 - Math.exp(-speed * dt));
}

function wrapAngle(d) {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function nightAmount(hour) {
  if (hour >= 7.5 && hour < 16.5) return 0;
  if (hour >= 16.5 && hour < 19.5) return (hour - 16.5) / 3;
  if (hour >= 5 && hour < 7.5) return 1 - (hour - 5) / 2.5;
  return 1;
}

function mixHex(a, b, t, target) {
  return target.copy(mixA.set(a)).lerp(mixB.set(b), t);
}

function lookAtHour(hour) {
  let i = 0;
  while (i < LOOKS.length - 1 && hour >= LOOKS[i + 1].h) i += 1;
  const a = LOOKS[i];
  const b = LOOKS[Math.min(i + 1, LOOKS.length - 1)];
  const t = b.h === a.h ? 0 : THREE.MathUtils.clamp((hour - a.h) / (b.h - a.h), 0, 1);
  return {
    t,
    top: mixHex(a.top, b.top, t, lookTop),
    hor: mixHex(a.hor, b.hor, t, lookHor),
    bot: mixHex(a.bot, b.bot, t, lookBot),
    water: mixHex(a.water, b.water, t, lookWater),
    sun: mixHex(a.sun, b.sun, t, lookSun),
    hemi: mixHex(a.hemi, b.hemi, t, lookHemi),
    ground: mixHex(a.ground, b.ground, t, lookGround),
    fill: mixHex(a.fill, b.fill, t, lookFill),
    exposure: a.exposure + (b.exposure - a.exposure) * t,
    hemiI: a.hemiI + (b.hemiI - a.hemiI) * t,
    stars: a.stars + (b.stars - a.stars) * t,
  };
}

export function createScene(canvas, data, { reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f7e6cf");
  scene.fog = new THREE.Fog("#f7e6cf", 42, 118);

  const skySunDir = new THREE.Vector3(0.45, 0.7, 0.3);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color("#f3c7a0") },
      horizon: { value: new THREE.Color("#f7e6cf") },
      bottom: { value: new THREE.Color("#7eaea8") },
      sunDir: { value: skySunDir },
      sunColor: { value: new THREE.Color("#ffe6bf") },
      sunAmt: { value: 1 },
    },
    vertexShader: `
      varying float h;
      varying vec3 vDir;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = world.xyz - cameraPosition;
        h = normalize(vDir).y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying float h;
      varying vec3 vDir;
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 bottom;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float sunAmt;
      void main() {
        vec3 dir = normalize(vDir);
        vec3 col = mix(bottom, horizon, smoothstep(-0.45, 0.05, h));
        col = mix(col, top, smoothstep(0.0, 0.55, h));
        float d = max(dot(dir, normalize(sunDir)), 0.0);
        float disc = smoothstep(0.9975, 0.9992, d);
        float glow = pow(d, 36.0) * 0.45 + pow(d, 6.0) * 0.18;
        col += sunColor * (disc * 1.15 + glow) * sunAmt;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 28, 18), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
  const labels = new CSS2DRenderer();
  labels.domElement.className = "labels";
  canvas.parentElement.appendChild(labels.domElement);

  const hemi = new THREE.HemisphereLight(0xd7efe8, 0x8d7348, 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3df, 1.35);
  sun.position.set(16, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.bias = -0.00035;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9ec9cf, 0.28);
  fill.position.set(-14, 8, -10);
  scene.add(fill);

  const waterGeo = new THREE.PlaneGeometry(200, 200, 64, 64);
  waterGeo.rotateX(-Math.PI / 2);
  const waterBase = Float32Array.from(waterGeo.attributes.position.array);
  const waterDeep = new THREE.Color("#0a3c48");
  const waterCrest = new THREE.Color("#8ee4dc");
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      deepColor: { value: waterDeep },
      crestColor: { value: waterCrest },
      sunDir: { value: skySunDir },
      sunColor: { value: new THREE.Color("#ffe6bf") },
      sunAmt: { value: 1 },
      stars: { value: 0 },
      uTime: { value: 0 },
      isle: { value: Array.from({ length: 14 }, () => new THREE.Vector2()) },
    },
    vertexShader: `
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vHeight = position.y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      uniform vec3 deepColor;
      uniform vec3 crestColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float sunAmt;
      uniform float stars;
      uniform float uTime;
      uniform vec2 isle[14];
      void main() {
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);
        float crest = smoothstep(-0.02, 0.08, vHeight);
        float swell = 0.5 + 0.5 * sin(vWorld.x * 0.46 + vWorld.z * 0.16 - uTime * 0.32);
        float rip = 0.5 + 0.5 * sin(vWorld.x * 1.15 - vWorld.z * 0.82 + uTime * 0.85);
        vec3 col = mix(deepColor, crestColor, swell * 0.72 + rip * 0.16 + crest * 0.28);
        col = mix(col, crestColor, fres * 0.18);
        float foam = smoothstep(0.035, 0.09, vHeight) * rip;
        float ring = 0.0;
        for (int i = 0; i < 14; i++) {
          float d = distance(vWorld.xz, isle[i]);
          ring = max(ring, smoothstep(2.35, 1.72, d) * (1.0 - smoothstep(1.72, 1.42, d)));
        }
        foam = max(foam, ring);
        col = mix(col, vec3(0.94, 0.98, 0.97), foam * 0.55 * (1.0 - stars * 0.8));
        vec3 halfV = normalize(normalize(sunDir) + viewDir);
        float spec = pow(max(dot(n, halfV), 0.0), 36.0);
        float glint = pow(max(dot(n, halfV), 0.0), 8.0) * rip;
        col += sunColor * (spec * 0.55 + glint * 0.14) * sunAmt * (1.0 - stars * 0.82);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.receiveShadow = false;
  scene.add(water);

  const sandMat = new THREE.MeshBasicMaterial({ color: "#e9d6a8", transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i += 1) {
    const ang = (i / 3) * Math.PI * 2 + 0.5;
    const sand = new THREE.Mesh(new THREE.CircleGeometry(0.6, 6), sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(Math.cos(ang) * 16.5, 0.015, Math.sin(ang) * 16.5);
    scene.add(sand);
  }

  const starPositions = [];
  for (let i = 0; i < 90; i += 1) {
    const ang = i * 2.399;
    const rad = 30 + (i % 7) * 4;
    starPositions.push(Math.cos(ang) * rad, 8 + (i % 5) * 2.2, Math.sin(ang) * rad);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3)),
    new THREE.PointsMaterial({ color: 0xfff8ea, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0 }),
  );
  scene.add(stars);

  const skirtGeo = new THREE.CylinderGeometry(MESH_R * 1.08, MESH_R * 1.18, 0.1, 6);
  const coastGeo = new THREE.CylinderGeometry(MESH_R, MESH_R * 0.94, 0.38, 6);
  const topGeo = new THREE.CylinderGeometry(MESH_R * 0.86, MESH_R * 0.92, 0.18, 6);
  skirtGeo.rotateY(Math.PI / 6);
  coastGeo.rotateY(Math.PI / 6);
  topGeo.rotateY(Math.PI / 6);
  const shadeGeo = new THREE.CircleGeometry(MESH_R * 1.22, 6);
  shadeGeo.rotateX(-Math.PI / 2);
  const shadeMat = new THREE.MeshBasicMaterial({ color: "#041014", transparent: true, opacity: 0.14, depthWrite: false });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  const unitCone = new THREE.ConeGeometry(0.5, 1, 6);
  const unitSphere = new THREE.SphereGeometry(0.5, 12, 10);
  const unitTorus = new THREE.TorusGeometry(0.5, 0.1, 6, 16);
  const roofGeo = new THREE.ConeGeometry(0.24, 0.3, 4);
  roofGeo.rotateY(Math.PI / 4);
  const trunkGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.16, 5);
  const crownGeo = new THREE.ConeGeometry(0.16, 0.34, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#6b4a32", roughness: 0.9 });
  const glowGeo = new THREE.CircleGeometry(MESH_R * 1.05, 6);
  glowGeo.rotateX(-Math.PI / 2);
  // Outer rim stays short of the next island's coast. Centers are √3 * HEX_SIZE apart.
  const ringGeo = new THREE.RingGeometry(MESH_R * 0.985, MESH_R * 1.058, 6);

  const raw = data.islands.map((island) => ({ island, ...offsetToWorld(island.col, island.row) }));
  const mainland = raw.filter((p) => p.island.id !== "amr");
  const cx = mainland.reduce((s, p) => s + p.x, 0) / mainland.length;
  const cz = mainland.reduce((s, p) => s + p.z, 0) / mainland.length;

  const pickables = [];
  const views = new Map();
  const lamps = [];

  function tag(mesh, islandId, cast = true) {
    mesh.userData = { kind: "island", islandId };
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    pickables.push(mesh);
    return mesh;
  }

  function tree(parent, x, z, leaf) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 0.62, z);
    const leafMat = new THREE.MeshStandardMaterial({ color: leaf, roughness: 0.82 });
    const crown = new THREE.Mesh(crownGeo, leafMat);
    crown.position.set(x, 0.86, z);
    const crown2 = new THREE.Mesh(crownGeo, leafMat);
    crown2.position.set(x + 0.05, 0.98, z - 0.04);
    crown2.scale.setScalar(0.72);
    parent.add(trunk, crown, crown2);
    tag(trunk, parent.userData.islandId, false);
    tag(crown, parent.userData.islandId);
    tag(crown2, parent.userData.islandId);
  }

  function house(parent, item, x, z, index, island) {
    const group = new THREE.Group();
    group.position.set(x, 0.55, z);
    const ud = { kind: "item", islandId: island.id, itemId: item.id };
    const winMat = new THREE.MeshStandardMaterial({
      color: "#fff6d8",
      emissive: "#ffb15a",
      emissiveIntensity: 0.2,
      roughness: 0.28,
    });
    const wall = new THREE.MeshStandardMaterial({ color: "#f7f1e4", roughness: 0.82 });
    const roof = new THREE.MeshStandardMaterial({ color: island.accent, roughness: 0.48 });
    const wood = new THREE.MeshStandardMaterial({ color: "#8d5a3c", roughness: 0.86 });
    const stone = new THREE.MeshStandardMaterial({ color: "#d9d0c2", roughness: 0.9 });
    const add = (geo, mat, px, py, pz, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = ud;
      group.add(mesh);
      pickables.push(mesh);
      return mesh;
    };
    const v = index % 4;
    const kit = island.kit;
    if (kit === "tower") {
      const h = 0.48 + v * 0.14;
      add(box, wall, 0, h / 2, 0, 0.18, h, 0.18);
      add(box, roof, 0, h + 0.03, 0, 0.26, 0.05, 0.26);
      add(unitCyl, winMat, 0, h * 0.62, 0.1, 0.08, 0.08, 0.03);
      const dish = add(unitTorus, roof, 0, h + 0.16, 0, 0.16, 0.16, 0.16);
      dish.rotation.x = 1.05;
    } else if (kit === "port") {
      if (v === 0) {
        add(unitCyl, wall, 0, 0.28, 0, 0.16, 0.5, 0.16);
        add(unitCyl, roof, 0, 0.58, 0, 0.22, 0.08, 0.22);
        add(unitSphere, winMat, 0, 0.7, 0, 0.12, 0.12, 0.12);
      } else {
        add(box, wall, 0, 0.16, 0, 0.42, 0.22, 0.28);
        add(roofGeo, roof, 0, 0.38, 0, 0.7, 0.55, 0.7);
        add(box, winMat, 0, 0.18, 0.15, 0.1, 0.08, 0.02);
        add(unitCyl, wood, 0.22, 0.1, 0.16, 0.05, 0.16, 0.05);
      }
    } else if (kit === "lab") {
      add(box, wall, 0, 0.2, 0, 0.4, 0.32, 0.28);
      add(box, roof, 0, 0.38, 0, 0.44, 0.04, 0.32);
      add(box, winMat, 0, 0.22, 0.15, 0.22, 0.1, 0.02);
      add(unitCyl, stone, v === 1 ? 0.16 : -0.16, 0.48, 0, 0.05, 0.22, 0.05);
      add(unitSphere, winMat, v === 1 ? 0.16 : -0.16, 0.62, 0, 0.08, 0.08, 0.08);
    } else if (kit === "clinic") {
      add(box, wall, 0, 0.16, 0, 0.36, 0.26, 0.28);
      add(roofGeo, roof, 0, 0.4, 0, 0.62, 0.5, 0.62);
      add(box, new THREE.MeshStandardMaterial({ color: "#d4544a" }), 0, 0.22, 0.15, 0.05, 0.14, 0.02);
      add(box, new THREE.MeshStandardMaterial({ color: "#d4544a" }), 0, 0.22, 0.15, 0.14, 0.05, 0.02);
      if (v % 2 === 0) add(box, winMat, 0.16, 0.12, 0, 0.1, 0.14, 0.1);
    } else if (kit === "houses") {
      add(box, wall, 0, 0.14, 0, 0.34, 0.22, 0.26);
      add(roofGeo, roof, 0, 0.36, 0, 0.58, 0.48, 0.58);
      add(box, winMat, 0, 0.14, 0.14, 0.08, 0.08, 0.02);
      add(unitCyl, wood, 0.1, 0.4, -0.04, 0.04, 0.14, 0.04);
    } else if (kit === "school") {
      add(box, wall, 0, 0.16, 0, 0.46, 0.26, 0.3);
      add(roofGeo, roof, 0, 0.42, 0, 0.78, 0.46, 0.7);
      add(box, winMat, -0.1, 0.16, 0.16, 0.08, 0.08, 0.02);
      add(box, winMat, 0.1, 0.16, 0.16, 0.08, 0.08, 0.02);
      add(unitSphere, roof, 0, 0.58, 0, 0.08, 0.08, 0.08);
    } else if (kit === "yard") {
      add(box, wall, 0, 0.22, 0, 0.28, 0.2, 0.24);
      add(box, wood, -0.12, 0.1, 0.1, 0.04, 0.2, 0.04);
      add(box, wood, 0.12, 0.1, 0.1, 0.04, 0.2, 0.04);
      add(roofGeo, roof, 0, 0.4, 0, 0.5, 0.36, 0.5);
      add(unitCyl, new THREE.MeshStandardMaterial({ color: "#c47a4a", roughness: 0.7 }), 0.16, 0.08, -0.08, 0.1, 0.1, 0.1);
      add(box, winMat, 0, 0.24, 0.13, 0.1, 0.06, 0.02);
    } else if (kit === "dots") {
      add(box, wall, 0, 0.12, 0, 0.5, 0.16, 0.24);
      add(box, roof, 0, 0.22, 0, 0.54, 0.04, 0.28);
      add(box, winMat, 0, 0.12, 0.13, 0.12, 0.06, 0.02);
      for (let i = 0; i < 3; i += 1) add(unitSphere, stone, -0.12 + i * 0.12, 0.28, 0, 0.05, 0.05, 0.05);
    } else if (kit === "ribbon") {
      add(box, wall, 0, 0.14, 0, 0.28, 0.22, 0.22);
      add(box, winMat, 0, 0.16, 0.12, 0.08, 0.1, 0.02);
      const arch = add(unitTorus, new THREE.MeshStandardMaterial({ color: "#c4546a", roughness: 0.45 }), 0, 0.34, 0, 0.28, 0.28, 0.28);
      arch.rotation.x = Math.PI / 2;
    } else if (kit === "tent") {
      const tent = add(unitCone, wall, 0, 0.22, 0, 0.36, 0.4, 0.36);
      tent.rotation.y = Math.PI / 4;
      add(box, roof, 0, 0.08, 0.12, 0.1, 0.12, 0.02);
      add(unitSphere, winMat, 0, 0.16, 0.14, 0.06, 0.06, 0.04);
    } else if (kit === "hospital") {
      const h = 0.34 + (v % 2) * 0.16;
      add(box, wall, 0, h / 2, 0, 0.32, h, 0.26);
      add(box, roof, 0, h + 0.03, 0, 0.36, 0.04, 0.3);
      add(box, new THREE.MeshStandardMaterial({ color: "#e15a4a" }), 0, h * 0.72, 0.14, 0.05, 0.16, 0.02);
      add(box, new THREE.MeshStandardMaterial({ color: "#e15a4a" }), 0, h * 0.72, 0.14, 0.16, 0.05, 0.02);
      add(box, winMat, 0, h * 0.4, 0.14, 0.1, 0.06, 0.02);
    } else if (kit === "rings") {
      add(unitCyl, wall, 0, 0.14, 0, 0.28, 0.24, 0.28);
      const ring = add(unitTorus, roof, 0, 0.3, 0, 0.34, 0.34, 0.34);
      ring.rotation.x = Math.PI / 2;
      add(box, winMat, 0, 0.16, 0.15, 0.08, 0.08, 0.02);
    } else if (kit === "warehouse") {
      add(box, new THREE.MeshStandardMaterial({ color: "#e4d3a8", roughness: 0.88 }), 0, 0.16, 0, 0.46, 0.26, 0.32);
      add(roofGeo, roof, 0, 0.38, 0, 0.72, 0.4, 0.62);
      add(box, wood, 0.2, 0.1, 0.18, 0.12, 0.1, 0.12);
      add(box, winMat, -0.08, 0.16, 0.17, 0.08, 0.08, 0.02);
    } else {
      add(box, wall, 0, 0.14, 0, 0.34, 0.22, 0.26);
      add(unitCyl, stone, 0, 0.42, 0, 0.03, 0.36, 0.03);
      add(unitSphere, winMat, 0, 0.64, 0, 0.08, 0.08, 0.08);
      const ring = add(unitTorus, roof, 0, 0.5, 0, 0.16, 0.16, 0.16);
      ring.rotation.x = Math.PI / 2;
    }
    parent.add(group);
    return { group, item, winMat };
  }

  for (const point of raw) {
    const island = point.island;
    const x = point.x - cx;
    const z = point.z - cz;
    const group = new THREE.Group();
    group.userData.islandId = island.id;
    group.position.set(x, reduced ? 0 : -1.25, z);
    scene.add(group);

    const skirtMat = new THREE.MeshStandardMaterial({ color: island.coast, roughness: 0.97 });
    const coastMat = new THREE.MeshStandardMaterial({ color: island.coast, roughness: 0.9 });
    const landMat = new THREE.MeshStandardMaterial({ color: island.land, roughness: 0.86 });
    const skirt = new THREE.Mesh(skirtGeo, skirtMat);
    skirt.position.y = 0.04;
    const coast = new THREE.Mesh(coastGeo, coastMat);
    coast.position.y = 0.22;
    const top = new THREE.Mesh(topGeo, landMat);
    top.position.y = 0.46;
    const shade = new THREE.Mesh(shadeGeo, shadeMat);
    shade.position.y = 0.012;
    shade.userData = { kind: "island", islandId: island.id };
    group.add(shade, skirt, coast, top);
    tag(skirt, island.id);
    tag(coast, island.id);
    tag(top, island.id);

    const glowMat = new THREE.MeshBasicMaterial({
      color: island.accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.02;
    group.add(glow);

    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: island.accent,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.5;
    ring.visible = false;
    group.add(ring);

    const pinEl = document.createElement("div");
    pinEl.className = "pin";
    pinEl.innerHTML = `<b>${island.no}</b><em></em>`;
    pinEl.querySelector("b").style.setProperty("--c", island.accent);
    pinEl.querySelector("em").textContent = island.pin;
    const pin = new CSS2DObject(pinEl);
    pin.position.set(0, 1.25, 0);
    group.add(pin);

    const buildings = island.items.map((item, index) => {
      const spots = [
        [-0.58, 0.22],
        [0.56, 0.26],
        [-0.22, 0.64],
        [0.32, 0.6],
        [0.02, -0.35],
      ];
      const [sx, sz] = spots[index] ?? spots[index % spots.length];
      return house(group, item, sx, sz, index, island);
    });

    tree(group, 0.92, -0.15, island.id === "dengue" ? "#c4a24a" : "#3e6a3c");
    tree(group, -0.96, 0.05, "#4e7a48");
    addKit(group, island, lamps, box);
    group.traverse((child) => {
      if (!child.isMesh) return;
      if (!child.userData.kind) child.userData = { kind: "island", islandId: island.id };
      if (child.userData.kind === "island" && !pickables.includes(child)) pickables.push(child);
    });

    const hay = [island.name, island.pin, island.blurb, island.source, ...island.items.flatMap((item) => [item.name, item.text, ...(item.keywords ?? [])])].join(" ");
    for (const item of island.items) item._hay = [item.name, item.text, ...(item.keywords ?? [])].join(" ");

    views.set(island.id, {
      island,
      group,
      top,
      coast,
      coastMat,
      landMat,
      skirtMat,
      glow,
      shade,
      ring,
      pinEl,
      buildings,
      lit: true,
      hover: 0,
      base: new THREE.Vector3(x, 0.4, z),
      hay,
    });
  }

  const flowViews = data.flows.map((flow) => {
    const a = views.get(flow.a).base;
    const b = views.get(flow.b).base;
    const start = new THREE.Vector3(a.x, 0.78, a.z);
    const end = new THREE.Vector3(b.x, 0.78, b.z);
    const dir = end.clone().sub(start);
    dir.y = 0;
    const len = Math.max(0.001, dir.length());
    dir.multiplyScalar(1 / len);
    start.addScaledVector(dir, 1.05);
    end.addScaledVector(dir, -1.05);
    const mid = start.clone().lerp(end, 0.5);
    const bend = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((data.flows.indexOf(flow) % 2 === 0 ? 1 : -1) * Math.min(0.7, len * 0.12));
    mid.add(bend);
    mid.y += 1.05 + len * 0.2;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const accent = new THREE.Color(views.get(flow.a).island.accent);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.55,
      roughness: 0.32,
    });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.055, 8, false), ribbonMat);
    const halo = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 36, 0.12, 8, false),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.34, depthWrite: false }),
    );
    const arrow = new THREE.Group();
    const endTangent = new THREE.Vector3();
    curve.getTangent(1, endTangent);
    endTangent.y = 0;
    arrow.position.copy(end);
    if (endTangent.lengthSq() > 1e-8) arrow.rotation.y = Math.atan2(-endTangent.x, -endTangent.z);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), ribbonMat);
    tip.rotation.x = -Math.PI / 2;
    arrow.add(tip);
    tube.add(halo, arrow);
    tube.visible = false;
    tube.userData.kind = "flow-tube";
    scene.add(tube);
    flow._hay = [flow.title, flow.text, flow.carried, flow._alias, views.get(flow.a).island.name, views.get(flow.b).island.name].join(" ");
    return { flow, curve, tube, len };
  });

  const meepleGeo = {
    body: new THREE.ConeGeometry(0.15, 0.38, 8),
    head: new THREE.SphereGeometry(0.1, 14, 12),
    nose: new THREE.SphereGeometry(0.028, 8, 8),
    pack: new THREE.BoxGeometry(0.1, 0.09, 0.045),
    crate: new THREE.BoxGeometry(0.11, 0.09, 0.09),
  };
  const vestMat = new THREE.MeshStandardMaterial({ color: "#14756f", roughness: 0.72 });
  const packMat = new THREE.MeshStandardMaterial({ color: "#f3efe4", roughness: 0.8 });
  const crateMat = new THREE.MeshStandardMaterial({ color: "#e39a3a", roughness: 0.7 });
  const skinMats = ["#f0c7a4", "#d9a57a", "#c48a6a", "#8d5a3c"].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.68 }));
  const TOOL_KEY = { clean: "toolClean", check: "toolCheck", shield: "toolShield", wash: "toolWash", finish: "toolFinish" };

  const walkers = flowViews.map((route, index) => {
    const mesh = new THREE.Group();
    const skin = skinMats[index % skinMats.length];
    const body = new THREE.Mesh(meepleGeo.body, vestMat);
    body.position.y = 0.2;
    body.castShadow = true;
    const head = new THREE.Mesh(meepleGeo.head, skin);
    head.position.y = 0.44;
    head.name = "head";
    const nose = new THREE.Mesh(meepleGeo.nose, skin);
    nose.position.set(0, 0.43, -0.085);
    nose.name = "nose";
    const pack = new THREE.Mesh(meepleGeo.pack, packMat);
    pack.position.set(0, 0.28, 0.09);
    const crate = new THREE.Mesh(meepleGeo.crate, crateMat);
    crate.position.set(0.11, 0.32, -0.02);
    crate.name = "crate";
    mesh.add(body, head, nose, pack, crate);
    mesh.visible = false;
    scene.add(mesh);
    return {
      mesh,
      nose,
      head,
      crate,
      route,
      flow: route.flow,
      t: (index * 0.37) % 1,
      sign: index % 2 === 0 ? 1 : -1,
      duration: 14 + route.len * 1.6,
      phase: index,
    };
  });

  let minutes = 8 * 60 + 20;
  let phase = "all";
  let pillarSet = new Set();
  let query = "";
  let showAllFlows = false;
  let namesOn = false;
  let cargoOn = true;
  let frozen = false;
  let bird = false;
  let hoverId = null;
  let hotItem = null;
  let selected = new Set();
  let elapsed = 0;
  const threats = [];
  const crews = [];
  const crewMarks = [];
  const handoffPops = [];
  const handoffAt = new Map();

  function poseThreat(threat) {
    threat.mesh.position.lerpVectors(threat.home, threat.halt, threat.u);
    threat.mesh.position.y = threat.hover + Math.sin(elapsed * 1.15 + threat.phase) * 0.06;
    _threatDir.subVectors(threat.halt, threat.home);
    _threatDir.y = 0;
    if (_threatDir.lengthSq() > 1e-8) threat.mesh.rotation.y = Math.atan2(-_threatDir.x, -_threatDir.z);
    threat.mesh.updateWorldMatrix(true, true);
  }

  function poseCrew(crew, from, to, alpha) {
    crew.mesh.position.lerpVectors(from, to, alpha);
    crew.mesh.position.y = from.y + Math.abs(Math.sin(elapsed * 11 + crew.spread * 5)) * 0.035;
    _crewDir.subVectors(to, from);
    _crewDir.y = 0;
    if (_crewDir.lengthSq() > 1e-8) crew.mesh.rotation.y = Math.atan2(-_crewDir.x, -_crewDir.z);
    crew.mesh.updateWorldMatrix(true, true);
  }

  function faceThreat(crew) {
    crew.mesh.getWorldPosition(_crewAt);
    _crewFace.subVectors(crew.threat.mesh.position, _crewAt);
    _crewFace.y = 0;
    if (_crewFace.lengthSq() > 1e-8) crew.mesh.rotation.y = Math.atan2(-_crewFace.x, -_crewFace.z);
    crew.mesh.updateWorldMatrix(true, true);
  }

  function makeDrops(count, color) {
    const positions = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color,
      size: 0.055,
      transparent: true,
      depthWrite: false,
    }));
    pts.visible = false;
    pts.frustumCulled = false;
    return pts;
  }

  function writeDrops(points, count, rise, y0, y1) {
    const arr = points.geometry.attributes.position.array;
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = Math.sin(i * 1.7) * 0.14;
      arr[i * 3 + 1] = y0 + (y1 - y0) * rise + (i % 4) * 0.02;
      arr[i * 3 + 2] = Math.cos(i * 1.1) * 0.1 - 0.04;
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.visible = true;
  }

  function playDefense(crew) {
    const threat = crew.threat;
    const tool = threat.tool;
    crew.fx.visible = true;
    if (tool === "shield") {
      if (crew.t > 0.25 && threat.dir > 0) {
        threat.dir = -1;
        threat.slow = 0.35;
      }
      if (crew.t >= 0.9) crew.actDone = true;
      return;
    }
    if (tool === "clean") {
      const bucket = crew.fx.getObjectByName("bucket");
      const k = Math.min(1, crew.t / 0.6);
      if (bucket) bucket.rotation.z = -1.35 * k;
      const drops = crew.fx.getObjectByName("drops");
      if (drops) writeDrops(drops, 20, k, 0.42, -0.15);
      if (crew.t >= 0.6) {
        if (!crew.applied) {
          crew.applied = true;
          threat.rate *= 0.6;
          threat.cleans += 1;
          if (threat.cleans >= 3) threat.fading = true;
        }
        crew.actDone = true;
      }
      return;
    }
    if (tool === "wash") {
      const bubbles = crew.fx.getObjectByName("bubbles");
      const k = Math.min(1, crew.t / 0.8);
      if (bubbles) writeDrops(bubbles, 12, k, 0.5, 0.95);
      if (crew.t >= 0.8) {
        if (!crew.applied) {
          crew.applied = true;
          if (threat.dir > 0) threat.dir = -1;
        }
        crew.actDone = true;
      }
      return;
    }
    if (tool === "finish") {
      const cells = crew.fx.children;
      for (let i = 0; i < cells.length; i += 1) {
        cells[i].material.emissiveIntensity = crew.t >= i * 0.15 ? 0.85 : 0;
      }
      if (crew.t >= 1.05) {
        if (!crew.applied) {
          crew.applied = true;
          threat.fading = true;
        }
        crew.actDone = true;
      }
      return;
    }
    if (tool === "check") {
      if (crew.gate) crew.gate.visible = true;
      threat.hold = true;
      if (crew.t >= 0.4) crew.actDone = true;
    }
  }

  function stepCrew(crew, step) {
    const threat = crew.threat;
    if (threat.gone) {
      crew.mesh.visible = false;
      crew.labelAnchor.visible = false;
      crew.fx.visible = false;
      return;
    }
    if (crew.phase === "wait") {
      crew.mesh.visible = false;
      crew.labelAnchor.visible = false;
      crew.fx.visible = false;
      if (elapsed > 0.7 && threat.dir > 0 && threat.u > 0.5) {
        crew.phase = "run";
        crew.t = 0;
        crew.mesh.visible = true;
        crew.labelAnchor.visible = true;
      }
      return;
    }
    crew.mesh.visible = true;
    crew.labelAnchor.visible = true;
    crew.t += step;
    if (crew.phase === "run") {
      const alpha = Math.min(1, crew.t / 0.62);
      poseCrew(crew, crew.home, crew.post, alpha);
      if (crew.t >= 0.62) {
        crew.phase = "act";
        crew.t = 0;
        crew.actDone = false;
        crew.applied = false;
      }
      return;
    }
    if (crew.phase === "act") {
      crew.mesh.position.copy(crew.post);
      faceThreat(crew);
      playDefense(crew);
      if (crew.actDone) {
        crew.phase = "back";
        crew.t = 0;
        if (threat.tool !== "check") crew.fx.visible = false;
      }
      return;
    }
    if (crew.phase === "back") {
      const alpha = Math.min(1, crew.t / 0.7);
      poseCrew(crew, crew.post, crew.home, alpha);
      if (crew.t >= 0.7) {
        crew.phase = "wait";
        crew.t = 0;
        crew.mesh.visible = false;
        crew.labelAnchor.visible = false;
        crew.fx.visible = false;
        crew.mesh.position.copy(crew.home);
      }
    }
  }

  function makeCrew(threat, view, spread) {
    _crewDir.subVectors(threat.halt, view.base);
    _crewDir.y = 0;
    _crewDir.normalize();
    const sideX = -_crewDir.z;
    const sideZ = _crewDir.x;
    const home = new THREE.Vector3(
      _crewDir.x * 0.42 + sideX * spread * 0.45,
      0.62,
      _crewDir.z * 0.42 + sideZ * spread * 0.45,
    );
    const post = new THREE.Vector3(
      _crewDir.x * 1.28 + sideX * spread,
      0.62,
      _crewDir.z * 1.28 + sideZ * spread,
    );
    const mesh = new THREE.Group();
    mesh.scale.setScalar(1.4);
    mesh.visible = false;
    mesh.userData = { kind: "crew" };
    const skin = skinMats[crews.length % skinMats.length];
    const body = new THREE.Mesh(meepleGeo.body, vestMat);
    body.position.y = 0.2;
    body.castShadow = true;
    const head = new THREE.Mesh(meepleGeo.head, skin);
    head.position.y = 0.44;
    head.name = "head";
    const nose = new THREE.Mesh(meepleGeo.nose, skin);
    nose.position.set(0, 0.43, -0.085);
    nose.name = "nose";
    const fx = new THREE.Group();
    fx.visible = false;
    if (threat.tool === "shield") {
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 24, 16),
        new THREE.MeshBasicMaterial({ color: "#e1992d", transparent: true, opacity: 0.35, depthWrite: false }),
      );
      bubble.position.y = 0.35;
      fx.add(bubble);
    } else if (threat.tool === "clean") {
      const bucket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.06, 0.12, 8),
        new THREE.MeshStandardMaterial({ color: "#d7e4ea", roughness: 0.55 }),
      );
      bucket.position.set(0.12, 0.32, -0.02);
      bucket.name = "bucket";
      const drops = makeDrops(20, "#b7d7ea");
      drops.name = "drops";
      fx.add(bucket, drops);
    } else if (threat.tool === "wash") {
      const bubbles = makeDrops(12, "#ffffff");
      bubbles.name = "bubbles";
      fx.add(bubbles);
    } else if (threat.tool === "finish") {
      for (let i = 0; i < 7; i += 1) {
        const cell = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, 0.03, 0.03),
          new THREE.MeshStandardMaterial({ color: "#f4f0e6", roughness: 0.5, emissive: "#f2d48a", emissiveIntensity: 0 }),
        );
        cell.position.set((i - 3) * 0.05, 0.36, -0.06);
        fx.add(cell);
      }
    }
    const labelEl = document.createElement("div");
    labelEl.className = "crew-label";
    labelEl.textContent = t(TOOL_KEY[threat.tool]);
    const label = new CSS2DObject(labelEl);
    const labelAnchor = new THREE.Object3D();
    labelAnchor.position.set(_crewDir.x * 1.9 + sideX * spread, 1.15, _crewDir.z * 1.9 + sideZ * spread);
    labelAnchor.add(label);
    labelAnchor.visible = false;
    mesh.add(body, head, nose);
    mesh.position.copy(home);
    fx.position.copy(post);
    view.group.add(mesh, labelAnchor, fx);
    let gate = null;
    if (threat.tool === "check") {
      gate = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.9),
        new THREE.MeshBasicMaterial({ color: "#0e8a80", transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
      );
      gate.position.set(threat.halt.x, 0.7, threat.halt.z);
      const towardHome = new THREE.Vector3(threat.home.x - threat.halt.x, 0, threat.home.z - threat.halt.z);
      gate.rotation.y = Math.atan2(towardHome.x, towardHome.z);
      gate.visible = false;
      scene.add(gate);
    }
    crewMarks.push({ el: labelEl, key: TOOL_KEY[threat.tool] });
    return {
      mesh,
      nose,
      head,
      fx,
      gate,
      labelAnchor,
      home,
      post,
      spread,
      threat,
      phase: "wait",
      t: 0,
      actDone: false,
      applied: false,
    };
  }

  function placeCrews() {
    const groups = new Map();
    for (const threat of threats) {
      const list = groups.get(threat.islandId) ?? [];
      list.push(threat);
      groups.set(threat.islandId, list);
    }
    for (const [islandId, list] of groups) {
      const view = views.get(islandId);
      list.forEach((threat, index) => {
        const spread = (index - (list.length - 1) / 2) * 0.42;
        crews.push(makeCrew(threat, view, spread));
      });
    }
  }

  function markFront(group, mat) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), mat);
    head.name = "head";
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), mat);
    nose.name = "nose";
    nose.position.set(0, 0, -0.36);
    group.add(head, nose);
    return { head, nose };
  }

  function addThreat(mesh, head, nose, home, halt, rate, scale, tool, islandId) {
    mesh.userData = { kind: "threat" };
    mesh.scale.setScalar(scale);
    scene.add(mesh);
    const threat = {
      mesh,
      head,
      nose,
      home,
      halt,
      u: 0.46 + (threats.length % 5) * 0.03,
      floor: 0.28,
      limit: 0.7,
      dir: 1,
      rate,
      phase: threats.length * 0.9,
      hover: 0.78,
      scale0: scale,
      tool,
      islandId,
    };
    const mats = [];
    mesh.traverse((child) => {
      if (!child.isMesh || !child.material || mats.includes(child.material)) return;
      mats.push(child.material);
    });
    threat.mats = mats;
    threat.slow = 1;
    threat.hold = false;
    threat.holdAt = 0.86;
    threat.fading = false;
    threat.fadeT = 0;
    threat.gone = false;
    threat.cleans = 0;
    threats.push(threat);
    poseThreat(threat);
  }

  function setThreatOpacity(threat, opacity) {
    threat.mesh.visible = opacity > 0.02;
    for (const mat of threat.mats) {
      mat.transparent = opacity < 0.99;
      mat.opacity = opacity;
      mat.depthWrite = opacity > 0.85;
    }
  }

  function makeVirus(color) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      flatShading: true,
      emissive: color,
      emissiveIntensity: 0,
    });
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), bodyMat));
    const spikeGeo = new THREE.ConeGeometry(0.035, 0.09, 5);
    const spikeMat = new THREE.MeshStandardMaterial({ color: "#ffd0a8", roughness: 0.6, emissiveIntensity: 0 });
    const spikes = new THREE.InstancedMesh(spikeGeo, spikeMat, 12);
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 12; i += 1) {
      const y = 1 - (i / 11) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const ang = i * 2.399;
      const d = new THREE.Vector3(Math.cos(ang) * ring, y, Math.sin(ang) * ring).normalize();
      dummy.position.copy(d).multiplyScalar(0.2);
      dummy.quaternion.setFromUnitVectors(up, d);
      dummy.updateMatrix();
      spikes.setMatrixAt(i, dummy.matrix);
    }
    spikes.instanceMatrix.needsUpdate = true;
    group.add(spikes);
    return { group, ...markFront(group, bodyMat) };
  }

  function makeRod() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: "#8ed15a", roughness: 0.55, emissive: "#3f6e24", emissiveIntensity: 0 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.32, 4, 12), mat);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    const tailMat = new THREE.MeshStandardMaterial({ color: "#e7f0cf", roughness: 0.45 });
    for (let i = 0; i < 4; i += 1) {
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.26, 4), tailMat);
      tail.rotation.x = Math.PI / 2;
      tail.position.set((i - 1.5) * 0.028, -0.015, 0.3);
      tail.rotation.z = (i - 1.5) * 0.35;
      group.add(tail);
    }
    return { group, ...markFront(group, mat) };
  }

  function makeMosquito() {
    const group = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: "#2a2630", roughness: 0.62 });
    const pale = new THREE.MeshStandardMaterial({ color: "#f2ede2", roughness: 0.55 });
    for (let i = 0; i < 5; i += 1) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.05 - i * 0.005, 8, 6), i % 2 ? pale : dark);
      seg.scale.set(1, 0.7, 1.2);
      seg.position.z = 0.02 + i * 0.07;
      group.add(seg);
    }
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), dark);
    thorax.position.z = -0.07;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), dark);
    head.position.z = -0.16;
    const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 5), dark);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.012, -0.28);
    const wingMat = new THREE.MeshStandardMaterial({
      color: "#dff3ff",
      transparent: true,
      opacity: 0.35,
      roughness: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.11), wingMat);
    wingL.position.set(-0.16, 0.07, -0.02);
    wingL.rotation.z = 0.4;
    wingL.rotation.y = 0.25;
    const wingR = wingL.clone();
    wingR.position.x = 0.16;
    wingR.rotation.z = -0.4;
    wingR.rotation.y = -0.25;
    const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        const leg = new THREE.Mesh(legGeo, dark);
        leg.position.set(side * 0.07, -0.05, -0.08 + i * 0.06);
        leg.rotation.z = side * 1.05;
        leg.rotation.x = -0.35 + i * 0.28;
        group.add(leg);
      }
    }
    group.add(thorax, head, beak, wingL, wingR);
    const marks = markFront(group, dark);
    marks.nose.position.set(0, -0.01, -0.4);
    return { group, ...marks };
  }

  {
    const isle = waterMat.uniforms.isle.value;
    let isleIndex = 0;
    let span = 0;
    for (const view of views.values()) {
      isle[isleIndex++].set(view.base.x, view.base.z);
      span = Math.max(span, Math.hypot(view.base.x, view.base.z));
    }
    const ringR = span + 4;
    const gap = 2.7;
    function approach(index, focus) {
      const ang = (index * 72 + 18) * Math.PI / 180;
      const home = new THREE.Vector3(Math.cos(ang) * ringR, 0, Math.sin(ang) * ringR);
      const awayX = home.x - focus.x;
      const awayZ = home.z - focus.z;
      const len = Math.hypot(awayX, awayZ) || 1;
      const halt = new THREE.Vector3(focus.x + (awayX / len) * gap, 0, focus.z + (awayZ / len) * gap);
      return { home, halt };
    }
    const roster = [
      { make: () => makeMosquito(), id: "dengue", tool: "clean", rate: 0.046 },
      { make: () => makeMosquito(), id: "border", tool: "check", rate: 0.04 },
      { make: () => makeVirus("#d2694a"), id: "flu", tool: "shield", rate: 0.038 },
      { make: () => makeVirus("#5aa86a"), id: "entero", tool: "wash", rate: 0.04 },
      { make: () => makeRod(), id: "tb", tool: "finish", rate: 0.034 },
    ];
    roster.forEach((spec, index) => {
      const built = spec.make();
      const raid = approach(index, views.get(spec.id).base);
      addThreat(built.group, built.head, built.nose, raid.home, raid.halt, spec.rate, 1.2, spec.tool, spec.id);
    });
    placeCrews();
  }

  let pickCb = () => {};
  let arriveCb = () => {};

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const view of views.values()) {
    minX = Math.min(minX, view.base.x);
    maxX = Math.max(maxX, view.base.x);
    minZ = Math.min(minZ, view.base.z);
    maxZ = Math.max(maxZ, view.base.z);
  }
  // The island group is a tall, narrow chain. Fitting its circumcircle
  // left the pin row under 300px on a 390-wide screen, so the distance
  // uses the horizontal and vertical half-extents separately.
  const overviewTarget = new THREE.Vector3((minX + maxX) / 2, 0.25, (minZ + maxZ) / 2);
  const overviewHalf = {
    x: (maxX - minX) / 2 + 0.95,
    z: (maxZ - minZ) / 2 + 2.05,
  };
  function viewSize() {
    return {
      W: canvas.clientWidth || window.innerWidth || 1,
      H: canvas.clientHeight || window.innerHeight || 1,
    };
  }
  const opening = viewSize();
  const safeGoal = { top: 48, right: opening.W - 16, bottom: opening.H - 48, left: 16 };
  let safeNow = { ...safeGoal };
  let safeFrom = { ...safeGoal };
  let safeT = 1;
  let focusHalf = null;
  let zoomed = false;
  let overviewRadius = 28;
  let maxR = Math.max(48, overviewRadius * 1.25);
  const cam = { theta: 0.18, phi: 1.02, radius: overviewRadius, target: overviewTarget.clone() };
  const goal = { theta: cam.theta, radius: overviewRadius };
  let userPhi = cam.phi;
  const goalTarget = overviewTarget.clone();

  // Positive setViewOffset y lifts the frame: offsetY = H/2 - safeCenterY.
  // A safe rect in the upper half (UI along the bottom) therefore uses a positive y.
  function applyViewOffset() {
    const { W, H } = viewSize();
    const cx = (safeNow.left + safeNow.right) / 2;
    const cy = (safeNow.top + safeNow.bottom) / 2;
    camera.aspect = W / H;
    camera.setViewOffset(W, H, -(cx - W / 2), -(cy - H / 2), W, H);
  }

  function fitDistance(halfX, halfZ) {
    const { W, H } = viewSize();
    const fw = Math.max(0.18, (safeNow.right - safeNow.left) / Math.max(1, W));
    const fh = Math.max(0.18, (safeNow.bottom - safeNow.top) / Math.max(1, H));
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * (W / Math.max(1, H)));
    const dH = Math.max(0.4, halfX) / Math.tan(hHalf) / fw;
    const dV = Math.max(0.4, halfZ) / Math.tan(vHalf) / fh * 0.62;
    return Math.max(dV, dH) * 1.06;
  }

  function applyFit() {
    overviewRadius = fitDistance(overviewHalf.x, overviewHalf.z);
    maxR = Math.max(48, overviewRadius * 1.25);
    if (!zoomed) {
      if (bird) goal.radius = Math.min(maxR, overviewRadius + 8);
      else if (!focusHalf) goal.radius = overviewRadius;
      else goal.radius = Math.min(maxR, fitDistance(focusHalf.x, focusHalf.z));
    }
    applyViewOffset();
  }

  function frameWide() {
    focusHalf = null;
    zoomed = false;
    goalTarget.copy(overviewTarget);
    applyFit();
  }

  function easeSafe(step) {
    if (safeT >= 1) return;
    safeT = Math.min(1, safeT + step / 0.4);
    const e = 1 - (1 - safeT) ** 2;
    safeNow.top = safeFrom.top + (safeGoal.top - safeFrom.top) * e;
    safeNow.right = safeFrom.right + (safeGoal.right - safeFrom.right) * e;
    safeNow.bottom = safeFrom.bottom + (safeGoal.bottom - safeFrom.bottom) * e;
    safeNow.left = safeFrom.left + (safeGoal.left - safeFrom.left) * e;
    applyFit();
  }

  function setSafeRect(rect) {
    const { W, H } = viewSize();
    const next = {
      top: Number(rect.top) || 0,
      right: Number(rect.right) || W,
      bottom: Number(rect.bottom) || H,
      left: Number(rect.left) || 0,
    };
    if (next.bottom - next.top < 120 || next.right - next.left < 80) {
      next.top = 48;
      next.bottom = Math.max(168, H - 48);
      next.left = 16;
      next.right = Math.max(96, W - 16);
    }
    const changed = ["top", "right", "bottom", "left"].some((key) => Math.abs(next[key] - safeGoal[key]) > 0.5);
    if (!changed) return;
    safeFrom = { ...safeNow };
    safeGoal.top = next.top;
    safeGoal.right = next.right;
    safeGoal.bottom = next.bottom;
    safeGoal.left = next.left;
    safeT = 0;
  }

  const pointers = new Map();
  let dragged = 0;

  function placeCamera() {
    const sp = Math.sin(cam.phi);
    camera.position.set(
      cam.target.x + cam.radius * sp * Math.sin(cam.theta),
      cam.target.y + cam.radius * Math.cos(cam.phi),
      cam.target.z + cam.radius * sp * Math.cos(cam.theta),
    );
    camera.lookAt(cam.target);
    camera.updateMatrixWorld();
  }

  function phaseOk(id) {
    return phase === "all" || id === phase;
  }

  function pillarOk(island) {
    if (!pillarSet.size) return true;
    return island.pillars.some((id) => pillarSet.has(id));
  }

  function queryKind(view) {
    if (!query) return "all";
    if (norm(view.hay).includes(query)) return "island";
    if (view.island.items.some((item) => norm(item._hay).includes(query))) return "item";
    if (data.flows.some((flow) => (flow.a === view.island.id || flow.b === view.island.id) && norm(flow._hay).includes(query))) return "flow";
    return null;
  }

  function refresh() {
    for (const view of views.values()) {
      const kind = queryKind(view);
      const on = Boolean(kind) && pillarOk(view.island) && (phase === "all" || view.island.items.some((item) => phaseOk(item.phase)));
      view.lit = on;
      for (const mat of [view.coastMat, view.landMat, view.skirtMat]) {
        mat.opacity = on ? 1 : 0.14;
        mat.transparent = !on;
        mat.depthWrite = on;
      }
      for (const building of view.buildings) {
        const itemHit = !query || kind !== "item" || norm(building.item._hay).includes(query);
        building.group.visible = Boolean(on && phaseOk(building.item.phase) && itemHit);
      }
      view.ring.visible = Boolean(selected.has(view.island.id));
      view.group.traverse((child) => {
        if (!child.isMesh || child.userData.kind !== "island") return;
        if (child === view.top || child === view.coast || child === view.glow || child === view.ring) return;
        child.visible = on;
      });
      view.pinEl.classList.toggle("dim", !on);
      view.pinEl.classList.toggle("hot", hoverId === view.island.id || selected.has(view.island.id));
      view.pinEl.classList.toggle("named", namesOn || hoverId === view.island.id || selected.has(view.island.id));
    }
    for (const route of flowViews) {
      const forced = Boolean(query) && norm(route.flow._hay).includes(query);
      const touched = [...selected].some((id) => id === route.flow.a || id === route.flow.b);
      const ends = Boolean(views.get(route.flow.a).lit && views.get(route.flow.b).lit);
      route.tube.visible = Boolean(ends && (showAllFlows || touched || forced));
    }
  }

  function poseWalker(walker) {
    walker.route.curve.getPoint(walker.t, walker.mesh.position);
    walker.route.curve.getTangent(walker.t, _tangent);
    _tangent.multiplyScalar(walker.sign);
    if (_tangent.lengthSq() > 1e-8) walker.mesh.rotation.y = Math.atan2(-_tangent.x, -_tangent.z);
    walker.mesh.updateWorldMatrix(true, true);
  }

  function applyClock() {
    const hour = minutes / 60;
    const night = nightAmount(hour);
    const look = lookAtHour(hour);
    skyMat.uniforms.top.value.copy(look.top);
    skyMat.uniforms.horizon.value.copy(look.hor);
    skyMat.uniforms.bottom.value.copy(look.bot);
    scene.background.copy(look.hor);
    scene.fog.color.copy(look.hor);
    scene.fog.near = 34 + (1 - look.stars) * 18;
    scene.fog.far = 96 + (1 - look.stars) * 28;
    renderer.toneMappingExposure = look.exposure;
    hemi.color.copy(look.hemi);
    hemi.groundColor.copy(look.ground);
    hemi.intensity = look.hemiI;
    fill.color.copy(look.fill);
    fill.intensity = 0.18 + look.stars * 0.22;
    waterDeep.copy(look.water);
    waterCrest.copy(look.water);
    if (look.stars < 0.5) {
      waterDeep.offsetHSL(0.02, 0.12, -0.07);
      waterCrest.offsetHSL(-0.05, 0.02, 0.16);
    } else {
      waterCrest.offsetHSL(-0.02, -0.02, 0.045);
    }
    waterMat.uniforms.deepColor.value.copy(waterDeep);
    waterMat.uniforms.crestColor.value.copy(waterCrest);
    waterMat.uniforms.sunColor.value.copy(skyMat.uniforms.sunColor.value);
    waterMat.uniforms.sunAmt.value = skyMat.uniforms.sunAmt.value;
    waterMat.uniforms.stars.value = look.stars;
    const ang = ((hour - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    const nightSky = look.stars > 0.5;
    skySunDir.set(
      (nightSky ? -1 : 1) * Math.cos(ang),
      nightSky ? 0.62 : Math.max(elev, 0.06),
      nightSky ? -0.45 : 0.32,
    ).normalize();
    skyMat.uniforms.sunColor.value.set(nightSky ? "#d5e4ff" : "#ffe6bf");
    skyMat.uniforms.sunAmt.value = nightSky ? 0.9 : THREE.MathUtils.clamp(elev + 0.55, 0.35, 1);
    sun.position.set(Math.cos(ang) * 26, Math.max(elev, 0.08) * 24 + 2, 9);
    const dayLit = 1 - look.stars;
    sun.intensity = 0.05 + dayLit * (0.45 + Math.max(elev, 0) * 1.15);
    sun.color.copy(look.sun);
    stars.material.opacity = look.stars * 0.9;
    for (const lamp of lamps) lamp.emissiveIntensity = 0.08 + night * 1.7;
    for (const view of views.values()) {
      const active = view.buildings.some((building) => building.group.visible && hourCovers(building.item.hours, hour));
      view.glow.material.opacity = active ? 0.28 + (1 - night) * 0.12 : 0;
      for (const building of view.buildings) {
        const awake = hourCovers(building.item.hours, hour);
        building.winMat.emissiveIntensity = awake ? 0.04 + night * 1.7 : night * 0.12;
      }
    }
  }

  function resize() {
    const { W, H } = viewSize();
    if (W < 2 || H < 2) return;
    renderer.setSize(W, H, false);
    labels.setSize(W, H);
    applyFit();
  }

  function tick(dt) {
    const step = Math.min(dt, 0.05);
    easeSafe(step);
    if (!frozen) elapsed += step;
    const hoverK = 1 - Math.exp(-step * 8);
    for (const view of views.values()) {
      const delay = view.island.row * 0.055;
      const risen = reduced ? 1 : THREE.MathUtils.clamp((elapsed - delay) / 0.75, 0, 1);
      const ease = 1 - (1 - risen) ** 3;
      const want = hoverId === view.island.id || selected.has(view.island.id) ? 1 : 0;
      view.hover += (want - view.hover) * hoverK;
      view.group.position.y = -1.25 * (1 - ease) + view.hover * 0.1;
      for (const building of view.buildings) {
        const hot = building.item.id === hotItem ? 1.12 : 1;
        building.group.scale.setScalar(hot);
      }
    }
    if (!frozen && !reduced) {
      const arr = waterGeo.attributes.position.array;
      const time = elapsed;
      for (let i = 0; i < arr.length; i += 3) {
        const x = waterBase[i];
        const z = waterBase[i + 2];
        arr[i + 1] = Math.sin(x * 0.05 + time * 0.16) * 0.1
          + Math.sin(z * 0.035 - time * 0.11) * 0.055
          + Math.sin(x * 0.22 + z * 0.08 + time * 0.38) * 0.04
          + Math.cos(z * 0.18 + time * 0.3) * 0.028
          + Math.sin(x * 0.72 + time * 0.9) * 0.016;
      }
      waterGeo.attributes.position.needsUpdate = true;
      waterGeo.computeVertexNormals();
      waterMat.uniforms.uTime.value = time;
    }
    if (!frozen && !reduced) {
      for (const threat of threats) {
        if (threat.fading && !threat.gone) {
          threat.fadeT += step;
          const k = Math.min(1, threat.fadeT / 0.8);
          setThreatOpacity(threat, (1 - k) ** 3);
          if (k >= 1) threat.gone = true;
        }
        if (!threat.gone) {
          const speed = threat.rate * threat.slow;
          if (threat.hold && threat.dir >= 0 && threat.u >= threat.holdAt) {
            threat.u = threat.holdAt;
            threat.dir = 0;
          } else if (threat.dir !== 0) {
            threat.u += step * speed * threat.dir;
            if (threat.u >= threat.limit) {
              threat.u = threat.limit;
              threat.dir = -1;
            } else if (threat.u <= threat.floor) {
              threat.u = threat.floor;
              threat.dir = threat.fading ? 0 : 1;
            }
          }
        }
        poseThreat(threat);
      }
      for (const crew of crews) stepCrew(crew, step);
    }
    const phiGoal = bird ? 0.58 : userPhi;
    const k = 1 - Math.exp(-step * (reduced ? 28 : 3.4));
    if (pointers.size) {
      cam.theta = goal.theta;
      cam.phi = phiGoal;
      cam.radius = goal.radius;
    } else {
      cam.theta += wrapAngle(goal.theta - cam.theta) * k;
      cam.phi += (phiGoal - cam.phi) * k;
      cam.radius += (goal.radius - cam.radius) * k;
    }
    cam.target.lerp(goalTarget, pointers.size ? 1 : k);
    placeCamera();
    const routesOn = elapsed > 1.15 || reduced;
    for (const walker of walkers) {
      const show = Boolean(routesOn && walker.route.tube.visible === true);
      walker.mesh.visible = show;
      walker.crate.visible = Boolean(cargoOn);
      if (!show || frozen || reduced) continue;
      walker.t += (step / walker.duration) * walker.sign;
      if (walker.t >= 1) {
        walker.t = 1;
        walker.sign = -1;
        flashHandoff(walker.flow.b, walker.flow.carried);
        arriveCb({ flow: walker.flow, from: walker.flow.a, to: walker.flow.b, carried: walker.flow.carried });
      } else if (walker.t <= 0) {
        walker.t = 0;
        walker.sign = 1;
        flashHandoff(walker.flow.a, walker.flow.carried);
        arriveCb({ flow: walker.flow, from: walker.flow.b, to: walker.flow.a, carried: walker.flow.carried });
      }
      poseWalker(walker);
      walker.mesh.position.y += Math.sin(elapsed * 7 + walker.phase) * 0.02;
    }
    stepHandoffs(frozen ? 0 : step);
    applyClock();
    renderer.render(scene, camera);
    labels.render(scene, camera);
    markCrowding();
  }

  function markCrowding() {
    const narrow = viewSize().W <= 980;
    const pins = [];
    for (const view of views.values()) {
      view.pinEl.classList.remove("crowded");
      if (!narrow) continue;
      const mark = view.pinEl.querySelector("b");
      const rect = mark.getBoundingClientRect();
      if (rect.width < 1) continue;
      pins.push({ el: view.pinEl, no: view.island.no, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 });
    }
    pins.sort((a, b) => a.no.localeCompare(b.no));
    for (let i = 0; i < pins.length; i += 1) {
      for (let j = i + 1; j < pins.length; j += 1) {
        if (Math.hypot(pins[i].cx - pins[j].cx, pins[i].cy - pins[j].cy) < 26) pins[j].el.classList.add("crowded");
      }
    }
  }

  function nearestPin(event) {
    let best = null;
    let bestD = 28;
    for (const view of views.values()) {
      if (view.pinEl.classList.contains("crowded")) continue;
      const mark = view.pinEl.querySelector("b");
      const rect = mark.getBoundingClientRect();
      if (rect.width < 1) continue;
      const dist = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
      if (dist <= bestD) {
        bestD = dist;
        best = { kind: "island", islandId: view.island.id };
      }
    }
    return best;
  }

  function flashHandoff(islandId, carried) {
    const view = views.get(islandId);
    if (!view) return;
    const last = handoffAt.get(islandId) ?? -10;
    if (elapsed - last < 1.5) return;
    handoffAt.set(islandId, elapsed);
    view.flashT = 0;
    while (handoffPops.length >= 4) {
      const old = handoffPops.shift();
      old.anchor.removeFromParent();
      old.el.remove();
    }
    const el = document.createElement("div");
    el.className = "handoff-pop";
    el.textContent = `+ ${carried}`;
    const anchor = new THREE.Object3D();
    anchor.position.set(0, 1.4, 0);
    anchor.add(new CSS2DObject(el));
    view.group.add(anchor);
    handoffPops.push({ el, anchor, t: 0 });
  }

  function stepHandoffs(step) {
    for (const view of views.values()) {
      if (view.flashT == null) continue;
      view.flashT += step;
      const k = Math.min(1, view.flashT / 0.4);
      const e = 1 - (1 - k) ** 3;
      view.ring.visible = true;
      view.ring.scale.setScalar(1 + 0.25 * e);
      view.ring.material.opacity = 0.9 * (1 - e);
      if (k >= 1) {
        view.flashT = null;
        view.ring.scale.setScalar(1);
        view.ring.material.opacity = 0.96;
        view.ring.visible = Boolean(selected.has(view.island.id));
      }
    }
    for (let i = handoffPops.length - 1; i >= 0; i -= 1) {
      const pop = handoffPops[i];
      pop.t += step;
      const k = Math.min(1, pop.t / 1.2);
      const eased = 1 - (1 - k) ** 3;
      pop.anchor.position.y = 1.4 + 0.6 * eased;
      const fade = pop.t > 0.9 ? Math.max(0, 1 - (pop.t - 0.9) / 0.3) : 1;
      pop.el.style.opacity = String(fade);
      if (pop.t >= 1.2) {
        pop.anchor.removeFromParent();
        pop.el.remove();
        handoffPops.splice(i, 1);
      }
    }
  }

  function ndc(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  const raycaster = new THREE.Raycaster();

  function hitAt(event) {
    const point = ndc(event);
    raycaster.setFromCamera(point, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    return hits[0]?.object.userData ?? null;
  }

  canvas.addEventListener("pointerdown", (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, d: 0 });
    dragged = 0;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (event) => {
    const prev = pointers.get(event.pointerId);
    if (!prev) {
      const hit = hitAt(event);
      const id = hit?.islandId ?? null;
      if (id !== hoverId) {
        hoverId = id;
        refresh();
      }
      canvas.style.cursor = id ? "pointer" : "grab";
      return;
    }
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    prev.x = event.clientX;
    prev.y = event.clientY;
    prev.d += Math.abs(dx) + Math.abs(dy);
    dragged += Math.abs(dx) + Math.abs(dy);
    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (prev.pinch) {
        goal.radius = THREE.MathUtils.clamp(goal.radius * (prev.pinch / dist), 8, maxR);
        zoomed = true;
      }
      for (const item of pointers.values()) item.pinch = dist;
      return;
    }
    goal.theta -= dx * 0.0052;
    userPhi = THREE.MathUtils.clamp(userPhi - dy * 0.0036, 0.32, 1.22);
    if (bird) bird = false;
  });
  function endPointer(event) {
    const prev = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (!prev || pointers.size) return;
    canvas.style.cursor = hoverId ? "pointer" : "grab";
    if (dragged > 6) return;
    let hit = hitAt(event);
    if (event.pointerType === "touch") {
      // The number sits above the mesh, so a ray through the badge often
      // hits the island in front. A badge within 28px is the one that was tapped.
      const pin = nearestPin(event);
      if (pin) hit = pin;
    }
    pickCb(hit);
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    goal.radius = THREE.MathUtils.clamp(goal.radius * Math.exp(event.deltaY * 0.0011), 8, maxR);
    zoomed = true;
  }, { passive: false });

  function focusIslands(ids) {
    selected = new Set(ids);
    refresh();
    zoomed = false;
    if (!ids.length) {
      frameWide();
      return;
    }
    const center = new THREE.Vector3();
    const bases = [];
    for (const id of ids) {
      const base = views.get(id).base;
      bases.push(base);
      center.add(base);
    }
    center.multiplyScalar(1 / bases.length);
    center.y = 0.35;
    if (bases.length === 1) focusHalf = { x: MESH_R * 2.2, z: MESH_R * 2.2 };
    else {
      let loX = Infinity;
      let hiX = -Infinity;
      let loZ = Infinity;
      let hiZ = -Infinity;
      for (const base of bases) {
        loX = Math.min(loX, base.x);
        hiX = Math.max(hiX, base.x);
        loZ = Math.min(loZ, base.z);
        hiZ = Math.max(hiZ, base.z);
      }
      focusHalf = { x: (hiX - loX) / 2 + MESH_R * 1.3, z: (hiZ - loZ) / 2 + MESH_R * 1.3 };
    }
    goalTarget.copy(center);
    applyFit();
  }

  refresh();
  applyClock();
  resize();
  placeCamera();

  return {
    tick,
    resize,
    setSafeRect,
    setMinutes(value) { minutes = value; },
    relabel() {
      for (const view of views.values()) {
        const island = view.island;
        const nameEl = view.pinEl.querySelector("em");
        if (nameEl) nameEl.textContent = island.pin;
        view.hay = [island.name, island.pin, island.blurb, island.source, ...island.items.flatMap((item) => [item.name, item.text, ...(item.keywords ?? [])])].join(" ");
        for (const item of island.items) item._hay = [item.name, item.text, ...(item.keywords ?? [])].join(" ");
      }
      for (const route of flowViews) {
        const flow = route.flow;
        flow._hay = [flow.title, flow.text, flow.carried, flow._alias, views.get(flow.a).island.name, views.get(flow.b).island.name].join(" ");
      }
      for (const mark of crewMarks) mark.el.textContent = t(mark.key);
      refresh();
    },
    setPhase(value) { phase = value; refresh(); },
    setPillars(value) { pillarSet = value; refresh(); },
    setQuery(value) { query = norm(value); refresh(); },
    focusIslands,
    overview() { focusIslands([]); },
    setShowAllFlows(value) { showAllFlows = value; refresh(); },
    setFreeze(value) { frozen = value; },
    setBird(value) {
      bird = value;
      if (value) {
        frameWide();
        return;
      }
      if (selected.size) focusIslands([...selected]);
      else frameWide();
    },
    isBird() { return bird; },
    setNames(value) { namesOn = value; refresh(); },
    setCargo(value) {
      cargoOn = Boolean(value);
      for (const walker of walkers) walker.crate.visible = cargoOn;
    },
    setHotItem(id) { hotItem = id; },
    onPick(fn) { pickCb = fn; },
    onArrive(fn) { arriveCb = fn; },
    getTheta() { return cam.theta; },
    debugState() {
      return {
        flows: flowViews.filter((route) => route.tube.visible === true).length,
        lit: [...views.values()].filter((view) => view.lit).map((view) => view.island.id),
      };
    },
    selfTest() {
      const errors = [];
      const strictFlows = flowViews.filter((route) => route.tube.visible === true).length;
      let drawnTubes = 0;
      for (const route of flowViews) if (route.tube.visible !== false) drawnTubes += 1;
      if (strictFlows !== drawnTubes) errors.push(`flows ${strictFlows} disagree with drawn tubes ${drawnTubes}`);
      const banned = new Set(["hepa", "amr", "global"]);
      for (const threat of threats) {
        if (banned.has(threat.islandId)) errors.push(`threat still targets ${threat.islandId}`);
      }
      if (threats.length !== 5) errors.push(`expected 5 threats, saw ${threats.length}`);
      const border = views.get("border");
      const dengue = views.get("dengue");
      if (!(border.base.z < dengue.base.z)) errors.push("border island is not north (-z) of dengue");
      const saved = { theta: cam.theta, phi: cam.phi, radius: cam.radius, target: cam.target.clone() };
      const savedSafe = { ...safeNow };
      cam.theta = 0;
      cam.phi = 0.95;
      cam.radius = overviewRadius;
      cam.target.set(0, 0.3, 0);
      camera.clearViewOffset();
      placeCamera();
      const northY = border.base.clone().project(camera).y;
      const southY = dengue.base.clone().project(camera).y;
      if (!(northY > southY)) errors.push(`north is not above south on screen (${northY.toFixed(2)} vs ${southY.toFixed(2)})`);
      const east = new THREE.Vector3(5, 0.4, 0).project(camera);
      if (east.x <= 0.05) errors.push("world +x is not screen-right at theta 0");
      const { W, H } = viewSize();
      const midY = new THREE.Vector3(0, 0.3, 0).project(camera).y;
      safeNow.top = 0;
      safeNow.left = 0;
      safeNow.right = W;
      safeNow.bottom = H * 0.5;
      applyViewOffset();
      const lifted = new THREE.Vector3(0, 0.3, 0).project(camera).y;
      if (!(lifted > midY + 0.02)) errors.push(`upper safe rect did not lift the frame (${midY.toFixed(2)} -> ${lifted.toFixed(2)})`);
      safeNow.top = savedSafe.top;
      safeNow.right = savedSafe.right;
      safeNow.bottom = savedSafe.bottom;
      safeNow.left = savedSafe.left;
      cam.theta = saved.theta;
      cam.phi = saved.phi;
      cam.radius = saved.radius;
      cam.target.copy(saved.target);
      applyViewOffset();
      placeCamera();

      const down = new THREE.Raycaster(new THREE.Vector3(border.base.x, 12, border.base.z), new THREE.Vector3(0, -1, 0));
      const topHit = down.intersectObject(border.top, false)[0];
      if (!topHit) errors.push("ray from above missed an island top");
      else if (topHit.face.normal.y <= 0) errors.push("island top normal faces down");
      const sea = new THREE.Raycaster(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, -1, 0));
      if (!sea.intersectObject(water, false).length) errors.push("water is not visible from above");

      const walker = walkers[0];
      const savedT = walker.t;
      const savedSign = walker.sign;
      walker.sign = 1;
      walker.t = 0.22;
      poseWalker(walker);
      const p0 = walker.mesh.position.clone();
      walker.t = 0.31;
      poseWalker(walker);
      const move = walker.mesh.position.clone().sub(p0);
      move.y = 0;
      if (move.length() < 0.02) errors.push("walker did not move along the route");
      else {
        const nose = new THREE.Vector3();
        const head = new THREE.Vector3();
        walker.nose.getWorldPosition(nose);
        walker.head.getWorldPosition(head);
        const front = nose.sub(head);
        front.y = 0;
        front.normalize();
        const cos = front.dot(move.normalize());
        if (cos < 0.9) errors.push(`walker faces away from travel (cos ${cos.toFixed(2)})`);
      }
      walker.t = savedT;
      walker.sign = savedSign;
      poseWalker(walker);

      const threat = threats[0];
      if (!threat) errors.push("no threat to face");
      else {
        const savedU = threat.u;
        const savedDir = threat.dir;
        threat.u = 0.2;
        poseThreat(threat);
        const from = threat.mesh.position.clone();
        threat.u = 0.55;
        poseThreat(threat);
        const travel = threat.mesh.position.clone().sub(from);
        travel.y = 0;
        if (travel.length() < 0.02) errors.push("threat did not move toward the islands");
        else {
          const nose = new THREE.Vector3();
          const head = new THREE.Vector3();
          threat.nose.getWorldPosition(nose);
          threat.head.getWorldPosition(head);
          const front = nose.sub(head);
          front.y = 0;
          const cos = front.normalize().dot(travel.normalize());
          if (cos < 0.9) errors.push(`threat faces away from travel (cos ${cos.toFixed(2)})`);
        }
        let nearest = Infinity;
        for (const view of views.values()) nearest = Math.min(nearest, threat.mesh.position.distanceTo(view.base));
        if (nearest < 1.9) errors.push(`threat landed on an island (${nearest.toFixed(2)})`);
        threat.u = savedU;
        threat.dir = savedDir;
        poseThreat(threat);
        threat.mesh.scale.setScalar(threat.scale0);
      }

      const crew = crews[0];
      if (!crew) errors.push("no crew to face");
      else {
        const savedCrew = {
          phase: crew.phase,
          t: crew.t,
          visible: crew.mesh.visible,
          fx: crew.fx.visible,
          pos: crew.mesh.position.clone(),
          rot: crew.mesh.rotation.y,
        };
        poseCrew(crew, crew.home, crew.post, 0.12);
        const w0 = new THREE.Vector3();
        crew.mesh.getWorldPosition(w0);
        poseCrew(crew, crew.home, crew.post, 0.7);
        const w1 = new THREE.Vector3();
        crew.mesh.getWorldPosition(w1);
        const move = w1.sub(w0);
        move.y = 0;
        if (move.length() < 0.02) errors.push("crew did not run toward the threat");
        else {
          const nose = new THREE.Vector3();
          const head = new THREE.Vector3();
          crew.nose.getWorldPosition(nose);
          crew.head.getWorldPosition(head);
          const front = nose.sub(head);
          front.y = 0;
          const cos = front.normalize().dot(move.normalize());
          if (cos < 0.9) errors.push(`crew faces away from travel (cos ${cos.toFixed(2)})`);
        }
        crew.phase = savedCrew.phase;
        crew.t = savedCrew.t;
        crew.mesh.visible = savedCrew.visible;
        crew.fx.visible = savedCrew.fx;
        crew.mesh.position.copy(savedCrew.pos);
        crew.mesh.rotation.y = savedCrew.rot;
      }

      for (const member of crews) {
        const parent = member.mesh.parent;
        const px = parent.position.x + member.post.x;
        const pz = parent.position.z + member.post.z;
        const ownD = Math.hypot(member.post.x, member.post.z);
        if (ownD < 0.9 || ownD > MESH_R * 0.98) errors.push(`crew post left its beach (${ownD.toFixed(2)})`);
        for (const view of views.values()) {
          if (view.group === parent) continue;
          const d = Math.hypot(px - view.base.x, pz - view.base.z);
          if (d < MESH_R * 1.05) errors.push(`crew stands on ${view.island.id}`);
        }
      }

      function rimAngles(mesh, minR) {
        mesh.updateWorldMatrix(true, false);
        const origin = new THREE.Vector3();
        mesh.getWorldPosition(origin);
        const attr = mesh.geometry.attributes.position;
        const v = new THREE.Vector3();
        const angles = [];
        for (let i = 0; i < attr.count; i += 1) {
          v.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld);
          const dx = v.x - origin.x;
          const dz = v.z - origin.z;
          if (Math.hypot(dx, dz) < minR) continue;
          const a = Math.atan2(dz, dx);
          if (!angles.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.02)) angles.push(a);
        }
        angles.sort((p, q) => p - q);
        return angles;
      }
      const sample = views.get("amr");
      const coastA = rimAngles(sample.coast, MESH_R * 0.97);
      const ringA = rimAngles(sample.ring, MESH_R * 1.02);
      const shadeA = rimAngles(sample.shade, MESH_R * 1.05);
      if (coastA.length !== 6 || ringA.length !== 6) errors.push(`hex rim count coast ${coastA.length} ring ${ringA.length}`);
      else {
        for (const a of coastA) {
          let best = Infinity;
          for (const b of ringA) {
            const d = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
            if (d < best) best = d;
          }
          if (best > 0.05) errors.push(`selection hex is rotated ${(best * 180 / Math.PI).toFixed(1)}° off the island`);
        }
        for (const a of coastA) {
          let best = Infinity;
          for (const b of shadeA) {
            const d = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
            if (d < best) best = d;
          }
          if (best > 0.05) errors.push(`shade hex is rotated ${(best * 180 / Math.PI).toFixed(1)}° off the island`);
        }
      }
      return errors;
    },
  };
}

function addKit(group, island, lamps, box) {
  const id = group.userData.islandId;
  const white = new THREE.MeshStandardMaterial({ color: "#f7f4ee", roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: "#8d6244", roughness: 0.86 });
  const put = (mesh, x, y, z, sx, sy, sz) => {
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "island", islandId: id };
    group.add(mesh);
    return mesh;
  };
  if (island.kit === "port") {
    put(new THREE.Mesh(box, wood), 0, 0.22, -MESH_R * 0.15, 0.36, 0.08, 1.35);
    const towerMat = white;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.72, 8), towerMat);
    tower.position.set(0.02, 0.7, -MESH_R - 0.15);
    const lampMat = new THREE.MeshStandardMaterial({ color: "#ffe1a8", emissive: "#ffb347", emissiveIntensity: 0.5 });
    lamps.push(lampMat);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), lampMat);
    lamp.position.set(0.02, 1.12, -MESH_R - 0.15);
    group.add(tower, lamp);
    tower.castShadow = lamp.castShadow = true;
    tower.userData = lamp.userData = { kind: "island", islandId: id };
    put(new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#c4473a" })), 0.42, 0.66, -0.2, 0.28, 0.22, 0.22);
    put(new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#2f6f9e" })), -0.4, 0.64, -0.05, 0.26, 0.2, 0.24);
  } else if (island.kit === "tower") {
    put(new THREE.Mesh(box, white), 0, 0.95, -0.2, 0.26, 0.9, 0.26);
    const dish = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 14), new THREE.MeshStandardMaterial({ color: "#d9e2e4" }));
    dish.position.set(0, 1.5, -0.2);
    dish.rotation.x = Math.PI / 2.4;
    dish.userData = { kind: "island", islandId: id };
    group.add(dish);
  } else if (island.kit === "lab") {
    put(new THREE.Mesh(box, white), 0, 0.78, -0.25, 0.72, 0.5, 0.42);
    const glassMat = new THREE.MeshStandardMaterial({ color: "#b7e0e4", emissive: "#7ec8d0", emissiveIntensity: 0.25, roughness: 0.2 });
    lamps.push(glassMat);
    put(new THREE.Mesh(box, glassMat), 0, 0.86, -0.02, 0.5, 0.22, 0.04);
  } else if (island.kit === "clinic" || island.kit === "hospital") {
    const tall = island.kit === "hospital" ? 0.72 : 0.48;
    put(new THREE.Mesh(box, white), 0, 0.52 + tall / 2, -0.28, 0.55, tall, 0.4);
    const cross = new THREE.MeshStandardMaterial({ color: "#d4544a" });
    put(new THREE.Mesh(box, cross), 0, 0.52 + tall * 0.72, -0.06, 0.06, 0.22, 0.04);
    put(new THREE.Mesh(box, cross), 0, 0.52 + tall * 0.72, -0.06, 0.2, 0.06, 0.04);
  } else if (island.kit === "warehouse") {
    put(new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#d7c7a2", roughness: 0.9 })), 0, 0.74, -0.2, 0.9, 0.4, 0.46);
    put(new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#b98348" })), 0.55, 0.64, 0.15, 0.2, 0.16, 0.2);
    put(new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#8d6244" })), 0.32, 0.66, 0.18, 0.18, 0.2, 0.18);
  } else if (island.kit === "school") {
    put(new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#f3efe2" })), 0, 0.7, -0.3, 0.8, 0.36, 0.4);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), new THREE.MeshStandardMaterial({ color: "#5c6670" }));
    pole.position.set(0.55, 0.8, 0.15);
    const flag = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#d4544a" }));
    flag.position.set(0.66, 0.98, 0.15);
    flag.scale.set(0.18, 0.1, 0.02);
    pole.userData = flag.userData = { kind: "island", islandId: id };
    group.add(pole, flag);
  } else if (island.kit === "rings") {
    const colors = ["#2a9a90", "#e0a04a", "#6a8f4e"];
    colors.forEach((color, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.16 + index * 0.05, 0.028, 8, 18),
        new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15 }),
      );
      ring.position.set(0, 0.85 + index * 0.08, -0.15);
      ring.rotation.x = Math.PI / 2.2;
      ring.rotation.y = index * 0.6;
      ring.userData = { kind: "island", islandId: id };
      ring.castShadow = true;
      group.add(ring);
    });
  } else if (island.kit === "dots") {
    const stone = new THREE.MeshStandardMaterial({ color: "#f4efe4" });
    for (let i = 0; i < 5; i += 1) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), stone);
      dot.position.set(-0.28 + i * 0.14, 0.58, -0.35);
      dot.userData = { kind: "island", islandId: id };
      group.add(dot);
    }
  } else if (island.kit === "ribbon") {
    const ribbon = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.045, 8, 18),
      new THREE.MeshStandardMaterial({ color: "#c4546a", roughness: 0.5 }),
    );
    ribbon.position.set(0, 0.9, -0.2);
    ribbon.rotation.x = Math.PI / 2.5;
    ribbon.userData = { kind: "island", islandId: id };
    ribbon.castShadow = true;
    group.add(ribbon);
  } else if (island.kit === "tent") {
    const cloth = new THREE.MeshStandardMaterial({ color: "#f7f4ee", roughness: 0.85 });
    for (const x of [-0.22, 0.22]) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 4), cloth);
      tent.position.set(x, 0.72, -0.25);
      tent.userData = { kind: "island", islandId: id };
      tent.castShadow = true;
      group.add(tent);
    }
  } else if (island.kit === "yard") {
    const clay = new THREE.MeshStandardMaterial({ color: "#c47a4a", roughness: 0.75 });
    const lid = new THREE.MeshStandardMaterial({ color: "#6e8f62" });
    for (let i = 0; i < 4; i += 1) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 8), clay);
      jar.position.set(-0.24 + (i % 2) * 0.28, 0.6, -0.4 + Math.floor(i / 2) * 0.24);
      jar.userData = { kind: "island", islandId: id };
      group.add(jar);
      if (i !== 1) {
        const cap = new THREE.Mesh(box, lid);
        cap.scale.set(0.12, 0.03, 0.12);
        cap.position.copy(jar.position);
        cap.position.y += 0.09;
        cap.userData = jar.userData;
        group.add(cap);
      }
    }
  } else if (island.kit === "antenna") {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.9, 6), new THREE.MeshStandardMaterial({ color: "#d5dbde" }));
    mast.position.set(0, 1.0, -0.2);
    const lampMat = new THREE.MeshStandardMaterial({ color: "#fff", emissive: "#f2f6ff", emissiveIntensity: 0.4 });
    lamps.push(lampMat);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), lampMat);
    bulb.position.set(0, 1.5, -0.2);
    mast.userData = bulb.userData = { kind: "island", islandId: id };
    group.add(mast, bulb);
  } else if (island.kit === "houses") {
    put(new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#efe6d4" })), 0, 0.66, -0.32, 0.7, 0.28, 0.34);
  }
  for (const child of group.children) {
    if (child.isMesh && !child.userData.kind) child.userData = { kind: "island", islandId: id };
  }
}
