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
const _lunge = new THREE.Vector3();
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

  const rockMat = new THREE.MeshStandardMaterial({ color: "#6d7c78", roughness: 0.9 });
  for (let i = 0; i < 9; i += 1) {
    const ang = (i / 9) * Math.PI * 2 + 0.35;
    const rad = 18 + (i % 4) * 1.4;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + (i % 3) * 0.12, 0), rockMat);
    rock.position.set(Math.cos(ang) * rad, 0.02, Math.sin(ang) * rad * 0.72);
    if (rock.position.x < -10.5) continue;
    rock.castShadow = true;
    rock.rotation.y = ang;
    scene.add(rock);
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
  const vaxMat = new THREE.MeshStandardMaterial({ color: "#ef8a3a", roughness: 0.42, emissive: "#c45518", emissiveIntensity: 0.45 });
  const drugMat = new THREE.MeshStandardMaterial({ color: "#f4f7fb", roughness: 0.32, emissive: "#d7dde8", emissiveIntensity: 0.2 });
  const pillMat = new THREE.MeshStandardMaterial({ color: "#f7f1e4", roughness: 0.4, emissive: "#e7d2b0", emissiveIntensity: 0.15 });
  const pillBand = new THREE.MeshStandardMaterial({ color: "#d4544a", roughness: 0.45, emissive: "#a02018", emissiveIntensity: 0.3 });
  const supplyMat = new THREE.MeshStandardMaterial({ color: "#14a39a", roughness: 0.4, emissive: "#0c6e68", emissiveIntensity: 0.35 });
  const policyMat = new THREE.MeshStandardMaterial({ color: "#e2b43a", roughness: 0.32, metalness: 0.28, emissive: "#a07818", emissiveIntensity: 0.45 });
  const steelMat = new THREE.MeshStandardMaterial({ color: "#e7eef2", roughness: 0.22, metalness: 0.65, emissive: "#b7c4cc", emissiveIntensity: 0.15 });
  const pillGeo = new THREE.CapsuleGeometry(0.03, 0.07, 2, 8);
  const shieldGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.028, 6);
  const burstGeo = new THREE.SphereGeometry(0.32, 12, 10);
  const TOOL_KEY = { vax: "toolVax", drug: "toolDrug", supply: "toolSupply", policy: "toolPolicy" };
  const BURST = { vax: "#e07a2f", drug: "#f7f4ea", supply: "#3ecfc4", policy: "#e2b43a" };

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
  const shoreLamps = [];
  const threats = [];
  const crews = [];
  const crewMarks = [];
  let shoreLabel = null;
  const allyMarks = [];

  function poseThreat(threat) {
    threat.mesh.position.lerpVectors(threat.home, threat.halt, threat.u);
    threat.mesh.position.y = threat.hover + Math.sin(elapsed * 1.15 + threat.phase) * 0.06;
    _threatDir.subVectors(threat.halt, threat.home);
    _threatDir.y = 0;
    if (_threatDir.lengthSq() > 1e-8) threat.mesh.rotation.y = Math.atan2(-_threatDir.x, -_threatDir.z);
    threat.mesh.updateWorldMatrix(true, true);
  }

  // Visual only. poseThreat stays a lerp, so the distance self-test still samples u.
  function applyLunge(threat) {
    threat.mesh.scale.setScalar(threat.scale0);
    if (threat.dir <= 0 || threat.u <= 0.48) return;
    _lunge.subVectors(threat.halt, threat.home);
    _lunge.y = 0;
    const span = _lunge.length();
    if (span < 1e-4) return;
    const view = views.get(threat.islandId);
    const dist = Math.hypot(threat.mesh.position.x - view.base.x, threat.mesh.position.z - view.base.z);
    const room = dist - 2.15;
    if (room <= 0.02) return;
    let along = Math.sin(((threat.u - 0.48) / 0.24) * Math.PI) * Math.min(0.7, span * 0.5);
    if (along > room) along = room;
    _lunge.multiplyScalar(along / span);
    threat.mesh.position.add(_lunge);
    threat.mesh.scale.setScalar(threat.scale0 * (1 + along * 0.15));
  }

  function makeProp(kind) {
    const g = new THREE.Group();
    if (kind === "vax") {
      const barrel = new THREE.Mesh(unitCyl, vaxMat);
      barrel.rotation.x = -Math.PI / 2;
      barrel.scale.set(0.09, 0.26, 0.09);
      barrel.position.z = -0.04;
      const plunger = new THREE.Mesh(unitCyl, packMat);
      plunger.rotation.x = -Math.PI / 2;
      plunger.scale.set(0.045, 0.08, 0.045);
      plunger.position.z = 0.12;
      const needle = new THREE.Mesh(unitCyl, steelMat);
      needle.rotation.x = -Math.PI / 2;
      needle.scale.set(0.014, 0.1, 0.014);
      needle.position.z = -0.2;
      g.add(barrel, plunger, needle);
    } else if (kind === "drug") {
      const bottle = new THREE.Mesh(unitCyl, drugMat);
      bottle.scale.set(0.11, 0.22, 0.11);
      const cap = new THREE.Mesh(unitCyl, supplyMat);
      cap.scale.set(0.07, 0.05, 0.07);
      cap.position.y = 0.13;
      const pill = new THREE.Mesh(pillGeo, pillMat);
      pill.rotation.z = Math.PI / 2;
      pill.position.set(0.12, 0.02, 0);
      const band = new THREE.Mesh(unitCyl, pillBand);
      band.rotation.z = Math.PI / 2;
      band.scale.set(0.034, 0.028, 0.034);
      band.position.copy(pill.position);
      g.add(bottle, cap, pill, band);
    } else if (kind === "supply") {
      const can = new THREE.Mesh(unitCyl, supplyMat);
      can.scale.set(0.11, 0.24, 0.11);
      const nozzle = new THREE.Mesh(unitCone, packMat);
      nozzle.rotation.x = -Math.PI / 2;
      nozzle.scale.set(0.05, 0.1, 0.05);
      nozzle.position.set(0, 0.06, -0.16);
      g.add(can, nozzle);
    } else {
      const shield = new THREE.Mesh(shieldGeo, policyMat);
      shield.rotation.x = -Math.PI / 2;
      g.add(shield);
    }
    return g;
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

  function repel(crew) {
    const threat = crew.threat;
    crew.burst.position.copy(threat.mesh.position);
    threat.dir = -1;
    threat.u = Math.max(threat.floor, threat.u - 0.16);
    poseThreat(threat);
    applyLunge(threat);
    crew.shot.visible = false;
    crew.held.visible = true;
    crew.burst.visible = true;
    crew.burst.scale.setScalar(0.45);
    crew.burstMat.opacity = 0.82;
    crew.burstT = 0;
  }

  function stepCrew(crew, step) {
    const threat = crew.threat;
    if (crew.burstT >= 0) {
      crew.burstT += step;
      const k = crew.burstT / 0.45;
      if (k >= 1) {
        crew.burst.visible = false;
        crew.burstT = -1;
      } else {
        crew.burst.visible = true;
        crew.burst.scale.setScalar(0.45 + k * 1.6);
        crew.burstMat.opacity = (1 - k) * 0.82;
      }
    }
    if (crew.phase === "wait") {
      crew.mesh.visible = false;
      crew.labelAnchor.visible = false;
      if (elapsed > 0.7 && threat.dir > 0 && threat.u > 0.58) {
        crew.phase = "run";
        crew.t = 0;
        crew.mesh.visible = true;
        crew.labelAnchor.visible = true;
        crew.held.visible = true;
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
        crew.phase = "aim";
        crew.t = 0;
      }
      return;
    }
    if (crew.phase === "aim") {
      crew.mesh.position.copy(crew.post);
      faceThreat(crew);
      if (crew.t >= 0.16) {
        crew.phase = "throw";
        crew.t = 0;
        crew.hand.getWorldPosition(crew.shotFrom);
        _crewFace.subVectors(threat.mesh.position, crew.shotFrom);
        _crewFace.y = 0;
        if (_crewFace.lengthSq() > 1e-8) crew.shot.rotation.y = Math.atan2(-_crewFace.x, -_crewFace.z);
        crew.held.visible = false;
        crew.shot.position.copy(crew.shotFrom);
        crew.shot.visible = true;
      }
      return;
    }
    if (crew.phase === "throw") {
      faceThreat(crew);
      const alpha = Math.min(1, crew.t / 0.4);
      crew.shot.position.lerpVectors(crew.shotFrom, threat.mesh.position, alpha);
      crew.shot.position.y += Math.sin(alpha * Math.PI) * 0.9;
      if (crew.t >= 0.4) {
        crew.phase = "back";
        crew.t = 0;
        repel(crew);
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
        crew.mesh.position.copy(crew.home);
        crew.shot.visible = false;
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
    mesh.scale.setScalar(2);
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
    const hand = new THREE.Object3D();
    hand.position.set(0.1, 0.34, -0.04);
    const held = makeProp(threat.tool);
    hand.add(held);
    const labelEl = document.createElement("div");
    labelEl.className = "crew-label";
    labelEl.textContent = t(TOOL_KEY[threat.tool]);
    const label = new CSS2DObject(labelEl);
    const labelAnchor = new THREE.Object3D();
    labelAnchor.position.set(_crewDir.x * 1.9 + sideX * spread, 1.15, _crewDir.z * 1.9 + sideZ * spread);
    labelAnchor.add(label);
    labelAnchor.visible = false;
    mesh.add(body, head, nose, hand);
    mesh.position.copy(home);
    view.group.add(mesh, labelAnchor);
    const shot = makeProp(threat.tool);
    shot.scale.setScalar(2);
    shot.visible = false;
    scene.add(shot);
    const burstMat = new THREE.MeshBasicMaterial({
      color: BURST[threat.tool],
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const burst = new THREE.Mesh(burstGeo, burstMat);
    burst.visible = false;
    scene.add(burst);
    crewMarks.push({ el: labelEl, key: TOOL_KEY[threat.tool] });
    return {
      mesh,
      nose,
      head,
      hand,
      held,
      labelAnchor,
      home,
      post,
      spread,
      threat,
      phase: "wait",
      t: 0,
      shot,
      shotFrom: new THREE.Vector3(),
      burst,
      burstMat,
      burstT: -1,
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
    threats.push(threat);
    poseThreat(threat);
  }

  function makeVirus(color) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.32, emissive: color, emissiveIntensity: 0.4 });
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), bodyMat));
    const stalkMat = new THREE.MeshStandardMaterial({ color: "#f6ddd6", roughness: 0.4 });
    const knobMat = new THREE.MeshStandardMaterial({ color: "#ffd7b0", roughness: 0.3, emissive: "#d15a3a", emissiveIntensity: 0.35 });
    const stalkGeo = new THREE.CylinderGeometry(0.01, 0.014, 0.11, 5);
    const knobGeo = new THREE.SphereGeometry(0.026, 7, 6);
    for (let i = 0; i < 16; i += 1) {
      const y = 1 - (i / 15) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const ang = i * 2.399;
      const d = new THREE.Vector3(Math.cos(ang) * ring, y, Math.sin(ang) * ring).normalize();
      const stalk = new THREE.Mesh(stalkGeo, stalkMat);
      stalk.position.copy(d).multiplyScalar(0.21);
      stalk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      const knob = new THREE.Mesh(knobGeo, knobMat);
      knob.position.copy(d).multiplyScalar(0.29);
      group.add(stalk, knob);
    }
    return { group, ...markFront(group, knobMat) };
  }

  function makeRod() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: "#8ed15a", roughness: 0.38, emissive: "#3f6e24", emissiveIntensity: 0.4 });
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
    const dark = new THREE.MeshStandardMaterial({ color: "#2c241e", roughness: 0.5, emissive: "#5a3024", emissiveIntensity: 0.3 });
    const pale = new THREE.MeshStandardMaterial({ color: "#d9d3c6", roughness: 0.55 });
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
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#6f9a48", roughness: 0.25, emissive: "#3e6428", emissiveIntensity: 0.35 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), eyeMat);
    eyeL.position.set(-0.028, 0.02, -0.19);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.028;
    const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.16, 5), dark);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.012, -0.28);
    const wingMat = new THREE.MeshStandardMaterial({
      color: "#e8f1f4",
      transparent: true,
      opacity: 0.5,
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
    const legGeo = new THREE.CylinderGeometry(0.005, 0.003, 0.22, 4);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        const leg = new THREE.Mesh(legGeo, dark);
        leg.position.set(side * 0.07, -0.05, -0.08 + i * 0.06);
        leg.rotation.z = side * 1.05;
        leg.rotation.x = -0.35 + i * 0.28;
        group.add(leg);
      }
    }
    group.add(thorax, head, eyeL, eyeR, beak, wingL, wingR);
    const marks = markFront(group, dark);
    marks.nose.position.set(0, -0.01, -0.4);
    return { group, ...marks };
  }

  function makeWedge() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: "#161214", roughness: 0.38, metalness: 0.42, emissive: "#5a1814", emissiveIntensity: 0.4 });
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.62, 4), mat);
    hull.rotation.x = -Math.PI / 2;
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 6, 6),
      new THREE.MeshStandardMaterial({ color: "#ff3a2a", emissive: "#ff180e", emissiveIntensity: 1.1 }),
    );
    eye.position.set(0, 0.04, -0.22);
    group.add(hull, eye);
    return { group, ...markFront(group, mat) };
  }

  {
    const amr = views.get("amr").base;
    const border = views.get("border").base;
    const dengue = views.get("dengue").base;
    const globalI = views.get("global").base;
    const hepa = views.get("hepa").base;
    const isle = waterMat.uniforms.isle.value;
    let isleIndex = 0;
    for (const view of views.values()) isle[isleIndex++].set(view.base.x, view.base.z);
    const shore = new THREE.Group();
    shore.position.set(amr.x - 3.55, 0, amr.z + 9.25);
    const groundMat = new THREE.MeshStandardMaterial({ color: "#12080e", roughness: 0.94 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.36, 2.05), groundMat);
    slab.position.y = 0.16;
    const lip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.2), groundMat);
    lip.position.set(0, 0.42, -0.92);
    shore.add(slab, lip);
    const mawMat = new THREE.MeshStandardMaterial({ color: "#3a080c", emissive: "#e01818", emissiveIntensity: 0.9, roughness: 0.35 });
    shoreLamps.push(mawMat);
    const maw = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.16), mawMat);
    maw.position.set(0.02, 0.42, -0.98);
    shore.add(maw);
    const peakMat = new THREE.MeshStandardMaterial({ color: "#1a0c12", roughness: 0.78, emissive: "#6a1420", emissiveIntensity: 0.4 });
    for (const [x, h, z] of [[-0.8, 1.25, 0.2], [0.1, 1.55, -0.05], [0.78, 1.05, 0.28], [-0.15, 0.82, 0.5], [0.48, 1.15, -0.48]]) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(0.22 + h * 0.06, h, 5), peakMat);
      peak.position.set(x, 0.18 + h / 2, z);
      shore.add(peak);
    }
    const toothMat = new THREE.MeshStandardMaterial({ color: "#241014", roughness: 0.62, emissive: "#8a1c1c", emissiveIntensity: 0.55 });
    for (let i = 0; i < 8; i += 1) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 4), toothMat);
      tooth.position.set(-1.15 + i * 0.33, 0.28, -0.98);
      tooth.rotation.x = -1.05;
      shore.add(tooth);
    }
    const towerMat = new THREE.MeshStandardMaterial({ color: "#1c1016", roughness: 0.6, metalness: 0.3 });
    const winMat = new THREE.MeshStandardMaterial({ color: "#ff6844", emissive: "#ff2418", emissiveIntensity: 1.2 });
    shoreLamps.push(winMat);
    for (const [x, h, z] of [[-0.62, 1.35, -0.15], [0.28, 1.58, 0.02], [0.82, 1.02, -0.32]]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, 0.2), towerMat);
      tower.position.set(x, 0.18 + h / 2, z);
      tower.rotation.z = (x > 0 ? -1 : 1) * 0.07;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), winMat);
      eye.position.set(x, 0.22 + h * 0.7, z - 0.1);
      shore.add(tower, eye);
    }
    const labelEl = document.createElement("div");
    labelEl.className = "shore-label";
    labelEl.textContent = t("shore");
    shoreLabel = labelEl;
    const label = new CSS2DObject(labelEl);
    label.position.set(0.1, 2.05, 0);
    shore.add(label);
    scene.add(shore);

    const park = (focus, hx, hz, gap) => {
      const home = new THREE.Vector3(focus.x + hx, 0, focus.z + hz);
      const len = Math.hypot(hx, hz) || 1;
      const halt = new THREE.Vector3(focus.x + (hx / len) * gap, 0, focus.z + (hz / len) * gap);
      return { home, halt };
    };
    const virusA = makeVirus("#c43858");
    const raidA = park(amr, -3.04, 7.4, 3.1);
    addThreat(virusA.group, virusA.head, virusA.nose, raidA.home, raidA.halt, 0.04, 2.15, "vax", "amr");
    const virusB = makeVirus("#9a3478");
    const raidB = park(border, 3.93, -1.56, 3.0);
    addThreat(virusB.group, virusB.head, virusB.nose, raidB.home, raidB.halt, 0.038, 2, "vax", "border");
    const mosquitoA = makeMosquito();
    const raidM = park(dengue, -2.77, 1.91, 2.95);
    addThreat(mosquitoA.group, mosquitoA.head, mosquitoA.nose, raidM.home, raidM.halt, 0.046, 2.2, "supply", "dengue");
    const mosquitoB = makeMosquito();
    const raidN = park(hepa, 1.2, -2.8, 2.75);
    addThreat(mosquitoB.group, mosquitoB.head, mosquitoB.nose, raidN.home, raidN.halt, 0.04, 2, "supply", "hepa");
    const rod = makeRod();
    const raidR = park(globalI, 2.2, -2.79, 3.0);
    addThreat(rod.group, rod.head, rod.nose, raidR.home, raidR.halt, 0.034, 2, "drug", "global");
    for (const [hx, hz] of [[-3.84, 7.7], [-2.94, 7.5], [-2.09, 7.9]]) {
      const wedge = makeWedge();
      const raid = park(amr, hx, hz, 3.15);
      addThreat(wedge.group, wedge.head, wedge.nose, raid.home, raid.halt, 0.05, 1.55, "policy", "amr");
    }

    const vax = views.get("vax").base;
    function allyIsle(key, x, z, tint, decorate) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const coast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.84, 0.16, 6),
        new THREE.MeshStandardMaterial({ color: "#ecd7ae", roughness: 0.9 }),
      );
      coast.position.y = 0.12;
      coast.rotation.y = Math.PI / 6;
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.54, 0.62, 0.16, 6),
        new THREE.MeshStandardMaterial({ color: tint, roughness: 0.78 }),
      );
      top.position.y = 0.26;
      top.rotation.y = Math.PI / 6;
      g.add(coast, top);
      decorate(g);
      const el = document.createElement("div");
      el.className = "ally-label";
      el.textContent = t(key);
      const mark = new CSS2DObject(el);
      mark.position.set(0, 1.15, 0);
      g.add(mark);
      allyMarks.push({ el, key });
      g.userData = { kind: "ally" };
      scene.add(g);
    }
    allyIsle("allyJP", border.x - 3.6, border.z - 3.61, "#7faf72", (g) => {
      const hall = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#f7f4ee", roughness: 0.8 }));
      hall.position.set(0, 0.48, 0);
      hall.scale.set(0.28, 0.28, 0.24);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), new THREE.MeshStandardMaterial({ color: "#d23a3a" }));
      disc.position.set(0, 0.5, 0.13);
      const roofM = new THREE.Mesh(unitCone, new THREE.MeshStandardMaterial({ color: "#8c3030", roughness: 0.6 }));
      roofM.position.set(0, 0.74, 0);
      roofM.scale.set(0.34, 0.22, 0.34);
      g.add(hall, disc, roofM);
    });
    allyIsle("allyUS", hepa.x + 3.85, hepa.z - 0.25, "#6e9a68", (g) => {
      const hall = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#f4f7fb", roughness: 0.75 }));
      hall.position.set(0, 0.48, 0);
      hall.scale.set(0.36, 0.26, 0.26);
      const blue = new THREE.MeshStandardMaterial({ color: "#2a4e8c", roughness: 0.55 });
      const cap = new THREE.Mesh(box, blue);
      cap.position.set(-0.08, 0.66, 0);
      cap.scale.set(0.16, 0.1, 0.26);
      const stripe = new THREE.MeshStandardMaterial({ color: "#c4473a", roughness: 0.6 });
      const band = new THREE.Mesh(box, stripe);
      band.position.set(0.08, 0.58, 0.14);
      band.scale.set(0.2, 0.04, 0.02);
      g.add(hall, cap, band);
    });
    allyIsle("allyEU", vax.x - 5.79, vax.z - 0.83, "#7ea3c4", (g) => {
      const hall = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#f6f3ea", roughness: 0.8 }));
      hall.position.set(0, 0.46, 0);
      hall.scale.set(0.26, 0.24, 0.22);
      const gold = new THREE.MeshStandardMaterial({ color: "#e2b43a", emissive: "#a07818", emissiveIntensity: 0.25, roughness: 0.4 });
      for (let i = 0; i < 8; i += 1) {
        const ang = (i / 8) * Math.PI * 2;
        const star = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), gold);
        star.position.set(Math.cos(ang) * 0.28, 0.72, Math.sin(ang) * 0.28);
        g.add(star);
      }
      g.add(hall);
    });
    allyIsle("allyPH", dengue.x + 3.45, dengue.z + 1.05, "#d2b15a", (g) => {
      const hut = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#f3e2c4", roughness: 0.82 }));
      hut.position.set(-0.08, 0.44, 0);
      hut.scale.set(0.24, 0.2, 0.2);
      const roofP = new THREE.Mesh(unitCone, new THREE.MeshStandardMaterial({ color: "#c4553a", roughness: 0.6 }));
      roofP.position.set(-0.08, 0.64, 0);
      roofP.scale.set(0.28, 0.16, 0.28);
      const trunk = new THREE.Mesh(unitCyl, new THREE.MeshStandardMaterial({ color: "#8d6244", roughness: 0.85 }));
      trunk.position.set(0.22, 0.48, 0.05);
      trunk.scale.set(0.05, 0.28, 0.05);
      const frond = new THREE.Mesh(unitCone, new THREE.MeshStandardMaterial({ color: "#3e7a3a", roughness: 0.7 }));
      frond.position.set(0.22, 0.68, 0.05);
      frond.scale.set(0.16, 0.14, 0.16);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: "#f0c14a", emissive: "#e09a20", emissiveIntensity: 0.35 }));
      sun.position.set(0.05, 0.78, -0.05);
      g.add(hut, roofP, trunk, frond, sun);
    });
    placeCrews();
  }

  let pickCb = () => {};
  let arriveCb = () => {};

  const overviewTarget = new THREE.Vector3(0.7, 0.25, 5.4);
  const narrowTarget = new THREE.Vector3(0.2, 0.35, 21);
  let maxSpan = 0;
  for (const view of views.values()) maxSpan = Math.max(maxSpan, Math.hypot(view.base.x, view.base.z));
  const narrowView = () => (canvas.clientWidth || window.innerWidth) < 980;
  const framedRadius = () => maxSpan + (narrowView() ? 42 : 15.5);
  let overviewRadius = framedRadius();
  const cam = { theta: 0.18, phi: 1.02, radius: overviewRadius, target: overviewTarget.clone() };
  const goal = { theta: cam.theta, radius: overviewRadius };
  let userPhi = cam.phi;
  const goalTarget = overviewTarget.clone();

  function frameWide() {
    overviewRadius = framedRadius();
    const narrow = narrowView();
    if (bird) {
      goalTarget.copy(narrow ? narrowTarget : overviewTarget);
      goal.radius = overviewRadius + (narrow ? 4 : 8);
      return;
    }
    if (selected.size) return;
    goalTarget.copy(narrow ? narrowTarget : overviewTarget);
    goal.radius = overviewRadius;
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
        building.group.visible = on && phaseOk(building.item.phase) && itemHit;
      }
      view.ring.visible = selected.has(view.island.id);
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
      const forced = query && norm(route.flow._hay).includes(query);
      const touched = [...selected].some((id) => id === route.flow.a || id === route.flow.b);
      const ends = views.get(route.flow.a).lit && views.get(route.flow.b).lit;
      route.tube.visible = ends && (showAllFlows || touched || forced);
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
    for (const lamp of shoreLamps) lamp.emissiveIntensity = 0.25 + night * 1.15;
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
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    labels.setSize(width, height);
    frameWide();
  }

  function tick(dt) {
    const step = Math.min(dt, 0.05);
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
        threat.u += step * threat.rate * threat.dir;
        if (threat.u >= threat.limit) {
          threat.u = threat.limit;
          threat.dir = -1;
        } else if (threat.u <= threat.floor) {
          threat.u = threat.floor;
          threat.dir = 1;
        }
        poseThreat(threat);
        applyLunge(threat);
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
      const show = routesOn && walker.route.tube.visible;
      walker.mesh.visible = show;
      walker.crate.visible = cargoOn;
      if (!show || frozen || reduced) continue;
      walker.t += (step / walker.duration) * walker.sign;
      if (walker.t >= 1) {
        walker.t = 1;
        walker.sign = -1;
        arriveCb({ flow: walker.flow, from: walker.flow.a, to: walker.flow.b, carried: walker.flow.carried });
      } else if (walker.t <= 0) {
        walker.t = 0;
        walker.sign = 1;
        arriveCb({ flow: walker.flow, from: walker.flow.b, to: walker.flow.a, carried: walker.flow.carried });
      }
      poseWalker(walker);
      walker.mesh.position.y += Math.sin(elapsed * 7 + walker.phase) * 0.02;
    }
    applyClock();
    renderer.render(scene, camera);
    labels.render(scene, camera);
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
      if (prev.pinch) goal.radius = THREE.MathUtils.clamp(goal.radius * (prev.pinch / dist), 8, 48);
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
    pickCb(hitAt(event));
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    goal.radius = THREE.MathUtils.clamp(goal.radius * Math.exp(event.deltaY * 0.0011), 8, 48);
  }, { passive: false });

  function focusIslands(ids) {
    selected = new Set(ids);
    refresh();
    if (!ids.length) {
      frameWide();
      return;
    }
    const center = new THREE.Vector3();
    for (const id of ids) center.add(views.get(id).base);
    center.multiplyScalar(1 / ids.length);
    center.y = 0.35;
    goalTarget.copy(center);
    goal.radius = ids.length > 1 ? Math.min(overviewRadius, 16) : 10.5;
    if (narrowView()) {
      goalTarget.z += 6;
      goal.radius = ids.length > 1 ? 20 : 14;
    }
  }

  refresh();
  applyClock();
  resize();
  placeCamera();

  return {
    tick,
    resize,
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
      if (shoreLabel) shoreLabel.textContent = t("shore");
      for (const mark of allyMarks) mark.el.textContent = t(mark.key);
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
      cargoOn = value;
      for (const walker of walkers) walker.crate.visible = value;
    },
    setHotItem(id) { hotItem = id; },
    onPick(fn) { pickCb = fn; },
    onArrive(fn) { arriveCb = fn; },
    getTheta() { return cam.theta; },
    debugState() {
      return {
        flows: flowViews.filter((route) => route.tube.visible).length,
        lit: [...views.values()].filter((view) => view.lit).map((view) => view.island.id),
      };
    },
    selfTest() {
      const errors = [];
      const border = views.get("border");
      const dengue = views.get("dengue");
      if (!(border.base.z < dengue.base.z)) errors.push("border island is not north (-z) of dengue");
      const saved = { theta: cam.theta, phi: cam.phi, radius: cam.radius, target: cam.target.clone() };
      cam.theta = 0;
      cam.phi = 0.95;
      cam.radius = overviewRadius;
      cam.target.set(0, 0.3, 0);
      placeCamera();
      const northY = border.base.clone().project(camera).y;
      const southY = dengue.base.clone().project(camera).y;
      if (!(northY > southY)) errors.push(`north is not above south on screen (${northY.toFixed(2)} vs ${southY.toFixed(2)})`);
      const east = new THREE.Vector3(5, 0.4, 0).project(camera);
      if (east.x <= 0.05) errors.push("world +x is not screen-right at theta 0");
      cam.theta = saved.theta;
      cam.phi = saved.phi;
      cam.radius = saved.radius;
      cam.target.copy(saved.target);
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
          held: crew.held.visible,
          shot: crew.shot.visible,
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
        crew.held.visible = savedCrew.held;
        crew.shot.visible = savedCrew.shot;
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
