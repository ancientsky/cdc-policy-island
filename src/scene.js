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
  shadeGeo.rotateY(Math.PI / 6);
  const shadeMat = new THREE.MeshBasicMaterial({ color: "#041014", transparent: true, opacity: 0.14, depthWrite: false });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.ConeGeometry(0.24, 0.3, 4);
  roofGeo.rotateY(Math.PI / 4);
  const trunkGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.16, 5);
  const crownGeo = new THREE.ConeGeometry(0.16, 0.34, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#6b4a32", roughness: 0.9 });
  const glowGeo = new THREE.CircleGeometry(MESH_R * 1.05, 6);
  glowGeo.rotateX(-Math.PI / 2);
  glowGeo.rotateY(Math.PI / 6);

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

  function house(parent, item, x, z, index, accent) {
    const group = new THREE.Group();
    group.position.set(x, 0.55, z);
    const h = 0.34 + (index % 3) * 0.12;
    const w = 0.32 + (index % 2) * 0.1;
    const depth = w * 0.84;
    const wallMat = new THREE.MeshStandardMaterial({ color: "#f4efe4", roughness: 0.88 });
    const roofMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.62 });
    const winMat = new THREE.MeshStandardMaterial({
      color: "#fff1cf",
      emissive: "#ffb15a",
      emissiveIntensity: 0.15,
      roughness: 0.35,
    });
    const body = new THREE.Mesh(box, wallMat);
    body.scale.set(w, h, depth);
    body.position.y = h / 2 + 0.04;
    body.userData = { kind: "item", islandId: parent.userData.islandId, itemId: item.id };
    const plinth = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "#cbbfa6", roughness: 0.92 }));
    plinth.scale.set(w * 1.12, 0.06, depth * 1.12);
    plinth.position.y = 0.03;
    plinth.userData = body.userData;
    const eave = new THREE.Mesh(box, roofMat);
    eave.scale.set(w * 1.28, 0.045, depth * 1.28);
    eave.position.y = h + 0.05;
    eave.userData = body.userData;
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.scale.set(w * 1.15, 0.72, w * 1.15);
    roof.position.y = h + 0.16;
    roof.userData = body.userData;
    const win = new THREE.Mesh(box, winMat);
    win.scale.set(w * 0.28, Math.min(0.12, h * 0.26), 0.02);
    win.position.set(0, h * 0.55 + 0.04, depth / 2 + 0.012);
    win.userData = body.userData;
    group.add(plinth, body, eave, roof, win);
    parent.add(group);
    for (const mesh of [plinth, body, eave, roof, win]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pickables.push(mesh);
    }
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
      new THREE.RingGeometry(MESH_R * 1.04, MESH_R * 1.12, 6),
      new THREE.MeshBasicMaterial({ color: island.accent, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = Math.PI / 6;
    ring.position.y = 0.58;
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
      return house(group, item, sx, sz, index, island.accent);
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
    mid.y += 0.65 + len * 0.16;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 28, 0.028, 5, false),
      new THREE.MeshStandardMaterial({ color: "#f4e4bc", emissive: "#f4e4bc", emissiveIntensity: 0.35, roughness: 0.45 }),
    );
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
  let shoreLabel = null;

  function poseThreat(threat) {
    threat.mesh.position.lerpVectors(threat.home, threat.halt, threat.u);
    threat.mesh.position.y = threat.hover + Math.sin(elapsed * 1.15 + threat.phase) * 0.06;
    _threatDir.subVectors(threat.halt, threat.home);
    _threatDir.y = 0;
    if (_threatDir.lengthSq() > 1e-8) threat.mesh.rotation.y = Math.atan2(-_threatDir.x, -_threatDir.z);
    threat.mesh.updateWorldMatrix(true, true);
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

  function addThreat(mesh, head, nose, home, halt, rate, scale = 2.3) {
    mesh.userData = { kind: "threat" };
    mesh.scale.setScalar(scale);
    scene.add(mesh);
    const threat = {
      mesh,
      head,
      nose,
      home,
      halt,
      u: 0.4 + (threats.length % 5) * 0.04,
      floor: 0.28,
      limit: 0.7,
      dir: 1,
      rate,
      phase: threats.length * 0.9,
      hover: 0.78,
    };
    threats.push(threat);
    poseThreat(threat);
  }

  function makeVirus(color) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.55 });
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), bodyMat));
    const spikeMat = new THREE.MeshStandardMaterial({ color: "#ffd0c8", roughness: 0.45, emissive: "#c04038", emissiveIntensity: 0.4 });
    const spike = new THREE.ConeGeometry(0.03, 0.14, 5);
    for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 1, 0], [0, 1, 1], [1, 0, 1]]) {
      const s = new THREE.Mesh(spike, spikeMat);
      const d = new THREE.Vector3(x, y, z).normalize();
      s.position.copy(d).multiplyScalar(0.22);
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      group.add(s);
    }
    return { group, ...markFront(group, spikeMat) };
  }

  function makeRod() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: "#9ecf62", roughness: 0.45, emissive: "#4a7828", emissiveIntensity: 0.55 });
    const rod = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.36, 3, 8), mat);
    rod.rotation.x = Math.PI / 2;
    group.add(rod);
    return { group, ...markFront(group, mat) };
  }

  function makeMosquito() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: "#3a2a22", roughness: 0.55, emissive: "#6a3020", emissiveIntensity: 0.5 });
    const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.26, 3, 6), mat);
    abdomen.rotation.x = -Math.PI / 2;
    abdomen.position.z = 0.08;
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mat);
    thorax.position.z = -0.08;
    const wingMat = new THREE.MeshStandardMaterial({
      color: "#d5e4ea",
      transparent: true,
      opacity: 0.42,
      roughness: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.12), wingMat);
    wingL.position.set(-0.2, 0.06, -0.02);
    wingL.rotation.z = 0.45;
    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.12), wingMat);
    wingR.position.set(0.2, 0.06, -0.02);
    wingR.rotation.z = -0.45;
    group.add(abdomen, thorax, wingL, wingR);
    const marks = markFront(group, mat);
    marks.nose.scale.set(0.35, 0.35, 1.5);
    return { group, ...marks };
  }

  function makeWedge() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: "#161214", roughness: 0.38, metalness: 0.42, emissive: "#5a1814", emissiveIntensity: 0.4 });
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.62, 4), mat);
    hull.rotation.x = -Math.PI / 2;
    group.add(hull);
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
    shore.position.set(amr.x - 4.15, 0, amr.z + 1.35);
    const groundMat = new THREE.MeshStandardMaterial({ color: "#120c10", roughness: 0.9 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.42, 3.2), groundMat);
    slab.position.y = 0.16;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.15, 2.6), groundMat);
    wall.position.set(1.85, 0.7, 0.1);
    shore.add(slab, wall);
    const peakMat = new THREE.MeshStandardMaterial({ color: "#1c1016", roughness: 0.84, emissive: "#3a1418", emissiveIntensity: 0.2 });
    for (const [x, h, z, r] of [[-1.1, 1.5, -1.2, 0.62], [0.15, 2.15, 0.15, 0.48], [1.05, 1.25, 1.35, 0.55], [-0.2, 0.9, 1.7, 0.4]]) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), peakMat);
      peak.position.set(x, 0.28 + h / 2, z);
      shore.add(peak);
    }
    const towerMat = new THREE.MeshStandardMaterial({ color: "#2a161c", roughness: 0.66, metalness: 0.22 });
    const winMat = new THREE.MeshStandardMaterial({ color: "#ff6844", emissive: "#ff2e22", emissiveIntensity: 0.9 });
    shoreLamps.push(winMat);
    for (const [x, h, z] of [[-0.85, 1.9, -0.35], [0.35, 2.55, 0.55], [1.15, 1.45, -0.95]]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.32, h, 0.32), towerMat);
      tower.position.set(x, 0.3 + h / 2, z);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.03), winMat);
      win.position.set(x + 0.16, 0.45 + h * 0.45, z);
      shore.add(tower, win);
    }
    const labelEl = document.createElement("div");
    labelEl.className = "shore-label";
    labelEl.textContent = t("shore");
    shoreLabel = labelEl;
    const label = new CSS2DObject(labelEl);
    label.position.set(1.45, 2.85, 0.15);
    shore.add(label);
    scene.add(shore);

    const virusA = makeVirus("#c43858");
    addThreat(virusA.group, virusA.head, virusA.nose, new THREE.Vector3(amr.x - 7.2, 0, amr.z - 0.2), new THREE.Vector3(amr.x - 2.85, 0, amr.z - 0.05), 0.045, 2.4);
    const virusB = makeVirus("#9a3478");
    addThreat(virusB.group, virusB.head, virusB.nose, new THREE.Vector3(border.x - 0.3, 0, border.z - 5.4), new THREE.Vector3(border.x + 0.15, 0, border.z - 2.7), 0.04, 2.2);
    const mosquitoA = makeMosquito();
    addThreat(mosquitoA.group, mosquitoA.head, mosquitoA.nose, new THREE.Vector3(dengue.x + 1.6, 0, dengue.z + 4.6), new THREE.Vector3(dengue.x + 0.7, 0, dengue.z + 2.55), 0.05, 2.5);
    const mosquitoB = makeMosquito();
    addThreat(mosquitoB.group, mosquitoB.head, mosquitoB.nose, new THREE.Vector3(hepa.x + 4.4, 0, hepa.z + 1.1), new THREE.Vector3(hepa.x + 2.55, 0, hepa.z + 0.35), 0.042, 2.3);
    const rod = makeRod();
    addThreat(rod.group, rod.head, rod.nose, new THREE.Vector3(globalI.x + 4.6, 0, globalI.z - 0.4), new THREE.Vector3(globalI.x + 2.65, 0, globalI.z + 0.15), 0.036, 2.2);
    for (const zOff of [-1.15, 0.2, 1.45]) {
      const wedge = makeWedge();
      addThreat(
        wedge.group,
        wedge.head,
        wedge.nose,
        new THREE.Vector3(amr.x - 5.4, 0, amr.z + zOff * 0.7),
        new THREE.Vector3(amr.x - 2.9, 0, amr.z + zOff * 0.25),
        0.055,
        1.7,
      );
    }
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
      }
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
        poseThreat(threat);
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
