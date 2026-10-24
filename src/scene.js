// Original implementation for this project. Not derived from third-party source code.
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { MESH_R, offsetToWorld } from "./hex.js";
import { hourCovers } from "./data.js";
import { t } from "./i18n.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createKit } from "./kit.js";
import * as P from "./palette.js";
import { addIslandDecor, addSeaDecor, buildingParts, decorReport, prepareLeaf, resetDecor } from "./decor.js";

// Meeple front is local -z: the nose sits at z < 0, the pack sits at z > 0.
// rotation.y = atan2(-dir.x, -dir.z) turns that -z axis onto dir.
// Check: dir (1, 0, 0) => rotation.y = -π/2 => local -z lands on world +x.

const _tangent = new THREE.Vector3();
const _threatDir = new THREE.Vector3();
const _crewDir = new THREE.Vector3();
const _crewFace = new THREE.Vector3();
const _crewAt = new THREE.Vector3();
const _pinWorld = new THREE.Vector3();
const _pinDir = new THREE.Vector3();
const _blobAt = new THREE.Vector3();
const _proj = new THREE.Vector3();
const mixA = new THREE.Color();
const mixB = new THREE.Color();
const lookTop = new THREE.Color();
const lookHor = new THREE.Color();
const lookBot = new THREE.Color();
const lookSun = new THREE.Color();
const lookHemi = new THREE.Color();
const lookGround = new THREE.Color();
const lookFill = new THREE.Color();
const lookDeep = new THREE.Color();
const lookShallow = new THREE.Color();
const lookFoam = new THREE.Color();
const lookHaze = new THREE.Color();

function sideGeo(base, landHex, coastHex) {
  const geo = base.clone();
  const pos = geo.attributes.position;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const land = new THREE.Color(landHex);
  const coast = new THREE.Color(coastHex);
  const top = land.clone().lerp(new THREE.Color(P.cffffff), 0.3);
  const foot = coast.clone().lerp(new THREE.Color(P.c49c8d2), 0.45);
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const span = Math.max(0.0001, maxY - minY);
  for (let i = 0; i < pos.count; i += 1) {
    tmp.copy(foot).lerp(top, (pos.getY(i) - minY) / span);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function groundMap(island) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  P.paintGround(canvas.getContext("2d"), island.id, island.land, island.coast);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// deep / shallow / foam / haze feed the sea. Numbers, not #rrggbb strings.
// Night exposure 1.05 and hemiI 0.85 stay until the time-of-day pass.
const LOOKS = [
  { h: 0, top: P.c070b12, hor: P.c121a24, bot: P.c070b12, water: P.c07141c, sun: P.cb7c6ea, hemi: P.c4a6280, ground: P.c1c2834, fill: P.cc5d4ee, exposure: 1.05, hemiI: 0.85, stars: 1, deep: 0x071a2b, shallow: 0x12384a, foam: 0x3f6680, haze: 0x0f1c2e },
  { h: 5, top: P.c1a1424, hor: P.c4a3040, bot: P.c121a24, water: P.c0c1e28, sun: P.ce7b090, hemi: P.c4a3848, ground: P.c241810, fill: P.cc49880, exposure: 0.74, hemiI: 0.32, stars: 0.55, deep: 0x1a2f45, shallow: 0x4a6a80, foam: 0xb8a0b0, haze: 0x6a5a78 },
  { h: 8.33, top: P.cf3c7a0, hor: P.cf7e6cf, bot: P.c7eaea8, water: P.c3eb0b4, sun: P.cfff1d4, hemi: P.cf4dcc0, ground: P.c8d7348, fill: P.cf0c4a0, exposure: 1.12, hemiI: 0.78, stars: 0, deep: 0x2a7f8f, shallow: 0x9edfcf, foam: 0xfff6e6, haze: 0xf6e2c8 },
  { h: 12.5, top: P.c7ec4dc, hor: P.ce7f7f6, bot: P.cb7ddd6, water: P.c49c8d2, sun: P.cfffaf2, hemi: P.ce9f7f5, ground: P.ca09068, fill: P.cc5e6ee, exposure: 1.22, hemiI: 0.88, stars: 0, deep: 0x2a86a0, shallow: 0x86e3d4, foam: 0xffffff, haze: 0xd8eef0 },
  { h: 18.67, top: P.c3a1844, hor: P.ce07a48, bot: P.c1a2030, water: P.c1a3c48, sun: P.cffb089, hemi: P.ce8a888, ground: P.c4a2c1c, fill: P.ce09070, exposure: 0.92, hemiI: 0.5, stars: 0.2, deep: 0x2a3d66, shallow: 0xd98f6e, foam: 0xffd9b8, haze: 0xe9a07e },
  { h: 22, top: P.c070b12, hor: P.c162230, bot: P.c070b12, water: P.c07141c, sun: P.c9eb0dc, hemi: P.c4a6280, ground: P.c1c2834, fill: P.cc5d4ee, exposure: 1.05, hemiI: 0.85, stars: 0.95, deep: 0x071a2b, shallow: 0x12384a, foam: 0x3f6680, haze: 0x0f1c2e },
  { h: 24, top: P.c070b12, hor: P.c121a24, bot: P.c070b12, water: P.c07141c, sun: P.cb7c6ea, hemi: P.c4a6280, ground: P.c1c2834, fill: P.cc5d4ee, exposure: 1.05, hemiI: 0.85, stars: 1, deep: 0x071a2b, shallow: 0x12384a, foam: 0x3f6680, haze: 0x0f1c2e },
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
    deep: mixHex(a.deep, b.deep, t, lookDeep),
    shallow: mixHex(a.shallow, b.shallow, t, lookShallow),
    foam: mixHex(a.foam, b.foam, t, lookFoam),
    haze: mixHex(a.haze, b.haze, t, lookHaze),
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
  const narrowScreen = () => (canvas.clientWidth || window.innerWidth || 1200) < 980;
  let pixelCap = Math.min(window.devicePixelRatio || 1, narrowScreen() ? 1.5 : 2);
  renderer.setPixelRatio(pixelCap);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(P.cf7e6cf);
  scene.fog = new THREE.FogExp2(0xd8eef0, 0.013);

  const skySunDir = new THREE.Vector3(0.45, 0.7, 0.3);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(P.cf3c7a0) },
      horizon: { value: new THREE.Color(P.cf7e6cf) },
      bottom: { value: new THREE.Color(P.c7eaea8) },
      sunDir: { value: skySunDir },
      sunColor: { value: new THREE.Color(P.cffe6bf) },
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
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
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
  sun.shadow.mapSize.set(narrowScreen() ? 1024 : 2048, narrowScreen() ? 1024 : 2048);
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

  const waterGeo = new THREE.PlaneGeometry(200, 200, 160, 160);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        deepColor: { value: new THREE.Color(0x1b86a0) },
        shallowColor: { value: new THREE.Color(0x86e3d4) },
        foamColor: { value: new THREE.Color(0xffffff) },
        sunDir: { value: skySunDir },
        sunColor: { value: new THREE.Color(P.cffe6bf) },
        sunAmt: { value: 1 },
        stars: { value: 0 },
        uTime: { value: 0 },
        isle: { value: Array.from({ length: 14 }, () => new THREE.Vector2()) },
        isleRise: { value: new Float32Array(14) },
        hexR: { value: MESH_R },
      },
    ]),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      varying vec3 vNormal;
      uniform float uTime;
      vec3 gerstner(vec2 p, vec2 dir, float steep, float wl, float speed, inout vec3 tx, inout vec3 tz) {
        float k = 6.28318 / wl;
        float c = sqrt(9.8 / k) * speed;
        vec2 d = normalize(dir);
        float f = k * (dot(d, p) - c * uTime);
        float a = steep / k;
        float s = sin(f);
        float co = cos(f);
        tx.x += -d.x * d.x * a * k * s;
        tx.y += a * co * k * d.x;
        tx.z += -d.y * d.x * a * k * s;
        tz.x += -d.x * d.y * a * k * s;
        tz.y += a * co * k * d.y;
        tz.z += -d.y * d.y * a * k * s;
        return vec3(d.x * a * co, a * s, d.y * a * co);
      }
      void main() {
        vec2 p = position.xz;
        vec3 tx = vec3(1.0, 0.0, 0.0);
        vec3 tz = vec3(0.0, 0.0, 1.0);
        vec3 disp = gerstner(p, vec2(1.0, 0.3), 0.10, 18.0, 0.12, tx, tz);
        disp += gerstner(p, vec2(-0.4, 1.0), 0.08, 9.0, 0.15, tx, tz);
        disp += gerstner(p, vec2(0.7, -0.6), 0.05, 4.0, 0.20, tx, tz);
        vec4 world = modelMatrix * vec4(position + disp, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normalize(cross(tz, tx)));
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      varying vec3 vWorld;
      varying vec3 vNormal;
      uniform vec3 deepColor;
      uniform vec3 shallowColor;
      uniform vec3 foamColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float sunAmt;
      uniform float stars;
      uniform float uTime;
      uniform vec2 isle[14];
      uniform float isleRise[14];
      uniform float hexR;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float sdHex(vec2 p, float r) {
        p = abs(p);
        return max(dot(p, vec2(0.8660254, 0.5)), p.y) - r;
      }
      void main() {
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float d = 99.0;
        float rise = 0.0;
        for (int i = 0; i < 14; i++) {
          float di = sdHex(vWorld.xz - isle[i], hexR * 0.97);
          if (di < d) { d = di; rise = isleRise[i]; }
        }
        float depth = smoothstep(0.0, 3.0, d);
        vec3 col = mix(shallowColor, deepColor, depth);
        float swell = 0.5 + 0.5 * sin(vWorld.x * 0.46 + vWorld.z * 0.16 - uTime * 0.32);
        col *= 0.96 + swell * 0.08;
        float band = smoothstep(0.08, 0.14, d) * (1.0 - smoothstep(0.16, 0.46, d));
        float lines = smoothstep(0.42, 0.78, 0.5 + 0.5 * sin(d * 22.0 - uTime * 1.6));
        float foam = band * max(lines, 1.0 - smoothstep(0.08, 0.16, d)) * rise;
        foam *= step(0.45, noise(vWorld.xz * 3.0 + uTime * 0.3));
        col = mix(col, foamColor, foam * 0.85 * (1.0 - stars * 0.7));
        vec3 halfV = normalize(normalize(sunDir) + viewDir);
        float spec = pow(max(dot(n, halfV), 0.0), 64.0);
        col += sunColor * spec * 0.35 * sunAmt * (1.0 - stars * 0.8);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  waterMat.uniforms.sunDir.value = skySunDir;
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.receiveShadow = false;
  scene.add(water);

  const sandMat = new THREE.MeshBasicMaterial({ color: P.ce9d6a8, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const sandGeo = new THREE.CircleGeometry(0.6, 6);
  sandGeo.rotateX(-Math.PI / 2);
  const sand = new THREE.InstancedMesh(sandGeo, sandMat, 3);
  sand.castShadow = false;
  sand.receiveShadow = false;
  const sandDummy = new THREE.Object3D();
  for (let i = 0; i < 3; i += 1) {
    const ang = (i / 3) * Math.PI * 2 + 0.5;
    sandDummy.position.set(Math.cos(ang) * 16.5, 0.015, Math.sin(ang) * 16.5);
    sandDummy.updateMatrix();
    sand.setMatrixAt(i, sandDummy.matrix);
  }
  sand.instanceMatrix.needsUpdate = true;
  scene.add(sand);

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
  const shadeCanvas = document.createElement("canvas");
  shadeCanvas.width = 128;
  shadeCanvas.height = 128;
  const shadeG = shadeCanvas.getContext("2d");
  const shadeGrad = shadeG.createRadialGradient(64, 64, 0, 64, 64, 64);
  shadeGrad.addColorStop(0, "rgba(11,42,53,0.35)");
  shadeGrad.addColorStop(1, "rgba(11,42,53,0)");
  shadeG.fillStyle = shadeGrad;
  shadeG.fillRect(0, 0, 128, 128);
  const shadeTex = new THREE.CanvasTexture(shadeCanvas);
  shadeTex.colorSpace = THREE.SRGBColorSpace;
  const shadeGeo = new THREE.PlaneGeometry(MESH_R * 3.2, MESH_R * 3.2);
  shadeGeo.rotateX(-Math.PI / 2);
  const shadeMat = new THREE.MeshBasicMaterial({ map: shadeTex, transparent: true, depthWrite: false });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  const unitCone = new THREE.ConeGeometry(0.5, 1, 6);
  const unitSphere = new THREE.SphereGeometry(0.5, 12, 10);
  const unitTorus = new THREE.TorusGeometry(0.5, 0.1, 6, 16);
  const roofGeo = new THREE.ConeGeometry(0.24, 0.3, 4);
  roofGeo.rotateY(Math.PI / 4);
  const trunkGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.16, 5);
  const crownGeo = new THREE.ConeGeometry(0.16, 0.34, 6);
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
  const kit = createKit();
  kit.geo("box", box);
  kit.geo("cyl", unitCyl);
  kit.geo("cone", unitCone);
  kit.geo("roof", roofGeo);
  kit.geo("sphere", unitSphere);
  kit.geo("torus", unitTorus);
  kit.geo("trunk", trunkGeo);
  kit.geo("crown", crownGeo);
  kit.geo("crown2", crownGeo);
  kit.geo("cone6", new THREE.ConeGeometry(0.5, 1, 6));
  kit.geo("rbox", new RoundedBoxGeometry(1, 1, 1, 2, 0.12));
  kit.geo("tetra", new THREE.TetrahedronGeometry(0.5));
  const sprigGeo = new THREE.BufferGeometry();
  sprigGeo.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.5, 0, 0, 0.5, 0, 0, 0, 1, 0,
    -0.5, 0, 0, 0, 1, 0, 0.5, 0, 0,
  ], 3));
  sprigGeo.computeVertexNormals();
  kit.geo("sprig", sprigGeo);
  kit.geo("bole", new THREE.CylinderGeometry(0.32, 0.5, 1, 9));
  const leafGeo = new THREE.IcosahedronGeometry(0.5, 1);
  prepareLeaf(leafGeo);
  kit.geo("leaf", leafGeo);
  const hitGeo = new THREE.CylinderGeometry(MESH_R, MESH_R, 1.2, 6);
  hitGeo.rotateY(Math.PI / 6);
  const hitMat = new THREE.MeshBasicMaterial({ color: P.cffffff });
  const hitboxes = [];

  function tag(mesh, islandId, cast = true) {
    mesh.userData = { kind: "island", islandId };
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    pickables.push(mesh);
    return mesh;
  }

  const recipeUsed = new Map();
  let recipeCursor = 0;
  function takeRecipe(islandId) {
    let used = recipeUsed.get(islandId);
    if (!used) {
      used = new Set();
      recipeUsed.set(islandId, used);
    }
    let id = recipeCursor % 40;
    let guard = 0;
    while (used.has(id) && guard < 40) {
      recipeCursor += 1;
      id = recipeCursor % 40;
      guard += 1;
    }
    used.add(id);
    recipeCursor += 1;
    return id;
  }

  function house(parent, item, x, z, index, island) {
    const group = new THREE.Group();
    group.position.set(x, 0.55, z);
    const windows = [];
    const alive = () => group.visible;
    const add = (kind, color, px, py, pz, sx = 1, sy = 1, sz = 1, rot = null, glow = false) => {
      const rec = kit.part({
        kind,
        parent: group,
        x: px,
        y: py,
        z: pz,
        sx,
        sy,
        sz,
        rx: rot?.x || 0,
        ry: rot?.y || 0,
        rz: rot?.z || 0,
        color,
        glow,
        alive,
      });
      if (glow) windows.push(rec);
      return rec;
    };
    const recipe = takeRecipe(island.id);
    void index;
    for (const part of buildingParts(recipe, island.accent)) {
      add(part.kind, part.color, part.x, part.y, part.z, part.sx, part.sy, part.sz, part.rot, part.glow);
    }
    parent.add(group);
    return { group, item, windows, recipe };
  }

  const placed = raw.map((point) => ({
    id: point.island.id,
    x: point.x - cx,
    z: point.z - cz,
  }));
  resetDecor();

  for (const point of raw) {
    const island = point.island;
    const x = point.x - cx;
    const z = point.z - cz;
    const group = new THREE.Group();
    group.userData.islandId = island.id;
    group.position.set(x, reduced ? 0 : -1.25, z);
    scene.add(group);

    const skirtMat = new THREE.MeshStandardMaterial({ color: P.cffffff, roughness: 0.97, vertexColors: true });
    const coastMat = new THREE.MeshStandardMaterial({ color: P.cffffff, roughness: 0.9, vertexColors: true });
    const landMat = new THREE.MeshStandardMaterial({ color: P.cffffff, roughness: 0.92, map: groundMap(island) });
    const skirt = new THREE.Mesh(sideGeo(skirtGeo, island.land, island.coast), skirtMat);
    skirt.position.y = 0.04;
    const coast = new THREE.Mesh(sideGeo(coastGeo, island.land, island.coast), coastMat);
    coast.position.y = 0.22;
    const top = new THREE.Mesh(topGeo, landMat);
    top.position.y = 0.46;
    const shade = new THREE.Mesh(shadeGeo, shadeMat);
    shade.position.y = 0.01;
    shade.userData = { kind: "island", islandId: island.id };
    group.add(shade, skirt, coast, top);
    tag(skirt, island.id, false);
    tag(coast, island.id, false);
    tag(top, island.id, false);
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.visible = false;
    hit.position.y = 0.55;
    hit.userData = { kind: "hitbox", islandId: island.id };
    group.add(hit);
    hitboxes.push(hit);

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

    const spots = [
      [-0.58, 0.22],
      [0.56, 0.26],
      [-0.22, 0.64],
      [0.32, 0.6],
      [0.02, -0.35],
    ];
    const buildings = island.items.map((item, index) => {
      const [sx, sz] = spots[index] ?? spots[index % spots.length];
      return house(group, item, sx, sz, index, island);
    });

    addKit(group, island, lamps, kit);
    addIslandDecor(group, island, kit, lamps, placed, spots.slice(0, island.items.length));
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
      roughness: 0.45,
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

  const skinHex = [P.cf0c7a4, P.cd9a57a, P.cc48a6a, P.c8d5a3c];
  let cargoOn = true;
  const TOOL_KEY = { clean: "toolClean", check: "toolCheck", shield: "toolShield", wash: "toolWash", finish: "toolFinish" };

  function anchorFront(mesh, yHead, nosePos) {
    const head = new THREE.Object3D();
    head.position.y = yHead;
    const nose = new THREE.Object3D();
    nose.position.copy(nosePos);
    mesh.add(head, nose);
    return { head, nose };
  }

  const walkers = flowViews.map((route, index) => {
    const mesh = new THREE.Group();
    const skin = skinHex[index % skinHex.length];
    const alive = () => mesh.visible;
    kit.part({ kind: "cone", parent: mesh, y: 0.2, sx: 0.3, sy: 0.38, sz: 0.3, color: P.c14756f, alive });
    kit.part({ kind: "sphere", parent: mesh, y: 0.44, sx: 0.2, sy: 0.2, sz: 0.2, color: skin, alive });
    kit.part({ kind: "sphere", parent: mesh, y: 0.43, z: -0.085, sx: 0.056, sy: 0.056, sz: 0.056, color: skin, alive });
    kit.part({ kind: "box", parent: mesh, y: 0.28, z: 0.09, sx: 0.1, sy: 0.09, sz: 0.045, color: P.cf3efe4, alive });
    kit.part({
      kind: "box",
      parent: mesh,
      x: 0.11,
      y: 0.32,
      z: -0.02,
      sx: 0.11,
      sy: 0.09,
      sz: 0.09,
      color: P.ce39a3a,
      alive: () => mesh.visible && cargoOn,
    });
    const { head, nose } = anchorFront(mesh, 0.44, new THREE.Vector3(0, 0.43, -0.085));
    mesh.visible = false;
    scene.add(mesh);
    return {
      mesh,
      nose,
      head,
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
        cells[i].visible = crew.t >= i * 0.15;
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
    const skin = skinHex[crews.length % skinHex.length];
    const alive = () => mesh.visible;
    kit.part({ kind: "cone", parent: mesh, y: 0.2, sx: 0.3, sy: 0.38, sz: 0.3, color: P.c14756f, alive });
    kit.part({ kind: "sphere", parent: mesh, y: 0.44, sx: 0.2, sy: 0.2, sz: 0.2, color: skin, alive });
    kit.part({ kind: "sphere", parent: mesh, y: 0.43, z: -0.085, sx: 0.056, sy: 0.056, sz: 0.056, color: skin, alive });
    const { head, nose } = anchorFront(mesh, 0.44, new THREE.Vector3(0, 0.43, -0.085));
    const fx = new THREE.Group();
    fx.visible = false;
    if (threat.tool === "shield") {
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 24, 16),
        new THREE.MeshBasicMaterial({ color: P.ce1992d, transparent: true, opacity: 0.35, depthWrite: false }),
      );
      bubble.position.y = 0.35;
      fx.add(bubble);
    } else if (threat.tool === "clean") {
      const bucket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.06, 0.12, 8),
        new THREE.MeshStandardMaterial({ color: P.cd7e4ea, roughness: 0.55 }),
      );
      bucket.position.set(0.12, 0.32, -0.02);
      bucket.name = "bucket";
      const drops = makeDrops(20, P.cb7d7ea);
      drops.name = "drops";
      fx.add(bucket, drops);
    } else if (threat.tool === "wash") {
      const bubbles = makeDrops(12, P.cffffff);
      bubbles.name = "bubbles";
      fx.add(bubbles);
    } else if (threat.tool === "finish") {
      for (let i = 0; i < 7; i += 1) {
        const cell = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, 0.03, 0.03),
          new THREE.MeshStandardMaterial({ color: P.cf4f0e6, roughness: 0.5 }),
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
    mesh.position.copy(home);
    fx.position.copy(post);
    view.group.add(mesh, labelAnchor, fx);
    let gate = null;
    if (threat.tool === "check") {
      gate = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.9),
        new THREE.MeshBasicMaterial({ color: P.c0e8a80, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
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

  function markFront(group) {
    const head = new THREE.Object3D();
    head.name = "head";
    const nose = new THREE.Object3D();
    nose.name = "nose";
    nose.position.set(0, 0, -0.36);
    group.add(head, nose);
    return { head, nose };
  }

  function addThreat(mesh, head, nose, home, halt, rate, scale, tool, islandId) {
    mesh.userData = { kind: "threat" };
    mesh.scale.setScalar(scale);
    mesh.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
    });
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
    });
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), bodyMat));
    const spikeGeo = new THREE.ConeGeometry(0.035, 0.09, 5);
    const spikeMat = new THREE.MeshStandardMaterial({ color: P.cffd0a8, roughness: 0.6 });
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
    return { group, ...markFront(group) };
  }

  function makeRod() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: P.c8ed15a, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.32, 4, 12), mat);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    const tailMat = new THREE.MeshStandardMaterial({ color: P.ce7f0cf, roughness: 0.45 });
    for (let i = 0; i < 4; i += 1) {
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.26, 4), tailMat);
      tail.rotation.x = Math.PI / 2;
      tail.position.set((i - 1.5) * 0.028, -0.015, 0.3);
      tail.rotation.z = (i - 1.5) * 0.35;
      group.add(tail);
    }
    return { group, ...markFront(group) };
  }

  function makeMosquito() {
    const group = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: P.c2a2630, roughness: 0.62 });
    const pale = new THREE.MeshStandardMaterial({ color: P.cf2ede2, roughness: 0.55 });
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
      color: P.cdff3ff,
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
    const marks = markFront(group);
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
      { make: () => makeVirus(P.cd2694a), id: "flu", tool: "shield", rate: 0.038 },
      { make: () => makeVirus(P.c5aa86a), id: "entero", tool: "wash", rate: 0.04 },
      { make: () => makeRod(), id: "tb", tool: "finish", rate: 0.034 },
    ];
    roster.forEach((spec, index) => {
      const built = spec.make();
      const raid = approach(index, views.get(spec.id).base);
      addThreat(built.group, built.head, built.nose, raid.home, raid.halt, spec.rate, 1.2, spec.tool, spec.id);
    });
    placeCrews();
  }

  const blobGeo = new THREE.CircleGeometry(0.28, 10);
  blobGeo.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(
    blobGeo,
    new THREE.MeshBasicMaterial({ color: P.c041014, transparent: true, opacity: 0.25, depthWrite: false }),
    threats.length + crews.length,
  );
  blobs.frustumCulled = false;
  blobs.castShadow = false;
  blobs.receiveShadow = false;
  scene.add(blobs);
  const blobDummy = new THREE.Object3D();
  function poseBlobs() {
    let index = 0;
    const put = (object, show, scale) => {
      object.getWorldPosition(_blobAt);
      blobDummy.position.set(_blobAt.x, 0.03, _blobAt.z);
      blobDummy.scale.setScalar(show ? scale : 0);
      blobDummy.updateMatrix();
      blobs.setMatrixAt(index, blobDummy.matrix);
      index += 1;
    };
    for (const threat of threats) put(threat.mesh, threat.mesh.visible && !threat.gone, 1.15);
    for (const crew of crews) put(crew.mesh, crew.mesh.visible, 0.55);
    blobs.instanceMatrix.needsUpdate = true;
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
    const x = cam.target.x + cam.radius * sp * Math.sin(cam.theta);
    const y = cam.target.y + cam.radius * Math.cos(cam.phi);
    const z = cam.target.z + cam.radius * sp * Math.cos(cam.theta);
    const look = camera.userData;
    if (camera.position.x === x && camera.position.y === y && camera.position.z === z
      && look._lx === cam.target.x && look._ly === cam.target.y && look._lz === cam.target.z) return;
    look._lx = cam.target.x;
    look._ly = cam.target.y;
    look._lz = cam.target.z;
    camera.position.set(x, y, z);
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
      view.group.userData.lit = on;
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
    paintGlow();
    kit.sync();
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
    const look = lookAtHour(hour);
    skyMat.uniforms.top.value.copy(look.top);
    skyMat.uniforms.horizon.value.copy(look.haze);
    skyMat.uniforms.bottom.value.copy(look.bot);
    scene.background.copy(look.haze);
    scene.fog.color.copy(look.haze);
    renderer.toneMappingExposure = look.exposure;
    hemi.color.copy(look.hemi);
    hemi.groundColor.copy(look.ground);
    hemi.intensity = look.hemiI;
    fill.color.copy(look.fill);
    fill.intensity = 0.18 + look.stars * 0.22;
    waterMat.uniforms.deepColor.value.copy(look.deep);
    waterMat.uniforms.shallowColor.value.copy(look.shallow);
    waterMat.uniforms.foamColor.value.copy(look.foam);
    waterMat.uniforms.stars.value = look.stars;
    const ang = ((hour - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    const nightSky = look.stars > 0.5;
    skySunDir.set(
      (nightSky ? -1 : 1) * Math.cos(ang),
      nightSky ? 0.62 : Math.max(elev, 0.06),
      nightSky ? -0.45 : 0.32,
    ).normalize();
    skyMat.uniforms.sunColor.value.set(nightSky ? P.cd5e4ff : P.cffe6bf);
    skyMat.uniforms.sunAmt.value = nightSky ? 0.9 : THREE.MathUtils.clamp(elev + 0.55, 0.35, 1);
    waterMat.uniforms.sunColor.value.copy(skyMat.uniforms.sunColor.value);
    waterMat.uniforms.sunAmt.value = skyMat.uniforms.sunAmt.value;
    sun.position.set(Math.cos(ang) * 26, Math.max(elev, 0.08) * 24 + 2, 9);
    const dayLit = 1 - look.stars;
    sun.intensity = 0.05 + dayLit * (0.45 + Math.max(elev, 0) * 1.15);
    sun.color.copy(look.sun);
    stars.material.opacity = look.stars * 0.9;
    paintGlow();
    renderer.shadowMap.needsUpdate = true;
  }

  function paintGlow() {
    const hour = minutes / 60;
    const night = nightAmount(hour);
    kit.glowMat.emissiveIntensity = night * 1.1;
    for (const lamp of lamps) lamp.glowAmount = 0.35 + night * 0.85;
    for (const view of views.values()) {
      const active = view.buildings.some((building) => building.group.visible && hourCovers(building.item.hours, hour));
      view.glow.material.opacity = active ? 0.28 + (1 - night) * 0.12 : 0;
      view.glow.visible = view.glow.material.opacity > 0.02;
      for (const building of view.buildings) {
        const amount = building.group.visible && hourCovers(building.item.hours, hour) ? 1 : 0.18;
        for (const win of building.windows) win.glowAmount = amount;
      }
    }
    kit.touch();
  }

  function resize() {
    const { W, H } = viewSize();
    if (W < 2 || H < 2) return;
    const cap = Math.min(window.devicePixelRatio || 1, W < 980 ? 1.5 : 2);
    if (cap < pixelCap) pixelCap = cap;
    renderer.setPixelRatio(pixelCap);
    const shadow = W < 980 ? 1024 : 2048;
    if (sun.shadow.mapSize.x !== shadow) {
      sun.shadow.mapSize.set(shadow, shadow);
      renderer.shadowMap.needsUpdate = true;
    }
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
      const lift = -1.25 * (1 - ease) + view.hover * 0.1;
      if (view.group.position.y !== lift) view.group.position.y = lift;
      for (const building of view.buildings) {
        const hot = building.item.id === hotItem ? 1.12 : 1;
        if (building.group.scale.x !== hot) building.group.scale.setScalar(hot);
      }
    }
    const riseU = waterMat.uniforms.isleRise.value;
    let riseI = 0;
    for (const view of views.values()) {
      riseU[riseI] = view.group.position.y < -0.2 ? 0 : 1;
      riseI += 1;
    }
    if (!frozen && !reduced) waterMat.uniforms.uTime.value = elapsed;
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
    const dTheta = wrapAngle(goal.theta - cam.theta);
    const dPhi = phiGoal - cam.phi;
    const dRadius = goal.radius - cam.radius;
    const dTarget = cam.target.distanceTo(goalTarget);
    if (pointers.size) {
      cam.theta = goal.theta;
      cam.phi = phiGoal;
      cam.radius = goal.radius;
      cam.target.copy(goalTarget);
    } else if (Math.abs(dTheta) < 1e-4 && Math.abs(dPhi) < 1e-4 && Math.abs(dRadius) < 1e-3 && dTarget < 1e-3) {
      cam.theta = goal.theta;
      cam.phi = phiGoal;
      cam.radius = goal.radius;
      cam.target.copy(goalTarget);
    } else {
      cam.theta += dTheta * k;
      cam.phi += dPhi * k;
      cam.radius += dRadius * k;
      cam.target.lerp(goalTarget, k);
    }
    placeCamera();
    scene.fog.density = 0.32 / cam.radius;
    const routesOn = elapsed > 1.15 || reduced;
    for (const walker of walkers) {
      const show = Boolean(routesOn && walker.route.tube.visible === true);
      walker.mesh.visible = show;
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
    hoverTick = (hoverTick + 1) % 2;
    if (hoverSample && hoverTick === 0 && pointers.size === 0) {
      const hit = hitAt(hoverSample);
      const id = hit?.islandId ?? null;
      if (id !== hoverId) {
        hoverId = id;
        refresh();
        holdRender = 0.3;
      }
      canvas.style.cursor = id ? "pointer" : "grab";
    }
    const moving = Math.abs(wrapAngle(goal.theta - cam.theta)) > 0.002
      || Math.abs((bird ? 0.58 : userPhi) - cam.phi) > 0.002
      || Math.abs(goal.radius - cam.radius) > 0.03
      || cam.target.distanceTo(goalTarget) > 0.03
      || safeT < 1;
    if (moving) holdRender = 0.3;
    if (minutes !== paintedMinutes) {
      applyClock();
      paintedMinutes = minutes;
      holdRender = 0.3;
    }
    if (shadowWarm) {
      renderer.shadowMap.needsUpdate = true;
      if (reduced || elapsed > 1.3) shadowWarm = false;
    }
    frameMs.push(step * 1000);
    if (frameMs.length >= 60) {
      const avg = frameMs.reduce((sum, ms) => sum + ms, 0) / frameMs.length;
      frameMs.length = 0;
      if (avg > 22 && pixelCap > 1 && elapsed > 2) {
        pixelCap = Math.max(1, pixelCap - 0.25);
        renderer.setPixelRatio(pixelCap);
      }
    }
    const draw = (!reduced && !frozen) || moving || holdRender > 0;
    holdRender = Math.max(0, holdRender - step);
    if (!draw) return;
    poseBlobs();
    kit.sync();
    renderer.render(scene, camera);
    if (!labelsStill()) {
      labels.render(scene, camera);
      shadePins();
      markCrowding();
    }
  }

  let hoverSample = null;
  let hoverTick = 0;
  let paintedMinutes = null;
  let holdRender = 0.4;
  let shadowWarm = true;
  const frameMs = [];
  let occTick = 0;

  const labelCam = new Float64Array(16);
  let labelCamReady = false;
  let labelForce = false;

  function labelsStill() {
    if (handoffPops.length) {
      labelForce = true;
      return false;
    }
    for (const view of views.values()) {
      if (view.group.position.y !== 0) {
        labelForce = true;
        return false;
      }
    }
    camera.updateMatrixWorld();
    const src = camera.matrixWorld.elements;
    if (!labelCamReady || labelForce) {
      labelCam.set(src);
      labelCamReady = true;
      labelForce = false;
      return false;
    }
    for (let i = 0; i < 16; i += 1) {
      if (labelCam[i] !== src[i]) {
        labelCam.set(src);
        return false;
      }
    }
    return true;
  }

  function shadePins() {
    occTick = (occTick + 1) % 6;
    if (occTick === 0) {
      const { W, H } = viewSize();
      const columns = [];
      for (const view of views.values()) {
        view.group.updateWorldMatrix(true, false);
        _pinWorld.set(0, 0.55, 0).applyMatrix4(view.group.matrixWorld);
        _pinDir.copy(_pinWorld);
        _pinDir.x += MESH_R;
        _proj.copy(_pinWorld).project(camera);
        const cx = (_proj.x * 0.5 + 0.5) * W;
        const cy = (-_proj.y * 0.5 + 0.5) * H;
        _proj.copy(_pinDir).project(camera);
        const radius = Math.hypot((_proj.x * 0.5 + 0.5) * W - cx, (-_proj.y * 0.5 + 0.5) * H - cy);
        _pinWorld.set(0, 1.25, 0).applyMatrix4(view.group.matrixWorld);
        const dist = _pinWorld.distanceTo(camera.position);
        _proj.copy(_pinWorld).project(camera);
        columns.push({
          view,
          dist,
          cx,
          cy,
          radius,
          px: (_proj.x * 0.5 + 0.5) * W,
          py: (-_proj.y * 0.5 + 0.5) * H,
        });
        view.pinScale = THREE.MathUtils.clamp(14 / Math.max(dist, 0.1), 0.75, 1.1);
      }
      for (const pin of columns) {
        // The click cylinders are shorter than the camera-to-pin ray, so a
        // nearer island covers a pin when its projected hex contains that badge.
        const blocked = columns.some((other) => other !== pin
          && other.dist + 0.4 < pin.dist
          && Math.hypot(pin.px - other.cx, pin.py - other.cy) < other.radius * 0.92);
        pin.view.pinEl.classList.toggle("occluded", blocked);
      }
    }
    for (const view of views.values()) {
      if (!view.pinScale) continue;
      view.pinEl.style.transform += ` scale(${view.pinScale})`;
    }
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
    raycaster.far = Infinity;
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObjects(hitboxes, false)[0];
    const islandId = hit?.object.userData.islandId;
    return islandId ? { kind: "island", islandId } : null;
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
      hoverSample = { clientX: event.clientX, clientY: event.clientY };
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

  addSeaDecor(scene, kit, placed);
  kit.build(scene);
  refresh();
  applyClock();
  paintedMinutes = minutes;
  resize();
  placeCamera();
  if (import.meta.env.DEV) {
    window.__island = Object.assign(window.__island ?? {}, {
      stats: () => {
        const decor = decorReport();
        const shapes = {};
        for (const [id, view] of views) shapes[id] = view.buildings.map((building) => building.recipe);
        return {
          draws: renderer.info.render.calls,
          drawCalls: renderer.info.render.calls,
          instances: kit.instanceCount(),
          triangles: renderer.info.render.triangles,
          meshes: kit.meshCount(),
          decorByIsland: decor.decorByIsland,
          decor,
          shapes,
        };
      },
    });
  }

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
    setCargo(value) { cargoOn = Boolean(value); },
    setHotItem(id) { hotItem = id; },
    onPick(fn) { pickCb = fn; },
    onArrive(fn) { arriveCb = fn; },
    getTheta() { return cam.theta; },
    debugState() {
      return {
        flows: flowViews.filter((route) => route.tube.visible === true).length,
        lit: [...views.values()].filter((view) => view.lit).map((view) => view.island.id),
        draws: renderer.info.render.calls,
        instances: kit.instanceCount(),
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
      }
      sample.shade.updateWorldMatrix(true, false);
      const shadeAt = new THREE.Vector3();
      const isleAt = new THREE.Vector3();
      sample.shade.getWorldPosition(shadeAt);
      sample.group.getWorldPosition(isleAt);
      if (Math.hypot(shadeAt.x - isleAt.x, shadeAt.z - isleAt.z) > 0.05) errors.push("contact shade left the island");
      const shadeW = sample.shade.geometry.parameters && sample.shade.geometry.parameters.width;
      if (!(shadeW >= MESH_R * 3)) errors.push("contact shade is not the wide plane");
      return errors;
    },
  };
}

function addKit(group, island, lamps, kit) {
  const alive = () => group.userData.lit !== false;
  const put = (kind, color, x, y, z, sx, sy, sz, rot = null, glow = false) => {
    const rec = kit.part({
      kind,
      parent: group,
      x,
      y,
      z,
      sx,
      sy,
      sz,
      rx: rot?.x || 0,
      ry: rot?.y || 0,
      rz: rot?.z || 0,
      color,
      glow,
      alive,
    });
    if (glow) lamps.push(rec);
    return rec;
  };
  if (island.kit === "port") {
    put("box", P.c8d6244, 0, 0.22, -MESH_R * 0.15, 0.36, 0.08, 1.35);
    put("cyl", P.cf7f4ee, 0.02, 0.7, -MESH_R - 0.15, 0.22, 0.72, 0.22);
    put("sphere", P.cffe1a8, 0.02, 1.12, -MESH_R - 0.15, 0.15, 0.15, 0.15, null, true);
    put("box", P.cc4473a, 0.42, 0.66, -0.2, 0.28, 0.22, 0.22);
    put("box", P.c2f6f9e, -0.4, 0.64, -0.05, 0.26, 0.2, 0.24);
  } else if (island.kit === "tower") {
    put("box", P.cf7f4ee, 0, 0.95, -0.2, 0.26, 0.9, 0.26);
    put("torus", P.cd9e2e4, 0, 1.5, -0.2, 0.32, 0.32, 0.32, { x: Math.PI / 2.4 });
  } else if (island.kit === "lab") {
    put("box", P.cf7f4ee, 0, 0.78, -0.25, 0.72, 0.5, 0.42);
    put("box", P.cb7e0e4, 0, 0.86, -0.02, 0.5, 0.22, 0.04, null, true);
  } else if (island.kit === "clinic" || island.kit === "hospital") {
    const tall = island.kit === "hospital" ? 0.72 : 0.48;
    put("box", P.cf7f4ee, 0, 0.52 + tall / 2, -0.28, 0.55, tall, 0.4);
    put("box", P.cd4544a, 0, 0.52 + tall * 0.72, -0.06, 0.06, 0.22, 0.04);
    put("box", P.cd4544a, 0, 0.52 + tall * 0.72, -0.06, 0.2, 0.06, 0.04);
  } else if (island.kit === "warehouse") {
    put("box", P.cd7c7a2, 0, 0.74, -0.2, 0.9, 0.4, 0.46);
    put("box", P.cb98348, 0.55, 0.64, 0.15, 0.2, 0.16, 0.2);
    put("box", P.c8d6244, 0.32, 0.66, 0.18, 0.18, 0.2, 0.18);
  } else if (island.kit === "school") {
    put("box", P.cf3efe2, 0, 0.7, -0.3, 0.8, 0.36, 0.4);
    put("cyl", P.c5c6670, 0.55, 0.8, 0.15, 0.04, 0.55, 0.04);
    put("box", P.cd4544a, 0.66, 0.98, 0.15, 0.18, 0.1, 0.02);
  } else if (island.kit === "rings") {
    [P.c2a9a90, P.ce0a04a, P.c6a8f4e].forEach((color, index) => {
      const scale = (0.16 + index * 0.05) / 0.5;
      put("torus", color, 0, 0.85 + index * 0.08, -0.15, scale, scale, scale, { x: Math.PI / 2.2, y: index * 0.6 });
    });
  } else if (island.kit === "dots") {
    for (let i = 0; i < 5; i += 1) put("sphere", P.cf4efe4, -0.28 + i * 0.14, 0.58, -0.35, 0.1, 0.1, 0.1);
  } else if (island.kit === "ribbon") {
    put("torus", P.cc4546a, 0, 0.9, -0.2, 0.36, 0.36, 0.36, { x: Math.PI / 2.5 });
  } else if (island.kit === "tent") {
    for (const x of [-0.22, 0.22]) put("cone", P.cf7f4ee, x, 0.72, -0.25, 0.44, 0.38, 0.44);
  } else if (island.kit === "yard") {
    for (let i = 0; i < 4; i += 1) {
      const x = -0.24 + (i % 2) * 0.28;
      const z = -0.4 + Math.floor(i / 2) * 0.24;
      put("cyl", P.cc47a4a, x, 0.6, z, 0.16, 0.14, 0.16);
      if (i !== 1) put("box", P.c6e8f62, x, 0.69, z, 0.12, 0.03, 0.12);
    }
  } else if (island.kit === "antenna") {
    put("cyl", P.cd5dbde, 0, 1.0, -0.2, 0.065, 0.9, 0.065);
    put("sphere", P.cf2f6ff, 0, 1.5, -0.2, 0.12, 0.12, 0.12, null, true);
  } else if (island.kit === "houses") {
    put("box", P.cefe6d4, 0, 0.66, -0.32, 0.7, 0.28, 0.34);
  }
}
