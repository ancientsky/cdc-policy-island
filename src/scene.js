// Original implementation for this project. Not derived from third-party source code.
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { MESH_R, offsetToWorld } from "./hex.js";
import { hourCovers } from "./data.js";
import { t } from "./i18n.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createKit } from "./kit.js";
import * as P from "./palette.js";
import { addIslandDecor, addSeaDecor, buildingParts, decorReport, prepareLeaf, resetDecor, seaState } from "./decor.js";
import { createLife } from "./life.js";
import { createEnvironment } from "./environment.js";
import { createPeople } from "./people.js";
import { play as playSfx } from "./sfx.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

// Meeple front is local -z: the nose sits at z < 0, the pack sits at z > 0.
// rotation.y = atan2(-dir.x, -dir.z) turns that -z axis onto dir.
// Check: dir (1, 0, 0) => rotation.y = -π/2 => local -z lands on world +x.

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
const ASLEEP = new THREE.Color(0x8a8f93);
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
const lookSunPos = new THREE.Vector3();

function layerGeo(base, bottomHex, topHex) {
  const geo = base.clone();
  const pos = geo.attributes.position;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const bottom = new THREE.Color(bottomHex);
  const top = new THREE.Color(topHex);
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const span = Math.max(0.0001, maxY - minY);
  for (let i = 0; i < pos.count; i += 1) {
    const t = (pos.getY(i) - minY) / span;
    const band = t < 0.72 ? 0 : (t - 0.72) / 0.28;
    tmp.copy(bottom).lerp(top, band);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function hexTopGeometry() {
  const radius = MESH_R * 0.88;
  const shape = new THREE.Shape();
  for (let k = 0; k < 6; k += 1) {
    const angle = (k * Math.PI) / 3;
    const x = radius * Math.cos(angle);
    const y = -radius * Math.sin(angle);
    if (k === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.05,
    bevelSegments: 1,
    curveSegments: 1,
  });
  // Vertex on +X stays on world +X, the same angles as coast.rotateY(PI/6).
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function groundMap(island) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  P.paintGround(canvas.getContext("2d"), island.id, island.land);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Time-of-day anchors. Colors are 0x numbers so this file stays free of #rrggbb.
// h:24 matches h:0. Knots at 05:45 and 16:00 are inserted below.
const LOOKS = [
  { h: 0, top: 0x2a3f70, hor: 0x1b2a44, bot: 0x070d18, haze: 0x0f1c2e, deep: 0x071a2b, shallow: 0x12384a, foam: 0x3f6680, sun: 0x9fb4e8, hemi: 0x8aafd6, ground: 0x141c26, fill: 0x6a80c0, key: 0.45, fillI: 0.30, hemiI: 0.80, exposure: 1.52, sunPos: new THREE.Vector3(-10, 26, -14), stars: 1, night: 1 },
  { h: 5, top: 0x2a2440, hor: 0xc98a8a, bot: 0x1a2232, haze: 0x6a5a78, deep: 0x1a2f45, shallow: 0x4a6a80, foam: 0xb8a0b0, sun: 0xffb59a, hemi: 0x6a5a7a, ground: 0x2a2026, fill: 0x7a7ab0, key: 0.60, fillI: 0.35, hemiI: 0.40, exposure: 0.95, sunPos: new THREE.Vector3(24, 4, 12), stars: 0.5, night: 0.6 },
  { h: 8.33, top: 0x9fc8e6, hor: 0xfbe3c8, bot: 0xa9d3cf, haze: 0xf6e2c8, deep: 0x2a7f8f, shallow: 0x9edfcf, foam: 0xfff6e6, sun: 0xffd7a8, hemi: 0xfde8d0, ground: 0x8a7a5c, fill: 0x9cc4e8, key: 2.40, fillI: 0.35, hemiI: 0.65, exposure: 1.00, sunPos: new THREE.Vector3(22, 10, 14), stars: 0, night: 0 },
  { h: 12.5, top: 0x5fb0e0, hor: 0xdff3f6, bot: 0xbfe6e2, haze: 0xd8eef0, deep: 0x2a86a0, shallow: 0x86e3d4, foam: 0xffffff, sun: 0xffffff, hemi: 0xe6f4ff, ground: 0xb0a07c, fill: 0xcfe8f5, key: 2.80, fillI: 0.25, hemiI: 1.00, exposure: 0.95, sunPos: new THREE.Vector3(6, 30, 8), stars: 0, night: 0 },
  { h: 18.67, top: 0x3b2a5c, hor: 0xf39a6b, bot: 0x2a2f4a, haze: 0xe9a07e, deep: 0x2a3d66, shallow: 0xd98f6e, foam: 0xffd9b8, sun: 0xff9a5c, hemi: 0xd8c8e4, ground: 0x3a2a3a, fill: 0x7a68c0, key: 1.15, fillI: 0.70, hemiI: 0.90, exposure: 1.00, sunPos: new THREE.Vector3(-24, 6, 6), stars: 0.2, night: 0.3 },
  { h: 22, top: 0x2a3f70, hor: 0x1e3050, bot: 0x070d18, haze: 0x0f1c2e, deep: 0x071a2b, shallow: 0x12384a, foam: 0x3f6680, sun: 0x9fb4e8, hemi: 0x8aafd6, ground: 0x141c26, fill: 0x6a80c0, key: 0.45, fillI: 0.30, hemiI: 0.80, exposure: 1.52, sunPos: new THREE.Vector3(-10, 26, -14), stars: 0.95, night: 1 },
  { h: 24, top: 0x2a3f70, hor: 0x1b2a44, bot: 0x070d18, haze: 0x0f1c2e, deep: 0x071a2b, shallow: 0x12384a, foam: 0x3f6680, sun: 0x9fb4e8, hemi: 0x8aafd6, ground: 0x141c26, fill: 0x6a80c0, key: 0.45, fillI: 0.30, hemiI: 0.80, exposure: 1.52, sunPos: new THREE.Vector3(-10, 26, -14), stars: 1, night: 1 },
];

function spliceLookKnot(hour) {
  let i = 0;
  while (i < LOOKS.length - 1 && hour >= LOOKS[i + 1].h) i += 1;
  const a = LOOKS[i];
  const b = LOOKS[i + 1];
  const t = (hour - a.h) / (b.h - a.h);
  const colorOf = (key) => mixA.set(a[key]).lerp(mixB.set(b[key]), t).getHex();
  const num = (key) => a[key] + (b[key] - a[key]) * t;
  LOOKS.splice(i + 1, 0, {
    h: hour,
    top: colorOf("top"),
    hor: colorOf("hor"),
    bot: colorOf("bot"),
    haze: colorOf("haze"),
    deep: colorOf("deep"),
    shallow: colorOf("shallow"),
    foam: colorOf("foam"),
    sun: colorOf("sun"),
    hemi: colorOf("hemi"),
    ground: colorOf("ground"),
    fill: colorOf("fill"),
    key: num("key"),
    fillI: num("fillI"),
    hemiI: num("hemiI"),
    exposure: num("exposure"),
    sunPos: new THREE.Vector3().lerpVectors(a.sunPos, b.sunPos, t),
    stars: num("stars"),
    night: num("night"),
  });
}
spliceLookKnot(5.75);
spliceLookKnot(16);

function norm(s) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, "");
}

function damp(current, goal, dt, speed) {
  return current + (goal - current) * (1 - Math.exp(-speed * dt));
}

function easeInOutCubic(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
}

function easeOutBack(t, s = 1.70158) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  const c1 = s;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function wrapAngle(d) {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
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
    key: a.key + (b.key - a.key) * t,
    fillI: a.fillI + (b.fillI - a.fillI) * t,
    night: a.night + (b.night - a.night) * t,
    stars: a.stars + (b.stars - a.stars) * t,
    sunPos: lookSunPos.lerpVectors(a.sunPos, b.sunPos, t),
  };
}

export function createScene(canvas, data, { reduced = false } = {}) {
  let introAt = 0;
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
  const sky = new THREE.Mesh(new THREE.IcosahedronGeometry(150, 3), skyMat);
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
  sun.shadow.normalBias = 0.02;
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
  const topGeo = hexTopGeometry();
  skirtGeo.rotateY(Math.PI / 6);
  coastGeo.rotateY(Math.PI / 6);
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
  // Radius 0.5. Crew and walker heads scale it by 0.2, which is a 0.1 head.
  const unitSphere = new THREE.IcosahedronGeometry(0.5, 1);
  const unitTorus = new THREE.TorusGeometry(0.5, 0.1, 6, 16);
  const roofGeo = new THREE.ConeGeometry(0.24, 0.3, 4);
  roofGeo.rotateY(Math.PI / 4);
  const trunkGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.16, 5);
  const crownGeo = new THREE.ConeGeometry(0.16, 0.34, 6);
  const glowGeo = new THREE.CircleGeometry(MESH_R * 1.72, 6);
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
  const motion = {
    uTime: waterMat.uniforms.uTime,
    uAmp: { value: reduced ? 0 : 1 },
    crowned: false,
    flagged: false,
  };
  const kit = createKit(motion);
  const life = createLife(scene, { motion, reduced });
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
  kit.geo("pine", new THREE.ConeGeometry(0.5, 1, 6));
  kit.geo("round", new THREE.IcosahedronGeometry(0.17, 0));
  kit.geo("frond", new THREE.ConeGeometry(0.05, 0.28, 3));
  kit.geo("flag", new THREE.PlaneGeometry(0.18, 0.1, 8, 1));
  const pathGeo = new THREE.PlaneGeometry(1, 1);
  pathGeo.rotateX(-Math.PI / 2);
  kit.geo("path", pathGeo);
  const hitGeo = new THREE.CylinderGeometry(MESH_R, MESH_R, 1.2, 6);
  hitGeo.rotateY(Math.PI / 6);
  const hitMat = new THREE.MeshBasicMaterial({ color: P.cffffff });
  const hitboxes = [];
  const itemHits = [];
  const itemHitGeo = new THREE.BoxGeometry(0.3, 0.78, 0.3);
  const itemHitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

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
    const itemHit = new THREE.Mesh(itemHitGeo, itemHitMat);
    itemHit.position.y = 0.36;
    itemHit.visible = false;
    itemHit.castShadow = false;
    itemHit.receiveShadow = false;
    itemHit.userData = { kind: "item", islandId: island.id, itemId: item.id };
    group.add(itemHit);
    itemHits.push(itemHit);
    if (!reduced) {
      group.scale.setScalar(0);
      group.visible = false;
    }
    parent.add(group);
    return {
      group,
      item,
      windows,
      recipe,
      show: 1,
      shown: reduced ? 1 : 0,
      spring: 1,
      sv: 0,
      wasAwake: false,
      wakeAge: null,
      flash: 0,
      baseGlow: 0,
    };
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
    group.userData.treeRecs = [];
    group.position.set(x, reduced ? 0 : -1.6, z);
    group.scale.setScalar(reduced ? 1 : 0.7);
    scene.add(group);

    const skirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.97, vertexColors: true });
    const coastMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, vertexColors: true });
    const landMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, map: groundMap(island) });
    const skirt = new THREE.Mesh(layerGeo(skirtGeo, P.skirtSoil, P.skirtSoil), skirtMat);
    skirt.position.y = 0.04;
    const coast = new THREE.Mesh(layerGeo(coastGeo, P.cliff, P.beach), coastMat);
    coast.position.y = 0.22;
    const top = new THREE.Mesh(topGeo, landMat);
    top.position.y = 0.37;
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
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.03;
    glow.renderOrder = 2;
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
    pinEl.className = reduced ? "pin" : "pin hold";
    pinEl.dataset.island = island.id;
    pinEl.innerHTML = `<button type="button"><b>${island.no}</b></button><em></em>`;
    const pinButton = pinEl.querySelector("button");
    const pinBadge = pinButton.querySelector("b");
    pinBadge.addEventListener("animationend", () => pinBadge.classList.remove("pop"));
    pinButton.querySelector("b").style.setProperty("--c", island.accent);
    pinButton.setAttribute("aria-label", island.nick);
    pinButton.addEventListener("pointerenter", () => {
      pinHover = island.id;
      hoverItem = null;
      people.setHover(-1);
      if (hotIndex >= 0) {
        hotIndex = -1;
        for (const threat of threats) threat.hot = false;
      }
      if (assignHover(island.id)) refresh();
      holdRender = Math.max(holdRender, 0.3);
    });
    pinButton.addEventListener("pointerleave", () => {
      if (pinHover === island.id) pinHover = null;
      if (hoverId === island.id) {
        assignHover(null);
        refresh();
        holdRender = Math.max(holdRender, 0.3);
      }
    });
    pinButton.addEventListener("click", (event) => {
      event.stopPropagation();
      pickCb({ kind: "island", islandId: island.id });
    });
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

    addKit(group, island, lamps, kit, life);
    addIslandDecor(group, island, kit, lamps, placed, spots.slice(0, island.items.length));
    group.traverse((child) => {
      if (!child.isMesh) return;
      if (!child.userData.kind) child.userData = { kind: "island", islandId: island.id };
      if (child.userData.kind === "island" && !pickables.includes(child)) pickables.push(child);
    });

    const hay = [island.name, island.nick, island.pin, island.blurb, island.blurbKid, island.source, ...island.items.flatMap((item) => [item.name, item.detail, item.kid, ...(item.keywords ?? [])])].join(" ");
    for (const item of island.items) item._hay = [item.name, item.detail, item.kid, ...(item.keywords ?? [])].join(" ");

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
      accent: new THREE.Color(island.accent),
      springY: 0,
      springV: 0,
      pulseT: null,
      pulseRing: null,
      fade: 1,
      fadeTarget: 1,
      awake: true,
      pinShown: Boolean(reduced),
      treeRecs: group.userData.treeRecs,
      introIndex: 0,
      base: new THREE.Vector3(x, 0.4, z),
      hay,
    });
  }

  const introOrder = [...views.values()].sort((a, b) => {
    const da = a.base.x * a.base.x + a.base.z * a.base.z;
    const db = b.base.x * b.base.x + b.base.z * b.base.z;
    if (Math.abs(da - db) > 1e-6) return da - db;
    return String(a.island.no).localeCompare(String(b.island.no));
  });
  introOrder.forEach((view, index) => {
    view.introIndex = index;
  });

  const FLOW_SPLIT = 63;
  const flowPaper = new THREE.Color("#fff7ea");
  let flowBright = 1;
  const flowViews = data.flows.map((flow, index) => {
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
    const bend = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((index % 2 === 0 ? 1 : -1) * Math.min(0.7, len * 0.12));
    mid.add(bend);
    mid.y += Math.min(1.3, 0.5 + len * 0.06);
    if (mid.y > 2.2) mid.y = 2.2;
    const softA = new THREE.Color(views.get(flow.a).island.accent).lerp(flowPaper, 0.25);
    const softB = new THREE.Color(views.get(flow.b).island.accent).lerp(flowPaper, 0.25);
    const tip = new THREE.Color(views.get(flow.b).island.accent);
    const geo = new LineGeometry();
    const mat = new LineMaterial({
      vertexColors: true,
      linewidth: 3,
      worldUnits: false,
      dashed: true,
      dashSize: 0.18,
      gapSize: 0.12,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const line = new Line2(geo, mat);
    line.visible = false;
    line.userData.kind = "flow";
    line.raycast = () => {};
    line.renderOrder = 3;
    scene.add(line);
    flow._hay = [flow.title, flow.kidTitle, flow.text, flow.kid, flow.carried, flow._alias, views.get(flow.a).island.name, views.get(flow.b).island.name, views.get(flow.a).island.nick, views.get(flow.b).island.nick].join(" ");
    return {
      flow,
      start,
      mid,
      end,
      len,
      softA,
      softB,
      tip,
      geo,
      mat,
      line,
      curve: new THREE.QuadraticBezierCurve3(start, mid.clone(), end),
      arch: 1,
      phase: "hidden",
      growT: 0,
      fadeT: 0,
      fadeFrom: 0,
      targetOpacity: 0,
      targetWidth: 1.5,
    };
  });

  function layoutRoute(route) {
    const mid = route.mid.clone();
    mid.y *= route.arch;
    const curve = new THREE.QuadraticBezierCurve3(route.start, mid, route.end);
    const pts = curve.getPoints(FLOW_SPLIT);
    const positions = new Float32Array(pts.length * 3);
    const colors = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i += 1) {
      positions[i * 3] = pts[i].x;
      positions[i * 3 + 1] = pts[i].y;
      positions[i * 3 + 2] = pts[i].z;
      const t = i / FLOW_SPLIT;
      const color = t >= 0.92 ? route.tip : route.softA.clone().lerp(route.softB, t);
      colors[i * 3] = Math.min(1, color.r * flowBright);
      colors[i * 3 + 1] = Math.min(1, color.g * flowBright);
      colors[i * 3 + 2] = Math.min(1, color.b * flowBright);
    }
    const drawn = Number.isFinite(route.geo.instanceCount) ? route.geo.instanceCount : 0;
    route.geo.setPositions(positions);
    route.geo.setColors(colors);
    route.line.computeLineDistances();
    route.geo.instanceCount = drawn;
    route.curve = curve;
  }
  for (const route of flowViews) layoutRoute(route);

  const skinHex = [P.cf0c7a4, P.cd9a57a, P.cc48a6a, P.c8d5a3c];
  let cargoOn = false;
  const TOOL_KEY = { clean: "toolClean", check: "toolCheck", shield: "toolShield", wash: "toolWash", finish: "toolFinish" };

  function anchorFront(mesh, yHead, nosePos) {
    const head = new THREE.Object3D();
    head.position.y = yHead;
    const nose = new THREE.Object3D();
    nose.position.copy(nosePos);
    mesh.add(head, nose);
    return { head, nose };
  }

  let minutes = 8 * 60 + 20;
  let phase = "all";
  let pillarSet = new Set();
  let query = "";
  let showAllFlows = false;
  let namesOn = true;
  let frozen = false;
  let bird = false;
  let hoverId = null;
  // Tick only when the pointer comes onto an island from empty space.
  function assignHover(next) {
    if (next === hoverId) return false;
    const prev = hoverId;
    hoverId = next;
    if (prev == null && next) playSfx("hover", next);
    return true;
  }
  let pinHover = null;
  let hoverItem = null;
  let hotItem = null;
  let selected = new Set();
  let elapsed = 0;
  const threats = [];
  const threatHits = [];
  const plateMarks = [];
  let platesDirty = false;
  const crews = [];
  const crewMarks = [];
  const handoffPops = [];
  const handoffAt = new Map();

  function poseThreat(threat) {
    threat.mesh.position.lerpVectors(threat.home, threat.halt, threat.u);
    const bob = actorsLive() ? Math.sin(elapsed * 1.15 + threat.phase) * 0.06 : 0;
    threat.mesh.position.y = threat.hover + bob;
    _threatDir.subVectors(threat.halt, threat.home);
    _threatDir.y = 0;
    if (_threatDir.lengthSq() > 1e-8) threat.mesh.rotation.y = Math.atan2(-_threatDir.x, -_threatDir.z);
    threat.mesh.updateWorldMatrix(true, true);
    platesDirty = true;
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
        if (!crew.applied) noteDefense(crew);
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
          noteDefense(crew);
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
          noteDefense(crew);
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
          noteDefense(crew);
          threat.fading = true;
        }
        crew.actDone = true;
      }
      return;
    }
    if (tool === "check") {
      if (crew.gate) crew.gate.visible = true;
      threat.hold = true;
      if (crew.t >= 0.4) {
        if (!crew.applied) noteDefense(crew);
        crew.actDone = true;
      }
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
      if (actorsLive() && elapsed > 0.7 && threat.dir > 0 && threat.u > 0.5) {
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
    mesh.scale.setScalar(1.15);
    mesh.visible = false;
    mesh.userData = { kind: "crew" };
    const skin = skinHex[crews.length % skinHex.length];
    const { head, nose } = anchorFront(mesh, 0.44, new THREE.Vector3(0, 0.43, -0.085));
    const fx = new THREE.Group();
    fx.visible = false;
    if (threat.tool === "shield") {
      const bubble = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.5, 1),
        new THREE.MeshBasicMaterial({ color: 0xe1992d, transparent: true, opacity: 0.35, depthWrite: false }),
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
        new THREE.MeshBasicMaterial({ color: 0x0e8a80, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
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
      skin,
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
    const threatIndex = threats.length;
    mesh.userData = { kind: "threat", threatIndex };
    mesh.scale.setScalar(scale);
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 / scale, 12, 10),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    hit.visible = false;
    hit.castShadow = false;
    hit.receiveShadow = false;
    mesh.add(hit);
    threatHits.push(hit);
    mesh.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
      child.userData.kind = "threat";
      child.userData.threatIndex = threatIndex;
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
    threat.rate0 = rate;
    threat.hit = hit;
    threat.hoverK = 1;
    threat.hot = false;
    threat.freeze = 0;
    threat.squashT = -1;
    threat.wobble = 0;
    threat.flash = 0;
    threat.coolUntil = 0;
    threat.hits = [];
    threat.sinking = false;
    threat.sinkT = 0;
    threat.rising = false;
    threat.riseT = 0;
    threat.away = 0;
    threat.playerPush = false;
    threat.taps = 0;
    threat.baseColors = mats.map((mat) => mat.color.clone());
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
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xffd0a8, roughness: 0.6, flatShading: true });
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
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 0.62, flatShading: true });
    const pale = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.55, flatShading: true });
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
      color: 0xdff3ff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.12,
      flatShading: true,
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
      { make: () => makeMosquito(), id: "dengue", tool: "clean", rate: 0.046, plate: "plateAedes" },
      { make: () => makeMosquito(), id: "border", tool: "check", rate: 0.04, plate: "plateAedes" },
      { make: () => makeVirus(0xd2694a), id: "flu", tool: "shield", rate: 0.038, plate: "plateFlu" },
      { make: () => makeVirus(0x5aa86a), id: "entero", tool: "wash", rate: 0.04, plate: "plateEntero" },
      { make: () => makeRod(), id: "tb", tool: "finish", rate: 0.034, plate: "plateTb" },
    ];
    roster.forEach((spec, index) => {
      const built = spec.make();
      const raid = approach(index, views.get(spec.id).base);
      addThreat(built.group, built.head, built.nose, raid.home, raid.halt, spec.rate, 1.1, spec.tool, spec.id);
      const threat = threats[threats.length - 1];
      const plateEl = document.createElement("div");
      plateEl.className = "threat-name";
      plateEl.dataset.plate = spec.plate;
      plateEl.textContent = t(spec.plate);
      const plate = new CSS2DObject(plateEl);
      plate.position.set(0, 0.85, 0);
      threat.mesh.add(plate);
      threat.plateEl = plateEl;
      plateMarks.push({ el: plateEl, key: spec.plate });
    });
    placeCrews();
  }

  const liftWhite = new THREE.Color(0xffffff);
  const toolKey = {
    clean: "toolClean",
    check: "toolCheck",
    shield: "toolShield",
    wash: "toolWash",
    finish: "toolFinish",
  };
  const sparkColor = {
    clean: 0x7ec8e0,
    wash: 0xffffff,
    shield: 0xe1992d,
    finish: 0x91bb70,
    check: 0x0e8a80,
  };
  const sparkGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false });
  const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, 16);
  sparks.frustumCulled = false;
  sparks.visible = false;
  sparks.castShadow = false;
  sparks.receiveShadow = false;
  scene.add(sparks);
  const sparkDummy = new THREE.Object3D();
  const sparkP = Array.from({ length: 16 }, () => new THREE.Vector3());
  const sparkV = Array.from({ length: 16 }, () => new THREE.Vector3());
  let sparkLife = 0;
  let shakeLeft = 0;
  const tipEl = document.createElement("div");
  tipEl.className = "threat-tip";
  const tipObj = new CSS2DObject(tipEl);
  tipObj.visible = false;
  scene.add(tipObj);
  let hotIndex = -1;
  const isleGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const isleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false });
  const isleBits = new THREE.InstancedMesh(isleGeo, isleMat, 10);
  isleBits.frustumCulled = false;
  isleBits.visible = false;
  isleBits.castShadow = false;
  isleBits.receiveShadow = false;
  scene.add(isleBits);
  const isleDummy = new THREE.Object3D();
  const isleP = Array.from({ length: 10 }, () => new THREE.Vector3());
  const isleV = Array.from({ length: 10 }, () => new THREE.Vector3());
  let isleLife = 0;
  const itemTipEl = document.createElement("div");
  itemTipEl.className = "item-tip";
  const itemTip = new CSS2DObject(itemTipEl);
  itemTip.visible = false;
  scene.add(itemTip);

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
  let dutyCb = () => {};
  let glowReady = false;
  const wakeQueue = [];
  const liveWakes = [];
  let markCb = () => {};
  let strikeCb = () => {};
  let repelCb = () => {};
  const people = createPeople({
    scene,
    renderer,
    camera,
    views,
    flows: data.flows,
    crews,
    onArrive: (event) => {
      flashHandoff(event.to, event.carried);
      playSfx("arrive");
      arriveCb(event);
    },
  });

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
  let personFocus = -1;
  let rush = 0;
  let overviewRadius = 28;
  let maxR = Math.max(48, overviewRadius * 1.25);
  const cam = { theta: 0.18, phi: 1.02, radius: overviewRadius, target: overviewTarget.clone() };
  const goal = { theta: cam.theta, radius: overviewRadius };
  let userPhi = cam.phi;
  const goalTarget = overviewTarget.clone();
  let flight = null;
  let coasting = false;
  let lastInput = performance.now();
  let celebrateCb = null;
  let ribbon = null;
  const ribbonDummy = new THREE.Object3D();
  function noteInput() { lastInput = performance.now(); }
  let pinchGesture = false;
  const orbitVel = { theta: 0, phi: 0 };

  function actorsLive(now = performance.now()) {
    if (reduced) return true;
    if (!introAt) return false;
    return now - introAt >= 2400;
  }

  function introClock(now = performance.now()) {
    if (reduced) return 10000;
    if (!introAt) return 0;
    return now - introAt;
  }

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
    const parked = !reduced && !introAt && !flight && !focusHalf && !zoomed;
    if (!zoomed && !parked) {
      if (bird) goal.radius = Math.min(maxR, overviewRadius + 8);
      else if (!focusHalf) goal.radius = overviewRadius;
      else goal.radius = Math.min(maxR, fitDistance(focusHalf.x, focusHalf.z));
    }
    applyViewOffset();
  }

  function stopCoast() {
    coasting = false;
    orbitVel.theta = 0;
    orbitVel.phi = 0;
  }

  function beginFlight(to, opts) {
    flight = {
      t0: performance.now(),
      dur: opts.duration,
      arc: Boolean(opts.arc),
      intro: Boolean(opts.intro),
      trackFit: Boolean(opts.trackFit),
      person: Boolean(opts.person),
      distance: opts.distance || 0,
      from: {
        theta: cam.theta,
        phi: cam.phi,
        radius: cam.radius,
        target: cam.target.clone(),
      },
      to: {
        theta: to.theta,
        phi: to.phi,
        radius: to.radius,
        target: to.target.clone(),
      },
    };
  }

  function finishCelebrate() {
    const cb = celebrateCb;
    celebrateCb = null;
    if (typeof cb === "function") cb();
  }

  function cancelFlight() {
    if (!flight) return;
    const celebrate = Boolean(flight.celebrate);
    flight = null;
    goal.theta = cam.theta;
    goal.radius = cam.radius;
    userPhi = cam.phi;
    goalTarget.copy(cam.target);
    if (celebrate) finishCelebrate();
  }

  function easeInOutSine(t) {
    const x = t < 0 ? 0 : t > 1 ? 1 : t;
    return -(Math.cos(Math.PI * x) - 1) / 2;
  }

  function stepFlight() {
    if (!flight) return;
    if (flight.person && personFocus >= 0) {
      const at = people.spot(personFocus);
      if (at) flight.to.target.set(at.x, at.y + 0.35, at.z);
    } else if (flight.intro) {
      flight.to.radius = overviewRadius;
      flight.to.target.copy(overviewTarget);
    } else if (flight.trackFit) {
      flight.to.radius = goal.radius;
      flight.to.target.copy(goalTarget);
    }
    const raw = (performance.now() - flight.t0) / Math.max(1, flight.dur);
    const done = raw >= 1;
    const e = done ? 1 : (flight.ease === "sine" ? easeInOutSine(raw) : easeInOutCubic(raw));
    const delta = flight.spin ? flight.to.theta - flight.from.theta : wrapAngle(flight.to.theta - flight.from.theta);
    const arc = !done && flight.arc ? Math.sin(Math.PI * e) * Math.min(6, flight.distance * 0.4) : 0;
    cam.theta = flight.from.theta + delta * e;
    cam.phi = THREE.MathUtils.clamp(flight.from.phi + (flight.to.phi - flight.from.phi) * e, 0.32, 1.22);
    cam.radius = flight.from.radius + (flight.to.radius - flight.from.radius) * e + arc;
    cam.target.lerpVectors(flight.from.target, flight.to.target, e);
    goal.theta = cam.theta;
    userPhi = cam.phi;
    if (!done) return;
    const celebrate = Boolean(flight.celebrate);
    cam.radius = flight.to.radius;
    cam.phi = THREE.MathUtils.clamp(flight.to.phi, 0.32, 1.22);
    cam.theta = flight.from.theta + delta;
    cam.target.copy(flight.to.target);
    goal.theta = cam.theta;
    goal.radius = cam.radius;
    userPhi = cam.phi;
    goalTarget.copy(cam.target);
    flight = null;
    if (celebrate) finishCelebrate();
  }

  function frameWide() {
    focusHalf = null;
    zoomed = false;
    personFocus = -1;
    stopCoast();
    goalTarget.copy(overviewTarget);
    applyFit();
    const endPhi = bird ? 0.58 : userPhi;
    const dist = Math.hypot(
      cam.target.x - goalTarget.x,
      cam.target.y - goalTarget.y,
      cam.target.z - goalTarget.z,
      (goal.radius - cam.radius) * 0.5,
    );
    if (dist < 0.05 && Math.abs(endPhi - cam.phi) < 0.02 && !flight) {
      cam.phi = endPhi;
      userPhi = endPhi;
      cam.radius = goal.radius;
      cam.target.copy(goalTarget);
      goal.theta = cam.theta;
      return;
    }
    beginFlight({
      theta: cam.theta,
      phi: endPhi,
      radius: goal.radius,
      target: goalTarget.clone(),
    }, { duration: 900, distance: dist, arc: true, trackFit: true });
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
    let x = cam.target.x + cam.radius * sp * Math.sin(cam.theta);
    let y = cam.target.y + cam.radius * Math.cos(cam.phi);
    let z = cam.target.z + cam.radius * sp * Math.cos(cam.theta);
    let lx = cam.target.x;
    let ly = cam.target.y;
    let lz = cam.target.z;
    if (shakeLeft > 0) {
      const amp = 0.08 * (shakeLeft / 0.25);
      x += (Math.random() - 0.5) * 2 * amp;
      y += (Math.random() - 0.5) * 2 * amp;
      z += (Math.random() - 0.5) * 2 * amp;
      lx += (Math.random() - 0.5) * 2 * amp;
      ly += (Math.random() - 0.5) * 2 * amp;
      lz += (Math.random() - 0.5) * 2 * amp;
    }
    const look = camera.userData;
    if (shakeLeft <= 0 && camera.position.x === x && camera.position.y === y && camera.position.z === z
      && look._lx === lx && look._ly === ly && look._lz === lz) return;
    look._lx = lx;
    look._ly = ly;
    look._lz = lz;
    camera.position.set(x, y, z);
    camera.lookAt(lx, ly, lz);
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

  function poseRing(view) {
    if (view.flashT != null) return;
    const picked = selected.has(view.island.id);
    view.ring.visible = picked || view.hover > 0.04;
    view.ring.material.opacity = picked ? 0.96 : view.hover * 0.55;
    view.ring.scale.setScalar(1);
  }

  function refresh() {
    for (const view of views.values()) {
      const kind = queryKind(view);
      const on = Boolean(kind) && pillarOk(view.island) && (phase === "all" || view.island.items.some((item) => phaseOk(item.phase)));
      view.lit = on;
      view.group.userData.lit = on;
      view.fadeTarget = on ? 1 : 0.14;
      if (view.fadeTarget < 1 || view.fade < 0.999) {
        for (const mat of [view.coastMat, view.landMat, view.skirtMat]) {
          mat.transparent = true;
          mat.depthWrite = false;
        }
      }
      for (const building of view.buildings) {
        const itemHit = !query || kind !== "item" || norm(building.item._hay).includes(query);
        building.show = on && phaseOk(building.item.phase) && itemHit ? 1 : 0;
      }
      poseRing(view);
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
    const starsOn = flowBright > 1;
    let wave = 0;
    for (const route of flowViews) {
      const forced = Boolean(query) && norm(route.flow._hay).includes(query);
      const related = hoverId === route.flow.a || hoverId === route.flow.b
        || [...selected].some((id) => id === route.flow.a || id === route.flow.b);
      const ends = Boolean(views.get(route.flow.a).lit && views.get(route.flow.b).lit);
      const focusing = selected.size > 0;
      const want = Boolean(ends && (showAllFlows || related || forced) && !(focusing && !related && !forced));
      const arch = focusing && (related || forced) ? 0.6 : 1;
      if (arch !== route.arch) {
        route.arch = arch;
        layoutRoute(route);
      }
      let opacity = 0;
      let width = 1.5;
      if (want) {
        if (hoverId || focusing) {
          opacity = related || forced ? 1 : 0.06;
          width = related || forced ? 3 : 1.5;
        } else {
          opacity = 0.18;
          width = 1.5;
        }
        if (starsOn && opacity >= 0.18) opacity = 1;
      }
      route.targetOpacity = opacity;
      route.targetWidth = width;
      if (want && route.phase === "hidden") {
        route.phase = "grow";
        route.growT = -wave * 0.06;
        wave += 1;
        route.line.visible = true;
        route.geo.instanceCount = 0;
      } else if (want && route.phase === "fade") {
        route.phase = "shown";
        route.line.visible = true;
        route.geo.instanceCount = FLOW_SPLIT;
      } else if (!want && (route.phase === "grow" || route.phase === "shown")) {
        route.phase = "fade";
        route.fadeT = 0;
        route.fadeFrom = route.mat.opacity;
      }
    }
  }

  function pumpWakes() {
    while (liveWakes.length < 3 && wakeQueue.length) {
      const job = wakeQueue.shift();
      const el = document.createElement("div");
      el.className = "wake-label";
      el.textContent = job.name;
      const obj = new CSS2DObject(el);
      obj.position.set(0, 0.95, 0);
      job.building.group.add(obj);
      liveWakes.push({ obj, el, name: job.name, age: 0 });
    }
  }

  function enqueueWake(building, name) {
    wakeQueue.push({ building, name });
    pumpWakes();
  }

  function stepWakes(step) {
    let changed = false;
    for (let i = liveWakes.length - 1; i >= 0; i -= 1) {
      const job = liveWakes[i];
      job.age += step;
      if (job.age < 1.6) continue;
      job.obj.removeFromParent();
      job.el.remove();
      liveWakes.splice(i, 1);
      changed = true;
    }
    if (changed) pumpWakes();
  }

  function wakeFactor(age) {
    if (age == null) return 1;
    const u = age / 0.26;
    if (u >= 1) return 1;
    const up = u <= 0.5 ? easeOutBack(u / 0.5) : 1;
    const down = u <= 0.5 ? 1 : 1 - (u - 0.5) / 0.5;
    return 1 + 0.18 * up * down;
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
    fill.intensity = look.fillI;
    waterMat.uniforms.deepColor.value.copy(look.deep);
    waterMat.uniforms.shallowColor.value.copy(look.shallow);
    waterMat.uniforms.foamColor.value.copy(look.foam);
    waterMat.uniforms.stars.value = look.stars;
    environment.setTime(look);
    sun.intensity = look.key;
    sun.color.copy(look.sun);
    skyMat.uniforms.sunColor.value.copy(look.sun);
    const liveX = look.sunPos.x;
    const liveY = look.sunPos.y;
    const liveZ = look.sunPos.z;
    const night = look.night;
    fill.position.set(-liveX, 8, -liveZ);
    const qHour = THREE.MathUtils.clamp(Math.round(hour * 6) / 6, 0, 24);
    const qPos = lookAtHour(qHour).sunPos;
    const az = Math.atan2(qPos.x, qPos.z);
    const horiz = Math.hypot(liveX, liveZ);
    sun.position.set(Math.sin(az) * horiz, liveY, Math.cos(az) * horiz);
    skySunDir.copy(sun.position).normalize();
    const elev = skySunDir.y;
    skyMat.uniforms.sunAmt.value = night > 0.5 ? 0.9 : THREE.MathUtils.clamp(elev + 0.45, 0.35, 1);
    waterMat.uniforms.sunColor.value.copy(skyMat.uniforms.sunColor.value);
    waterMat.uniforms.sunAmt.value = skyMat.uniforms.sunAmt.value;
    stars.material.opacity = night * 0.9;
    const nextBright = look.stars > 0.5 ? 1.15 : 1;
    if (nextBright !== flowBright) {
      flowBright = nextBright;
      for (const route of flowViews) layoutRoute(route);
      refresh();
    }
    paintGlow();
    renderer.shadowMap.needsUpdate = true;
  }

  function paintGlow() {
    const hour = minutes / 60;
    const night = lookAtHour(hour).night;
    kit.glowMat.emissiveIntensity = 1;
    for (const lamp of lamps) {
      lamp.glowAmount = lamp.role === "lighthouse" ? night * 4 : night * 1.4;
    }
    for (const view of views.values()) {
      const active = view.buildings.some((building) => building.group.visible && hourCovers(building.item.hours, hour));
      const disc = view.glow.material;
      disc.color.set(night > 0.5 ? 0xffcf8a : view.island.accent);
      disc.opacity = active ? 0.12 + night * 0.28 : 0;
      view.glow.visible = disc.opacity > 0.02;
      let islandAwake = false;
      for (const building of view.buildings) {
        const covers = hourCovers(building.item.hours, hour);
        if (covers) islandAwake = true;
        if (!glowReady) building.wasAwake = covers;
        else if (covers && !building.wasAwake) {
          building.wasAwake = true;
          if (!reduced) {
            building.wakeAge = 0;
            building.flash = 1;
          }
          enqueueWake(building, building.item.name);
          dutyCb({ islandId: view.island.id, item: building.item.name });
        } else if (!covers) building.wasAwake = false;
        const shown = building.group.visible && covers;
        const amount = shown ? 0.1 + night * 3.2 : night * 0.25;
        building.baseGlow = amount;
        const lift = building.flash > 0 ? 2 * building.flash : 0;
        for (const win of building.windows) win.glowAmount = Math.max(amount, lift);
      }
      view.awake = islandAwake;
    }
    glowReady = true;
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
    for (const route of flowViews) route.mat.resolution.set(W, H);
    applyFit();
  }

  function easeOutElastic(amount) {
    if (amount <= 0) return 0;
    if (amount >= 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return 2 ** (-10 * amount) * Math.sin((amount * 10 - 0.75) * c4) + 1;
  }

  function noteDefense(crew) {
    crew.applied = true;
    const threat = crew.threat;
    if (threat.playerPush) {
      threat.playerPush = false;
      return;
    }
    threat.u = Math.max(threat.floor, threat.u - 0.16);
  }

  function parkThreat(threat) {
    threat.sinking = false;
    threat.fading = false;
    threat.gone = true;
    threat.away = 20;
    threat.hot = false;
    if (hotIndex === threats.indexOf(threat)) hotIndex = -1;
    threat.mesh.visible = false;
    setThreatOpacity(threat, 0);
  }

  function startRise(threat) {
    threat.gone = false;
    threat.rising = true;
    threat.riseT = 0;
    threat.u = threat.floor;
    threat.dir = 1;
    threat.slow = 1;
    threat.hold = false;
    threat.cleans = 0;
    threat.rate = threat.rate0;
    threat.fadeT = 0;
    threat.hits = [];
    threat.playerPush = false;
    setThreatOpacity(threat, 0);
    threat.mesh.visible = true;
  }

  function beginSink(threat) {
    threat.dir = 0;
    threat.hot = false;
    if (reduced) {
      parkThreat(threat);
      return;
    }
    threat.sinking = true;
    threat.sinkT = 0;
  }

  function burstAt(threat) {
    sparkMat.color.setHex(sparkColor[threat.tool] || 0xffffff);
    sparkMat.opacity = 1;
    sparkLife = 0.6;
    sparks.visible = true;
    const origin = threat.mesh.position;
    for (let i = 0; i < 16; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 1.5 + Math.random() * 1.5;
      sparkV[i].set(
        Math.sin(phi) * Math.cos(theta),
        Math.abs(Math.cos(phi)) * 0.35,
        Math.sin(phi) * Math.sin(theta),
      ).multiplyScalar(speed);
      sparkP[i].copy(origin);
    }
  }

  function kickShake() {
    if (reduced) return;
    shakeLeft = 0.25;
  }

  function placeTip() {
    const threat = threats[hotIndex];
    if (!threat || threat.gone || !threat.mesh.visible) {
      tipObj.visible = false;
      return;
    }
    tipEl.textContent = t("threatTip", { action: t(toolKey[threat.tool] || "toolClean") });
    threat.mesh.getWorldPosition(tipObj.position);
    tipObj.position.y += 0.62;
    tipObj.visible = true;
  }

  function applyLook(threat, step) {
    const hoverTarget = threat.hot ? 1.12 : 1;
    threat.hoverK = THREE.MathUtils.damp(threat.hoverK, hoverTarget, 12, step);
    let xz = 1;
    let y = 1;
    if (!reduced && threat.squashT >= 0) {
      const k = easeOutElastic(Math.min(1, threat.squashT / 0.32));
      xz = 1.3 + (1 - 1.3) * k;
      y = 0.7 + (1 - 0.7) * k;
      threat.squashT += step;
      if (threat.squashT >= 0.32) threat.squashT = -1;
    }
    const fitted = threat.scale0 * threat.hoverK;
    threat.mesh.scale.set(fitted * xz, fitted * y, fitted * xz);
    if (threat.flash > 0) threat.flash = Math.max(0, threat.flash - step);
    const lift = threat.hot ? 0.2 : (threat.flash > 0 ? 0.2 * (threat.flash / 0.3) : 0);
    threat.mats.forEach((mat, index) => {
      const base = threat.baseColors[index];
      if (!base || !mat.color) return;
      mat.color.copy(base);
      if (lift > 0) mat.color.lerp(liftWhite, lift);
    });
    if (threat.wobble > 0) {
      threat.mesh.position.x += Math.sin(threat.wobble * 84) * 0.06;
      threat.wobble = Math.max(0, threat.wobble - step);
    }
  }

  function stepThreats(step) {
    if (shakeLeft > 0) shakeLeft = Math.max(0, shakeLeft - step);
    if (sparkLife > 0) {
      sparkLife = Math.max(0, sparkLife - step);
      const fade = sparkLife / 0.6;
      sparkMat.opacity = fade;
      for (let i = 0; i < 16; i += 1) {
        sparkV[i].y -= 6 * step;
        sparkP[i].addScaledVector(sparkV[i], step);
        sparkDummy.position.copy(sparkP[i]);
        sparkDummy.scale.setScalar(fade > 0 ? 1 : 0);
        sparkDummy.updateMatrix();
        sparks.setMatrixAt(i, sparkDummy.matrix);
      }
      sparks.instanceMatrix.needsUpdate = true;
      sparks.visible = sparkLife > 0;
    }
    for (const threat of threats) {
      if (threat.away > 0) {
        threat.away = Math.max(0, threat.away - step);
        if (threat.away <= 0) startRise(threat);
        else continue;
      }
      if (threat.sinking) {
        threat.sinkT += step;
        const k = Math.min(1, threat.sinkT / 0.7);
        setThreatOpacity(threat, 1 - k);
        if (k >= 1) {
          parkThreat(threat);
          continue;
        }
      } else if (threat.fading && !threat.gone) {
        threat.fadeT += step;
        const k = Math.min(1, threat.fadeT / 0.8);
        setThreatOpacity(threat, (1 - k) ** 3);
        if (k >= 1) {
          parkThreat(threat);
          continue;
        }
      }
      if (!threat.gone && !threat.sinking && !reduced && actorsLive()) {
        if (threat.freeze > 0) threat.freeze = Math.max(0, threat.freeze - step);
        else {
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
      }
      if (threat.rising) {
        threat.riseT += step;
        const k = Math.min(1, threat.riseT / 0.9);
        setThreatOpacity(threat, k);
        if (k >= 1) threat.rising = false;
      }
      if (threat.gone) continue;
      poseThreat(threat);
      if (threat.sinking) {
        const k = Math.min(1, threat.sinkT / 0.7);
        threat.mesh.position.y = THREE.MathUtils.lerp(threat.hover, -1.2, k);
      } else if (threat.rising) {
        const k = Math.min(1, threat.riseT / 0.9);
        threat.mesh.position.y = THREE.MathUtils.lerp(-1.2, threat.hover, k);
      }
      applyLook(threat, step);
    }
    if (!reduced) {
      for (const crew of crews) stepCrew(crew, step);
    }
    placeTip();
  }

  function strike(threat) {
    if (!threat || threat.gone || threat.sinking || threat.away > 0) return;
    threat.taps += 1;
    const now = performance.now();
    if (now < threat.coolUntil) {
      threat.wobble = 0.15;
      holdRender = Math.max(holdRender, 0.2);
      return;
    }
    threat.coolUntil = now + 600;
    threat.freeze = 0.08;
    threat.playerPush = true;
    threat.hold = false;
    threat.dir = -1;
    threat.u = Math.max(threat.floor, threat.u - 0.26);
    const crew = crews.find((item) => item.threat === threat);
    if (crew && crew.phase === "wait") {
      crew.phase = "run";
      crew.t = 0;
      crew.applied = false;
      crew.actDone = false;
      crew.mesh.visible = true;
      crew.labelAnchor.visible = true;
    }
    if (reduced) threat.flash = 0.3;
    else {
      threat.squashT = 0;
      burstAt(threat);
      kickShake();
    }
    threat.hits.push(now);
    threat.hits = threat.hits.filter((stamp) => now - stamp <= 8000);
    const routed = threat.hits.length >= 3;
    if (routed) {
      threat.hits = [];
      beginSink(threat);
    }
    const info = {
      index: threats.indexOf(threat),
      islandId: threat.islandId,
      tool: threat.tool,
      routed,
    };
    playSfx("hit");
    strikeCb(info);
    if (routed) {
      playSfx("repel");
      repelCb({ islandId: threat.islandId, tool: threat.tool, routed: true });
    }
    holdRender = Math.max(holdRender, 0.45);
  }

  function poseIslandTrees(view, clock) {
    if (!view.treeRecs.length) return;
    const landStart = 200 + view.introIndex * 70;
    const groups = new Map();
    for (const rec of view.treeRecs) {
      const slot = rec.treeSlot ?? 0;
      const list = groups.get(slot);
      if (list) list.push(rec);
      else groups.set(slot, [rec]);
    }
    let index = 0;
    for (const slot of [...groups.keys()].sort((a, b) => a - b)) {
      const start = landStart + 680 + index * 40;
      index += 1;
      let mul = 1;
      if (!reduced && (!introAt || clock < start)) mul = 0;
      else if (!reduced && clock < start + 380) mul = Math.max(0, easeOutBack((clock - start) / 380, 2));
      for (const rec of groups.get(slot)) rec.scaleMul = mul;
    }
  }

  function tick(dt) {
    const step = Math.min(dt, 0.05);
    easeSafe(step);
    if (!frozen) elapsed += step;
    const hoverK = 1 - Math.exp(-step * 14);
    const clock = introClock();
    let islandBusy = false;
    let glowPulse = false;
    stepWakes(step);
    if (liveWakes.length || wakeQueue.length) islandBusy = true;
    for (const view of views.values()) {
      const landStart = 200 + view.introIndex * 70;
      let isleE = 1;
      if (!reduced && (!introAt || clock < landStart)) isleE = 0;
      else if (!reduced && clock < landStart + 600) isleE = easeOutBack((clock - landStart) / 600, 1.6);
      const want = hoverId === view.island.id || selected.has(view.island.id) ? 1 : 0;
      view.hover += (want - view.hover) * hoverK;
      view.springY += view.springV * step;
      view.springV += (-220 * view.springY - 14 * view.springV) * step;
      if (Math.abs(view.springY) < 0.0004 && Math.abs(view.springV) < 0.008) {
        view.springY = 0;
        view.springV = 0;
      } else islandBusy = true;
      const lift = -1.6 * (1 - isleE) + view.hover * 0.28 + view.springY;
      if (view.group.position.y !== lift) view.group.position.y = lift;
      const grown = (0.7 + 0.3 * isleE) * (1 + view.hover * 0.035);
      if (view.group.scale.x !== grown) view.group.scale.setScalar(grown);
      if (!view.pinShown && (reduced || (introAt && clock >= landStart + 600))) {
        view.pinShown = true;
        view.pinEl.classList.remove("hold");
        if (!reduced) view.pinEl.querySelector("b")?.classList.add("pop");
      }
      poseIslandTrees(view, clock);
      const span = 0.86;
      const fadeStep = span * (step / 0.25);
      const fadeDelta = view.fadeTarget - view.fade;
      if (Math.abs(fadeDelta) <= fadeStep) view.fade = view.fadeTarget;
      else view.fade += Math.sign(fadeDelta) * fadeStep;
      if (Math.abs(view.fade - view.fadeTarget) > 0.001) islandBusy = true;
      for (const mat of [view.coastMat, view.landMat, view.skirtMat]) {
        if (view.fade >= 0.999 && view.fadeTarget >= 1) {
          mat.transparent = false;
          mat.depthWrite = true;
          mat.opacity = 1;
        } else {
          mat.transparent = true;
          mat.depthWrite = false;
          mat.opacity = view.fade;
        }
      }
      view.landMat.color.setRGB(1, 1, 1);
      if (!view.awake) mixHex(view.landMat.color, ASLEEP, 0.3, view.landMat.color);
      view.landMat.color.lerp(view.accent, view.hover * 0.12);
      poseRing(view);
      if (view.pulseT != null && view.pulseRing) {
        islandBusy = true;
        view.pulseT += step;
        const k = Math.min(1, view.pulseT / 0.45);
        const e = 1 - (1 - k) ** 3;
        view.pulseRing.scale.setScalar(reduced ? 1 : 1 + 0.45 * e);
        view.pulseRing.material.opacity = 0.9 * (1 - (reduced ? k : e));
        if (k >= 1) {
          view.pulseRing.material.dispose();
          view.pulseRing.removeFromParent();
          view.pulseRing = null;
          view.pulseT = null;
        }
      }
      view.buildings.forEach((building, index) => {
        const bStart = landStart + 680 + index * 40;
        let presence;
        if (!reduced && (!introAt || clock < bStart)) {
          building.shown = 0;
          presence = 0;
        } else if (!reduced && clock < bStart + 380) {
          const u = (clock - bStart) / 380;
          building.shown = building.show > 0 ? Math.min(1, u) : 0;
          presence = building.show > 0 ? Math.max(0, easeOutBack(u, 2)) : 0;
        } else {
          building.shown = damp(building.shown, building.show, step, 14);
          presence = building.shown <= 0.001 ? 0 : easeOutBack(Math.min(1, Math.max(0, building.shown)));
        }
        const springTarget = building.item.id === hoverItem || building.item.id === hotItem ? 1.15 : 1;
        building.sv += (springTarget - building.spring) * 220 * step;
        building.sv *= Math.exp(-18 * step);
        building.spring += building.sv * step;
        if (Math.abs(building.spring - springTarget) < 0.0004 && Math.abs(building.sv) < 0.0008) {
          building.spring = springTarget;
          building.sv = 0;
        } else islandBusy = true;
        if (building.wakeAge != null) {
          building.wakeAge += step;
          if (building.wakeAge >= 0.26) building.wakeAge = null;
          else islandBusy = true;
        }
        if (building.flash > 0) {
          building.flash = Math.max(0, building.flash - step / 0.26);
          const lift = 2 * building.flash;
          for (const win of building.windows) win.glowAmount = Math.max(building.baseGlow, lift);
          islandBusy = true;
          glowPulse = true;
        }
        const wakeMul = reduced ? 1 : wakeFactor(building.wakeAge);
        const scale = Math.max(0, presence * building.spring * wakeMul);
        if (Math.abs(building.group.scale.x - scale) > 0.0001) {
          building.group.scale.setScalar(scale);
          islandBusy = true;
        }
        const visible = scale >= 0.01;
        if (building.group.visible !== visible) building.group.visible = visible;
      });
    }
    if (glowPulse) kit.touch();
    const riseU = waterMat.uniforms.isleRise.value;
    let riseI = 0;
    for (const view of views.values()) {
      riseU[riseI] = view.group.position.y < -0.2 ? 0 : 1;
      riseI += 1;
    }
    if (!frozen && !reduced) waterMat.uniforms.uTime.value = elapsed;
    if (!frozen) environment.update(step, { hold: reduced });
    life.step(step, { live: !reduced && !frozen, night: lookAtHour(minutes / 60).night });
    stepRibbons();
    const idleFor = (performance.now() - lastInput) / 1000;
    const orbitQuiet = pointers.size === 0 && selected.size === 0 && personFocus < 0 && !flight && !coasting;
    if (!reduced && !frozen && orbitQuiet && idleFor >= 6) goal.theta += step * 0.025;
    if (!frozen) stepThreats(step);
    if (!frozen && !reduced) stepIsleBits(step);
    if (personFocus >= 0 && !flight) {
      const at = people.spot(personFocus);
      if (at) goalTarget.set(at.x, at.y + 0.35, at.z);
    }
    if (flight) stepFlight();
    else if (coasting && pointers.size === 0) {
      goal.theta += orbitVel.theta * step;
      userPhi = THREE.MathUtils.clamp(userPhi + orbitVel.phi * step, 0.32, 1.22);
      const decay = Math.exp(-step * 4.5);
      orbitVel.theta *= decay;
      orbitVel.phi *= decay;
      if (Math.abs(orbitVel.theta) < 0.001 && Math.abs(orbitVel.phi) < 0.001) {
        orbitVel.theta = 0;
        orbitVel.phi = 0;
        coasting = false;
      }
      cam.theta = goal.theta;
      cam.phi = userPhi;
      cam.radius = goal.radius;
      cam.target.copy(goalTarget);
    } else if (pointers.size || !zoomed) {
      const phiGoal = bird ? 0.58 : userPhi;
      cam.theta = goal.theta;
      cam.phi = phiGoal;
      cam.radius = goal.radius;
      cam.target.copy(goalTarget);
    } else {
      const phiGoal = bird ? 0.58 : userPhi;
      const easeSpeed = rush > 0 ? 8 : (reduced ? 28 : 3.4);
      if (rush > 0) rush = Math.max(0, rush - step);
      const k = 1 - Math.exp(-step * easeSpeed);
      const dTheta = wrapAngle(goal.theta - cam.theta);
      const dPhi = phiGoal - cam.phi;
      const dRadius = goal.radius - cam.radius;
      const dTarget = cam.target.distanceTo(goalTarget);
      if (Math.abs(dTheta) < 1e-4 && Math.abs(dPhi) < 1e-4 && Math.abs(dRadius) < 1e-3 && dTarget < 1e-3) {
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
    }
    placeCamera();
    scene.fog.density = 0.32 / cam.radius;
    people.update(step, { frozen: frozen || !actorsLive(), reduced, cargoOn, camera, present: actorsLive() });
    const bubbleSize = viewSize();
    people.placeBubbles(camera, bubbleSize.W, bubbleSize.H);
    if (!frozen) {
      for (const route of flowViews) {
        if (!reduced && route.line.visible) route.mat.uniforms.dashOffset.value -= step * 0.6;
        if (route.phase === "grow") {
          route.growT += step;
          const u = Math.min(1, Math.max(0, route.growT / 0.55));
          const eased = 1 - (1 - u) ** 3;
          route.geo.instanceCount = Math.round(eased * FLOW_SPLIT);
          route.mat.opacity = route.targetOpacity;
          route.mat.linewidth = route.targetWidth;
          if (u >= 1) route.phase = "shown";
        } else if (route.phase === "fade") {
          route.fadeT += step;
          const u = Math.min(1, route.fadeT / 0.2);
          route.mat.opacity = route.fadeFrom * (1 - u);
          if (u >= 1) {
            route.phase = "hidden";
            route.line.visible = false;
            route.geo.instanceCount = 0;
            route.mat.opacity = 0;
          }
        } else if (route.phase === "shown") {
          route.mat.opacity = route.targetOpacity;
          route.mat.linewidth = route.targetWidth;
        }
      }
    }
    stepHandoffs(frozen ? 0 : step);
    hoverTick = (hoverTick + 1) % 2;
    if (hoverSample && hoverTick === 0 && pointers.size === 0) {
      const picked = pickHit(hoverSample);
      if (pinHover) {
        people.setHover(-1);
        hoverItem = null;
        if (hotIndex >= 0) {
          hotIndex = -1;
          for (const threat of threats) threat.hot = false;
        }
        if (assignHover(pinHover)) {
          refresh();
          holdRender = Math.max(holdRender, 0.3);
        }
        canvas.style.cursor = "pointer";
      } else if (picked?.kind === "threat") {
        people.setHover(-1);
        hoverItem = null;
        if (assignHover(null)) refresh();
        if (hotIndex !== picked.index) holdRender = 0.3;
        hotIndex = picked.index;
        for (const threat of threats) threat.hot = threats[hotIndex] === threat;
        canvas.style.cursor = "crosshair";
      } else if (picked?.kind === "person") {
        people.setHover(picked.index);
        hoverItem = null;
        if (hotIndex >= 0) holdRender = 0.3;
        hotIndex = -1;
        for (const threat of threats) threat.hot = false;
        if (assignHover(null)) {
          refresh();
          holdRender = 0.3;
        }
        canvas.style.cursor = "pointer";
      } else if (picked?.kind === "item") {
        people.setHover(-1);
        if (hotIndex >= 0) holdRender = 0.3;
        hotIndex = -1;
        for (const threat of threats) threat.hot = false;
        if (hoverItem !== picked.itemId || hoverId !== picked.islandId) {
          hoverItem = picked.itemId;
          assignHover(picked.islandId);
          refresh();
          holdRender = Math.max(holdRender, 0.3);
        }
        canvas.style.cursor = "pointer";
      } else {
        people.setHover(-1);
        if (hotIndex >= 0) holdRender = 0.3;
        hotIndex = -1;
        for (const threat of threats) threat.hot = false;
        const id = picked?.kind === "island" ? picked.islandId : null;
        if (id !== hoverId || hoverItem) {
          hoverItem = null;
          assignHover(id);
          refresh();
          holdRender = 0.3;
        }
        canvas.style.cursor = id ? "pointer" : "grab";
      }
    }
    placeItemTip();
    const introLive = !reduced && (!introAt || performance.now() - introAt < 2700);
    const moving = Math.abs(wrapAngle(goal.theta - cam.theta)) > 0.002
      || Math.abs((bird ? 0.58 : userPhi) - cam.phi) > 0.002
      || Math.abs(goal.radius - cam.radius) > 0.03
      || cam.target.distanceTo(goalTarget) > 0.03
      || safeT < 1
      || shakeLeft > 0
      || sparkLife > 0
      || isleLife > 0
      || islandBusy
      || coasting
      || Boolean(flight)
      || Boolean(ribbon)
      || introLive;
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
    if (platesDirty) {
      platesDirty = false;
      return false;
    }
    if (liveWakes.length) {
      labelForce = true;
      return false;
    }
    if (tipObj.visible || itemTip.visible || hotIndex >= 0) return false;
    if (people.bubblesOn() || handoffPops.length) {
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
        poseRing(view);
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

  function personNear(personHit, islandHit) {
    if (!personHit) return false;
    if (!islandHit?.point) return true;
    const at = people.spot(personHit.index);
    if (!at) return false;
    const dx = islandHit.point.x - at.x;
    const dy = islandHit.point.y - at.y;
    const dz = islandHit.point.z - at.z;
    return dx * dx + dy * dy + dz * dz < 4.84;
  }

  function pickThreat() {
    const roots = [];
    for (const threat of threats) {
      if (threat.gone || threat.sinking || !threat.mesh.visible || !threat.hit) continue;
      roots.push(threat.hit);
    }
    const hits = raycaster.intersectObjects(roots, false);
    for (const hit of hits) {
      let node = hit.object;
      while (node) {
        if (node.userData && node.userData.kind === "threat" && node.userData.threatIndex != null) {
          return node.userData.threatIndex;
        }
        node = node.parent;
      }
    }
    return -1;
  }

  function pickHit(event) {
    const point = ndc(event);
    raycaster.far = Infinity;
    raycaster.setFromCamera(point, camera);
    const threatIndex = pickThreat();
    if (threatIndex >= 0) return { kind: "threat", index: threatIndex };
    const personHit = people.pick(raycaster);
    const islandHit = raycaster.intersectObjects(hitboxes, false)[0];
    if (personNear(personHit, islandHit)) return { kind: "person", index: personHit.index };
    const itemHit = pickItem();
    if (itemHit) return itemHit;
    const islandId = islandHit?.object.userData.islandId;
    return islandId ? { kind: "island", islandId } : null;
  }

  function pickItem() {
    const hits = raycaster.intersectObjects(itemHits, false);
    for (const hit of hits) {
      const host = hit.object.parent;
      if (host && host.visible === false) continue;
      const data = hit.object.userData;
      if (data?.kind !== "item") continue;
      return { kind: "item", islandId: data.islandId, itemId: data.itemId };
    }
    return null;
  }

  canvas.addEventListener("pointerdown", (event) => {
    noteInput();
    cancelFlight();
    stopCoast();
    goal.theta = cam.theta;
    goal.radius = cam.radius;
    userPhi = cam.phi;
    goalTarget.copy(cam.target);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, d: 0, t: performance.now() });
    dragged = 0;
    if (pointers.size >= 2) pinchGesture = true;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (event) => {
    const prev = pointers.get(event.pointerId);
    if (!prev) {
      hoverSample = { clientX: event.clientX, clientY: event.clientY };
      return;
    }
    const now = performance.now();
    const dt = Math.max(1 / 120, (now - (prev.t || now)) / 1000);
    prev.t = now;
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    prev.x = event.clientX;
    prev.y = event.clientY;
    prev.d += Math.abs(dx) + Math.abs(dy);
    dragged += Math.abs(dx) + Math.abs(dy);
    if (pointers.size >= 2) {
      pinchGesture = true;
      orbitVel.theta = 0;
      orbitVel.phi = 0;
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (prev.pinch) {
        goal.radius = THREE.MathUtils.clamp(cam.radius * (prev.pinch / dist), 8, maxR);
        cam.radius = goal.radius;
        zoomed = true;
      }
      for (const item of pointers.values()) item.pinch = dist;
      return;
    }
    const dTheta = -dx * 0.0052;
    const dPhi = -dy * 0.0036;
    goal.theta += dTheta;
    userPhi = THREE.MathUtils.clamp(userPhi + dPhi, 0.32, 1.22);
    orbitVel.theta = dTheta / dt;
    orbitVel.phi = dPhi / dt;
    if (bird) bird = false;
  });
  function endPointer(event) {
    noteInput();
    const prev = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (!prev || pointers.size) return;
    const pinching = pinchGesture;
    pinchGesture = false;
    if (dragged > 6) {
      coasting = !pinching;
      if (pinching) {
        orbitVel.theta = 0;
        orbitVel.phi = 0;
        coasting = false;
      }
      canvas.style.cursor = hoverId ? "pointer" : "grab";
      return;
    }
    orbitVel.theta = 0;
    orbitVel.phi = 0;
    coasting = false;
    let hit = pickHit(event);
    if (event.pointerType === "touch" && hit?.kind !== "person" && hit?.kind !== "threat") {
      // The number sits above the mesh, so a ray through the badge often
      // hits the island in front. A badge within 28px is the one that was tapped.
      const pin = nearestPin(event);
      if (pin) hit = pin;
    }
    if (hit?.kind === "threat") {
      strike(threats[hit.index]);
      canvas.style.cursor = "crosshair";
      return;
    }
    canvas.style.cursor = hoverId ? "pointer" : "grab";
    pickCb(hit);
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    noteInput();
    cancelFlight();
    stopCoast();
    zoomed = true;
    goal.theta = cam.theta;
    userPhi = cam.phi;
    goalTarget.copy(cam.target);
    goal.radius = THREE.MathUtils.clamp(cam.radius * Math.exp(event.deltaY * 0.0011), 8, maxR);
  }, { passive: false });

  // Orbit theta places the camera at (sin θ, cos θ). θ = yaw sits directly behind
  // a −z-fronted person. The extra 0.58 rad is the oblique rear seat. Of the two
  // shoulders, pick the one with the larger cos so a walker facing east or west
  // on the north rim is seen from the south, not from inside the north trees.
  function personTheta(yaw) {
    const bias = 0.58;
    const right = yaw + bias;
    const left = yaw - bias;
    return Math.cos(right) >= Math.cos(left) ? right : left;
  }

  function focusPerson(index) {
    noteInput();
    const at = people.spot(index);
    if (!at) return;
    personFocus = index;
    people.setSelected(index);
    zoomed = true;
    bird = false;
    stopCoast();
    const target = new THREE.Vector3(at.x, at.y + 0.35, at.z);
    const endTheta = personTheta(at.yaw);
    const endPhi = 0.9;
    const endRadius = 4;
    const dist = cam.target.distanceTo(target) + Math.abs(cam.radius - endRadius) * 0.25;
    goalTarget.copy(target);
    goal.theta = endTheta;
    goal.radius = endRadius;
    userPhi = endPhi;
    beginFlight({
      theta: endTheta,
      phi: endPhi,
      radius: endRadius,
      target,
    }, {
      duration: THREE.MathUtils.clamp(dist * 90, 700, 1400),
      distance: dist,
      arc: true,
      person: true,
    });
  }

  function focusIslands(ids) {
    noteInput();
    selected = new Set(ids);
    personFocus = -1;
    stopCoast();
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
    const dist = cam.target.distanceTo(center);
    beginFlight({
      theta: cam.theta,
      phi: bird ? 0.58 : 0.9,
      radius: goal.radius,
      target: center.clone(),
    }, {
      duration: THREE.MathUtils.clamp(dist * 90, 700, 1400),
      distance: dist,
      arc: true,
      trackFit: true,
    });
    if (ids.length === 1) pulse(ids[0]);
  }

  function playIntro() {
    if (reduced || introAt) {
      holdRender = Math.max(holdRender, 0.2);
      return;
    }
    introAt = performance.now();
    if (!flight) {
      beginFlight({
        theta: 0.18,
        phi: 1.02,
        radius: overviewRadius,
        target: overviewTarget.clone(),
      }, { duration: 2200, distance: 0, arc: false, intro: true });
    }
    holdRender = Math.max(holdRender, 2.8);
  }

  function trimTip(text) {
    const chars = Array.from(text || "");
    if (chars.length <= 12) return text || "";
    return `${chars.slice(0, 12).join("")}…`;
  }

  function placeItemTip() {
    if (!hoverItem) {
      itemTip.visible = false;
      return;
    }
    let found = null;
    for (const view of views.values()) {
      found = view.buildings.find((building) => building.item.id === hoverItem);
      if (found) break;
    }
    if (!found || !found.group.visible) {
      itemTip.visible = false;
      return;
    }
    found.group.getWorldPosition(itemTip.position);
    itemTip.position.y += 0.6;
    itemTipEl.textContent = trimTip(found.item.name);
    itemTip.visible = true;
  }

  function burstIsle(view) {
    isleMat.color.set(view.island.accent);
    isleMat.opacity = 1;
    isleLife = 0.7;
    isleBits.visible = true;
    const origin = view.group.position;
    for (let i = 0; i < 10; i += 1) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 0.8;
      isleV[i].set(Math.cos(ang) * 0.28, speed, Math.sin(ang) * 0.28);
      isleP[i].set(origin.x, origin.y + 0.55, origin.z);
    }
  }

  function stepIsleBits(step) {
    if (isleLife <= 0) return;
    isleLife = Math.max(0, isleLife - step);
    const fade = isleLife / 0.7;
    isleMat.opacity = fade;
    for (let i = 0; i < 10; i += 1) {
      isleV[i].y -= 5 * step;
      isleP[i].addScaledVector(isleV[i], step);
      isleDummy.position.copy(isleP[i]);
      isleDummy.scale.setScalar(fade > 0 ? 1 : 0);
      isleDummy.updateMatrix();
      isleBits.setMatrixAt(i, isleDummy.matrix);
    }
    isleBits.instanceMatrix.needsUpdate = true;
    isleBits.visible = isleLife > 0;
  }

  function startPulseRing(view) {
    if (view.pulseRing) {
      view.pulseRing.material.dispose();
      view.pulseRing.removeFromParent();
    }
    const mesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: view.island.accent,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.5;
    mesh.raycast = () => {};
    mesh.userData = { kind: "pulse" };
    view.group.add(mesh);
    view.pulseRing = mesh;
    view.pulseT = 0;
  }

  function pulse(id) {
    const view = views.get(id);
    if (!view) return;
    if (!reduced) {
      view.springV = 2.2;
      burstIsle(view);
    }
    startPulseRing(view);
    holdRender = Math.max(holdRender, 0.85);
  }

  addSeaDecor(scene, kit, placed, lamps);
  const sea = seaState();
  life.mount(sea.boatGroups, [
    ...placed.map((point) => ({ x: point.x, z: point.z, r: MESH_R + 1.15 })),
    ...sea.islets.map((spot) => ({ x: spot.x, z: spot.z, r: 1.35 })),
  ]);
  const environment = createEnvironment(THREE, scene, {
    quality: narrowScreen() ? "mid" : "high",
    camera,
    clearings: placed.map((point) => ({ x: point.x, z: point.z, r: 4.2 })),
    motion,
  });
  if (!reduced) {
    for (const view of views.values()) {
      for (const rec of view.treeRecs) rec.scaleMul = 0;
    }
  }
  kit.build(scene);
  scene.traverse((obj) => {
    const mat = obj.material;
    if (mat && mat.isMeshStandardMaterial && !obj.userData.smooth) {
      mat.flatShading = true;
      mat.needsUpdate = true;
    }
  });
  refresh();
  applyClock();
  paintedMinutes = minutes;
  resize();
  if (!reduced) {
    cam.theta = 0.18 + 0.7;
    cam.phi = 0.62;
    cam.radius = overviewRadius + 14;
    goal.theta = cam.theta;
    goal.radius = cam.radius;
    userPhi = cam.phi;
  }
  placeCamera();
  if (import.meta.env.DEV) {
    window.__island = Object.assign(window.__island ?? {}, {
      stats: () => {
        const decor = decorReport();
        const shapes = {};
        for (const [id, view] of views) shapes[id] = view.buildings.map((building) => building.recipe);
        const hour = minutes / 60;
        const look = lookAtHour(hour);
        const horiz = Math.hypot(sun.position.x, sun.position.z);
        return {
          draws: renderer.info.render.calls,
          drawCalls: renderer.info.render.calls,
          instances: kit.instanceCount(),
          triangles: renderer.info.render.triangles,
          meshes: kit.meshCount(),
          decorByIsland: decor.decorByIsland,
          decor,
          shapes,
          environment: environment.info(),
          hour,
          night: look.night,
          exposure: renderer.toneMappingExposure,
          hemiI: hemi.intensity,
          sun: [sun.position.x, sun.position.y, sun.position.z],
          shadowRatio: horiz / Math.max(0.001, sun.position.y),
          looks: LOOKS.length,
          flows: flowViews.filter((route) => route.line.visible === true).length,
          cargo: cargoOn,
          names: namesOn,
          flowDash: flowViews[0]?.mat.uniforms.dashOffset.value ?? 0,
          flowCount: flowViews[0]?.geo.instanceCount ?? -1,
          flowOpacity: flowViews[0]?.mat.opacity ?? -1,
          flowWidth: flowViews[0]?.mat.linewidth ?? -1,
          flowRes: flowViews[0]?.mat.resolution.toArray() ?? [],
          flowPeak: flowViews.reduce((peak, route) => Math.max(peak, route.curve.getPoint(0.5).y), 0),
          lit: [...views.values()].filter((view) => view.lit).map((view) => view.island.id),
          walkers: people.counts().walkers,
          ambient: people.counts().ambient,
          peopleDraws: people.counts().draws,
        };
      },
      personProbe: (index) => {
        const at = people.spot(index);
        const card = people.info(index);
        if (!at || !card) return null;
        _proj.set(at.x, at.y + 0.35, at.z).project(camera);
        const size = viewSize();
        return {
          x: (_proj.x * 0.5 + 0.5) * size.W,
          y: (-_proj.y * 0.5 + 0.5) * size.H,
          progress: card.progress,
          roleKey: card.roleKey,
          flowId: card.flowId,
          yaw: at.yaw,
        };
      },
      threatProbe: (index) => {
        const threat = threats[index];
        if (!threat) return null;
        const box = new THREE.Box3().setFromObject(threat.mesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const { W, H } = viewSize();
        const px = (v) => {
          const p = v.clone().project(camera);
          return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H };
        };
        const c = px(center);
        const reach = px(center.clone().add(new THREE.Vector3(size.x, size.y, size.z)));
        const island = views.get(threat.islandId).base;
        const left = px(new THREE.Vector3(island.x - MESH_R, 0.4, island.z));
        const right = px(new THREE.Vector3(island.x + MESH_R, 0.4, island.z));
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const p = px(new THREE.Vector3(x, y, z));
              minX = Math.min(minX, p.x);
              maxX = Math.max(maxX, p.x);
              minY = Math.min(minY, p.y);
              maxY = Math.max(maxY, p.y);
            }
          }
        }
        return {
          islandId: threat.islandId,
          tool: threat.tool,
          x: c.x,
          y: c.y,
          world: Math.max(size.x, size.y, size.z),
          worldH: size.y,
          screen: Math.hypot(reach.x - c.x, reach.y - c.y),
          screenW: maxX - minX,
          screenH: maxY - minY,
          islandScreen: Math.hypot(right.x - left.x, right.y - left.y),
          glow: threat.mats.some((mat) => mat.emissive && mat.emissiveIntensity > 0 && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0),
        };
      },
      gameProbe: () => ({
        cursor: canvas.style.cursor,
        tip: tipEl.textContent,
        tipOn: tipObj.visible,
        spark: sparkLife,
        shake: shakeLeft,
        radius: cam.radius,
        rows: threats.map((threat) => ({
          id: threat.islandId,
          hot: threat.hot,
          scale: threat.mesh.scale.x,
          scaleY: threat.mesh.scale.y,
          crew: crews.find((crew) => crew.threat === threat)?.phase || "",
          taps: threat.taps,
          y: threat.mesh.position.y,
          gone: threat.gone,
          away: threat.away,
          sinking: threat.sinking,
          u: threat.u,
          opacity: threat.mats[0]?.opacity ?? 1,
        })),
      }),
      camProbe: () => ({
        theta: cam.theta,
        phi: cam.phi,
        radius: cam.radius,
        tx: cam.target.x,
        ty: cam.target.y,
        tz: cam.target.z,
        flight: Boolean(flight),
        intro: Boolean(flight?.intro),
        celebrate: Boolean(flight?.celebrate),
        coast: coasting,
        vel: Math.hypot(orbitVel.theta, orbitVel.phi),
        introMs: introAt ? performance.now() - introAt : -1,
        zoomed,
        idle: (performance.now() - lastInput) / 1000,
      }),
      lifeProbe: () => ({ ...life.probe(), clouds: environment.cloudSample() }),
      islandProbe: (id) => {
        const view = views.get(id);
        if (!view) return null;
        const { W, H } = viewSize();
        const projected = view.base.clone().project(camera);
        return {
          id,
          x: (projected.x * 0.5 + 0.5) * W,
          y: (-projected.y * 0.5 + 0.5) * H,
          lift: view.group.position.y,
          scale: view.group.scale.x,
          pinHold: view.pinEl.classList.contains("hold"),
          pop: view.pinEl.querySelector("b")?.classList.contains("pop") || false,
          fade: view.fade,
          awake: Boolean(view.awake),
          land: view.landMat.color.getHexString(),
          bx: view.base.x,
          bz: view.base.z,
          scales: view.buildings.map((building) => Math.round(building.group.scale.x * 1000) / 1000),
          tree: view.treeRecs[0]?.scaleMul ?? 1,
          introIndex: view.introIndex,
          ring: view.ring.visible,
          ringOpacity: view.ring.material.opacity,
          top: view.landMat.color.getHexString(),
          springY: view.springY,
          springV: view.springV,
          pulse: view.pulseT,
          pulseScale: view.pulseRing ? view.pulseRing.scale.x : 0,
          bits: isleLife,
          buildings: view.buildings.map((building) => {
            const at = new THREE.Vector3();
            building.group.getWorldPosition(at);
            const p = at.project(camera);
            return {
              id: building.item.id,
              name: building.item.name,
              scale: building.group.scale.x,
              x: (p.x * 0.5 + 0.5) * W,
              y: (-p.y * 0.5 + 0.5) * H,
            };
          }),
        };
      },
    });
  }

  function clearRibbon() {
    if (!ribbon) return;
    ribbon.mesh.removeFromParent();
    ribbon.mesh.geometry.dispose();
    ribbon.mesh.material.dispose();
    ribbon = null;
  }

  function armRibbons(list) {
    clearRibbon();
    if (!list?.length) return;
    const count = list.length * 24;
    const geo = new THREE.PlaneGeometry(0.06, 0.22);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    mesh.count = count;
    ribbonDummy.position.set(0, -20, 0);
    ribbonDummy.scale.setScalar(0);
    ribbonDummy.updateMatrix();
    const plan = list.map((island, index) => {
      const view = views.get(island.id);
      const at = view ? view.base : new THREE.Vector3();
      const color = new THREE.Color(island.accent);
      for (let i = 0; i < 24; i++) mesh.setColorAt(index * 24 + i, color);
      mesh.setMatrixAt(index * 24, ribbonDummy.matrix);
      return { delay: index * 0.08, x: at.x, y: 0.55, z: at.z };
    });
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, ribbonDummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    ribbon = { mesh, t0: performance.now(), plan };
  }

  function stepRibbons() {
    if (!ribbon) return;
    const t = (performance.now() - ribbon.t0) / 1000;
    const { mesh, plan } = ribbon;
    let alive = 0;
    for (let n = 0; n < plan.length; n++) {
      const row = plan[n];
      for (let i = 0; i < 24; i++) {
        const age = t - row.delay - i * 0.012;
        const idx = n * 24 + i;
        if (age <= 0 || age > 1.6) {
          ribbonDummy.position.set(0, -20, 0);
          ribbonDummy.scale.setScalar(0);
        } else {
          alive += 1;
          const ang = (i / 24) * Math.PI * 2 + n * 0.4;
          const rad = 0.12 + age * (0.5 + (i % 4) * 0.06);
          const y = row.y + age * 1.35 - age * age * 0.42;
          ribbonDummy.position.set(row.x + Math.cos(ang) * rad, y, row.z + Math.sin(ang) * rad);
          ribbonDummy.rotation.set(0.2, ang, age * 3);
          const s = Math.max(0.05, 1 - age / 1.6);
          ribbonDummy.scale.set(0.85, s, 0.85);
        }
        ribbonDummy.updateMatrix();
        mesh.setMatrixAt(idx, ribbonDummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (alive === 0 && t > plan.length * 0.08 + 1.7) clearRibbon();
  }

  function celebrate(list, done) {
    celebrateCb = typeof done === "function" ? done : null;
    if (reduced) {
      finishCelebrate();
      return;
    }
    noteInput();
    bird = false;
    selected.clear();
    personFocus = -1;
    people.setSelected(-1);
    focusHalf = null;
    zoomed = false;
    stopCoast();
    goalTarget.copy(overviewTarget);
    applyFit();
    beginFlight({
      theta: cam.theta + Math.PI * 2,
      phi: 1.02,
      radius: overviewRadius,
      target: overviewTarget.clone(),
    }, { duration: 6000, distance: 0, arc: false });
    flight.spin = true;
    flight.ease = "sine";
    flight.celebrate = true;
    armRibbons(list);
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
        const badge = view.pinEl.querySelector("button");
        if (badge) badge.setAttribute("aria-label", island.nick);
        view.hay = [island.name, island.nick, island.pin, island.blurb, island.blurbKid, island.source, ...island.items.flatMap((item) => [item.name, item.detail, item.kid, ...(item.keywords ?? [])])].join(" ");
        for (const item of island.items) item._hay = [item.name, item.detail, item.kid, ...(item.keywords ?? [])].join(" ");
      }
      for (const route of flowViews) {
        const flow = route.flow;
        flow._hay = [flow.title, flow.kidTitle, flow.text, flow.kid, flow.carried, flow._alias, views.get(flow.a).island.name, views.get(flow.b).island.name, views.get(flow.a).island.nick, views.get(flow.b).island.nick].join(" ");
      }
      for (const mark of crewMarks) mark.el.textContent = t(mark.key);
      for (const mark of plateMarks) mark.el.textContent = t(mark.key);
      people.relabel();
      placeTip();
      refresh();
    },
    setPhase(value) { phase = value; refresh(); },
    setPillars(value) { pillarSet = value; refresh(); },
    setQuery(value) { query = norm(value); refresh(); },
    focusIslands,
    focusPerson,
    clearPersonFocus() {
      personFocus = -1;
      people.setSelected(-1);
    },
    personInfo: (index) => people.info(index),
    threatInfo(index) {
      const threat = threats[index];
      if (!threat || threat.gone) return null;
      return { index, islandId: threat.islandId, tool: threat.tool };
    },
    personPortrait: (index) => people.portrait(index),
    markFlow(id) { if (id) markCb(id); },
    onMarkFlow(fn) { markCb = fn; },
    overview() { focusIslands([]); },
    playIntro,
    setShowAllFlows(value) { showAllFlows = value; refresh(); },
    setFreeze(value) { frozen = value; },
    setBird(value) {
      noteInput();
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
    onDuty(fn) { dutyCb = typeof fn === "function" ? fn : () => {}; },
    wakeState() {
      return { live: liveWakes.map((job) => job.name), queued: wakeQueue.length };
    },
    onStrike(fn) { strikeCb = fn; },
    onRepel(fn) { repelCb = fn; },
    celebrate,
    getTheta() { return cam.theta; },
    debugState() {
      const hour = minutes / 60;
      const look = lookAtHour(hour);
      const horiz = Math.hypot(sun.position.x, sun.position.z);
      return {
        flows: flowViews.filter((route) => route.line.visible === true).length,
        lit: [...views.values()].filter((view) => view.lit).map((view) => view.island.id),
        draws: renderer.info.render.calls,
        instances: kit.instanceCount(),
        hour,
        night: look.night,
        exposure: renderer.toneMappingExposure,
        hemiI: hemi.intensity,
        sun: [sun.position.x, sun.position.y, sun.position.z],
        shadowRatio: horiz / Math.max(0.001, sun.position.y),
        looks: LOOKS.length,
        cargo: cargoOn,
        names: namesOn,
      };
    },
    selfTest() {
      const errors = [];
      const strictFlows = flowViews.filter((route) => route.line.visible === true).length;
      let drawnLines = 0;
      for (const route of flowViews) {
        if (route.line.visible !== false) drawnLines += 1;
        if (route.curve.getPoint(0.5).y > 2.2) errors.push(`flow ${route.flow.id} peaks above 2.2`);
      }
      if (strictFlows !== drawnLines) errors.push(`flows ${strictFlows} disagree with drawn lines ${drawnLines}`);
      const banned = new Set(["hepa", "amr", "global"]);
      for (const threat of threats) {
        if (banned.has(threat.islandId)) errors.push(`threat still targets ${threat.islandId}`);
        for (const mat of threat.mats) {
          const glow = mat.emissive;
          if (glow && mat.emissiveIntensity > 0 && glow.r + glow.g + glow.b > 0) errors.push(`threat on ${threat.islandId} glows`);
        }
      }
      if (threats.length !== 5) errors.push(`expected 5 threats, saw ${threats.length}`);
      if (plateMarks.length !== 5) errors.push(`expected 5 nameplates, saw ${plateMarks.length}`);
      for (const threat of threats) {
        const radius = threat.hit?.geometry?.parameters?.radius ?? 0;
        if (radius * threat.scale0 < 0.499) errors.push(`hit sphere on ${threat.islandId} is under 0.5`);
      }
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

      const walked = people.proveMotion();
      if (walked.walkers < 50) errors.push(`walkers ${walked.walkers} < 50`);
      if (walked.ambient < 10) errors.push(`ambient ${walked.ambient} < 10`);
      if (walked.moved < 0.02) errors.push("walker did not move along the route");
      if (!walked.feetOk) errors.push("walker feet left the island surface");
      if (walked.facing < 0.9) errors.push(`walker faces away from travel (cos ${walked.facing.toFixed(2)})`);
      if (walked.draws > 25) errors.push(`people draws ${walked.draws} > 25`);

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
      const rimScale = Math.max(0.2, sample.group.scale.x);
      const coastA = rimAngles(sample.coast, MESH_R * 0.97 * rimScale);
      const ringA = rimAngles(sample.ring, MESH_R * 1.02 * rimScale);
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
      const seenMat = new Set();
      scene.traverse((obj) => {
        const geo = obj.geometry;
        if (geo && geo.type === "SphereGeometry") {
          const wide = geo.parameters?.widthSegments ?? 0;
          const tall = geo.parameters?.heightSegments ?? 0;
          if (wide > 12 || tall > 12) errors.push(`sphere segments ${wide}x${tall}`);
        }
        const mat = obj.material;
        if (!mat || !mat.isMeshStandardMaterial || obj.userData.smooth || seenMat.has(mat)) return;
        seenMat.add(mat);
        if (mat.flatShading !== true) errors.push("a standard material is still smooth");
      });
      if (LOOKS.length < 9) errors.push(`LOOKS has ${LOOKS.length} rows`);
      if (LOOKS.some((row) => typeof row.night !== "number")) errors.push("LOOKS row missing night");
      if (!LOOKS.some((row) => Math.abs(row.h - 5.75) < 1e-6)) errors.push("LOOKS missing 05:45");
      if (!LOOKS.some((row) => Math.abs(row.h - 16) < 1e-6)) errors.push("LOOKS missing 16:00");
      const dawn = LOOKS[0];
      const wrap = LOOKS[LOOKS.length - 1];
      const same = ["top", "hor", "bot", "haze", "deep", "shallow", "foam", "sun", "hemi", "ground", "fill", "key", "fillI", "hemiI", "exposure", "stars", "night"];
      for (const key of same) {
        if (dawn[key] !== wrap[key]) errors.push(`h:24 ${key} differs from h:0`);
      }
      if (dawn.sunPos.distanceTo(wrap.sunPos) > 1e-6) errors.push("h:24 sunPos differs from h:0");
      const envInfo = environment.info();
      if (envInfo.draws > 12) errors.push(`environment draws ${envInfo.draws}`);
      if (envInfo.trees < 3000) errors.push(`environment trees ${envInfo.trees}`);

      // Sample offsets around the quarantine island, not a heading frame.
      const shore = border.base;
      const around = [
        [2.1, 0], [-2.1, 0], [0, 2.1], [0, -2.1],
        [3.4, 0], [-3.4, 0], [0, 3.4], [0, -3.4],
        [4.6, 1.2], [4.6, -1.2], [-4.6, 1.2], [-4.6, -1.2],
        [1.2, 4.6], [-1.2, 4.6], [1.2, -4.6], [-1.2, -4.6],
        [0, -8], [2, -10], [-2, -10],
      ];
      let dry = 0;
      for (const [dx, dz] of around) {
        if (environment.heightAt(shore.x + dx, shore.z + dz) > 0.02) dry += 1;
      }
      if (dry) errors.push(`border shore meets land at ${dry} samples`);

      const portClock = life.probe().port;
      if (!portClock) errors.push("quarantine port has no plane or ship");
      else {
        life.scrubPort(0);
        const parked = life.probe().port;
        const planeHome = Math.hypot(parked.plane.x - shore.x, parked.plane.z - shore.z);
        const shipHome = Math.hypot(parked.ship.x - shore.x, parked.ship.z - shore.z);
        if (planeHome > 1.3) errors.push("parked plane left the island");
        if (shipHome < planeHome * 2.2) errors.push("ship sits on the island");
        if (!(parked.ship.z < shore.z - 1.4)) errors.push("ship is not off the north shore");
        if (environment.heightAt(parked.ship.x, parked.ship.z) > 0.02) errors.push("ship berth is on land");
        const face = (t0, t1, craft) => {
          life.scrubPort(t0);
          const a = life.probe().port[craft];
          life.scrubPort(t1);
          const b = life.probe().port[craft];
          const mx = b.x - a.x;
          const mz = b.z - a.z;
          const travel = Math.hypot(mx, mz);
          const front = Math.hypot(b.fx, b.fz) || 1;
          const cos = (b.fx * mx + b.fz * mz) / (front * (travel || 1));
          return { travel, cos };
        };
        const flown = face(5, 5.35, "plane");
        if (flown.travel < 0.08) errors.push("plane did not move");
        else if (flown.cos < 0.85) errors.push(`plane faces away from travel (cos ${flown.cos.toFixed(2)})`);
        const sailed = face(8, 8.35, "ship");
        if (sailed.travel < 0.08) errors.push("ship did not move");
        else if (sailed.cos < 0.85) errors.push(`ship faces away from travel (cos ${sailed.cos.toFixed(2)})`);
        life.scrubPort(portClock.portTime);
      }
      return errors;
    },
  };
}

function addKit(group, island, lamps, kit, life) {
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
  function putFlag(x, y, z) {
    kit.part({
      kind: "flag",
      parent: group,
      x: x + 0.09,
      y,
      z,
      color: P.cloth,
      alive,
    });
  }
  if (island.kit === "port") {
    put("box", P.c8d6244, 0, 0.22, -MESH_R * 0.15, 0.36, 0.08, 1.35);
    put("cyl", P.cf7f4ee, 0.02, 0.7, -MESH_R - 0.15, 0.22, 0.72, 0.22);
    const beacon = put("sphere", P.cffe1a8, 0.02, 1.12, -MESH_R - 0.15, 0.15, 0.15, 0.15, null, true);
    beacon.role = "lighthouse";
    life.addBeam(group, 0.02, 1.12, -MESH_R - 0.15);
    put("box", P.cc4473a, 0.42, 0.66, -0.2, 0.28, 0.22, 0.22);
    put("box", P.c2f6f9e, -0.4, 0.64, -0.05, 0.26, 0.2, 0.24);
    put("cyl", P.board, 0.72, 0.58, -0.55, 0.025, 0.64, 0.025);
    putFlag(0.72, 0.92, -0.55);
    // East-west strip on the island. It does not leave the shore.
    put("box", P.c5c6670, -0.05, 0.405, 0.42, 1.55, 0.02, 0.22);
    put("box", P.cf4f0e6, 0.2, 0.42, 0.42, 0.08, 0.012, 0.1);
    put("box", P.cf4f0e6, -0.28, 0.42, 0.42, 0.08, 0.012, 0.1);
    life.addPort(group);
  } else if (island.kit === "tower") {
    put("box", P.cf7f4ee, 0, 0.95, -0.2, 0.26, 0.9, 0.26);
    put("torus", P.cd9e2e4, 0, 1.5, -0.2, 0.32, 0.32, 0.32, { x: Math.PI / 2.4 });
  } else if (island.kit === "lab") {
    put("box", P.cf7f4ee, 0, 0.78, -0.25, 0.72, 0.5, 0.42);
    put("box", P.cb7e0e4, 0, 0.86, -0.02, 0.5, 0.22, 0.04, null, true);
    put("box", P.chimneyClay, 0.22, 1.12, -0.36, 0.05, 0.14, 0.05);
    life.addChimney(group, 0.22, 1.2, -0.36);
    put("cyl", P.board, -0.2, 1.2, -0.36, 0.02, 0.28, 0.02);
    putFlag(-0.2, 1.36, -0.36);
  } else if (island.kit === "clinic" || island.kit === "hospital") {
    const tall = island.kit === "hospital" ? 0.72 : 0.48;
    put("box", P.cf7f4ee, 0, 0.52 + tall / 2, -0.28, 0.55, tall, 0.4);
    put("box", P.cd4544a, 0, 0.52 + tall * 0.72, -0.06, 0.06, 0.22, 0.04);
    put("box", P.cd4544a, 0, 0.52 + tall * 0.72, -0.06, 0.2, 0.06, 0.04);
    if (island.kit === "hospital") {
      put("box", P.chimneyClay, 0.16, 1.34, -0.4, 0.05, 0.14, 0.05);
      life.addChimney(group, 0.16, 1.42, -0.4);
    }
  } else if (island.kit === "warehouse") {
    put("box", P.cd7c7a2, 0, 0.74, -0.2, 0.9, 0.4, 0.46);
    put("box", P.cb98348, 0.55, 0.64, 0.15, 0.2, 0.16, 0.2);
    put("box", P.c8d6244, 0.32, 0.66, 0.18, 0.18, 0.2, 0.18);
  } else if (island.kit === "school") {
    put("box", P.cf3efe2, 0, 0.7, -0.3, 0.8, 0.36, 0.4);
    put("cyl", P.c5c6670, 0.55, 0.8, 0.15, 0.04, 0.55, 0.04);
    putFlag(0.55, 1.02, 0.15);
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
