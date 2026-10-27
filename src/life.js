// Original implementation for this project. Not derived from third-party source code.
// Boats, birds, smoke, wakes, the lighthouse beam, the runway plane and the
// harbor ship share the water clock. Craft noses point along local -z.
// Flag cloth is a plain tan. Nothing here is a national flag.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const WAVES = [
  { dir: [1, 0.3], steep: 0.1, wl: 18, speed: 0.12 },
  { dir: [-0.4, 1], steep: 0.08, wl: 9, speed: 0.15 },
  { dir: [0.7, -0.6], steep: 0.05, wl: 4, speed: 0.2 },
];

export function gerstnerAt(x, z, time) {
  let ox = 0;
  let oy = 0;
  let oz = 0;
  let slopeX = 0;
  let slopeZ = 0;
  for (const wave of WAVES) {
    const len = Math.hypot(wave.dir[0], wave.dir[1]);
    const dx = wave.dir[0] / len;
    const dz = wave.dir[1] / len;
    const k = 6.28318 / wave.wl;
    const c = Math.sqrt(9.8 / k) * wave.speed;
    const f = k * (dx * x + dz * z - c * time);
    const a = wave.steep / k;
    const s = Math.sin(f);
    const co = Math.cos(f);
    ox += dx * a * co;
    oy += a * s;
    oz += dz * a * co;
    slopeX += a * co * k * dx;
    slopeZ += a * co * k * dz;
  }
  return { x: x + ox, y: oy, z: z + oz, slopeX, slopeZ };
}

// Park, take off west, arc over the strait, land back on the east-west runway.
// Nose is local -z. t 0..2.4 sits on the runway facing west.
const PLANE_PERIOD = 24;
const PLANE_KEYS = [
  { t: 0, p: [-0.5, 0.48, 0.42] },
  { t: 2.4, p: [-0.5, 0.48, 0.42] },
  { t: 4.2, p: [-1.7, 1.05, 0.05] },
  { t: 6.4, p: [-2.4, 1.75, -1.7] },
  { t: 9.6, p: [0.4, 2.25, -4.4] },
  { t: 13.2, p: [5.0, 2.3, -1.4] },
  { t: 16.0, p: [3.6, 1.05, 0.42] },
  { t: 17.5, p: [1.2, 0.52, 0.42] },
  { t: 19.0, p: [0.15, 0.48, 0.42] },
  { t: 21.2, p: [-0.5, 0.48, 0.42] },
  { t: 24.0, p: [-0.5, 0.48, 0.42] },
];

// Berth just north of the quay, then leave across the strait and come back in.
// Nose is local -z. The pause faces south, toward the island.
const SHIP_PERIOD = 28;
const SHIP_KEYS = [
  { t: 0, p: [0.55, 0, -2.35] },
  { t: 3.2, p: [0.55, 0, -2.35] },
  { t: 6.4, p: [0.95, 0, -3.45] },
  { t: 11.0, p: [4.3, 0, -4.15] },
  { t: 15.5, p: [4.5, 0, -3.3] },
  { t: 20.0, p: [1.5, 0, -2.65] },
  { t: 23.5, p: [0.55, 0, -2.35] },
  { t: 28.0, p: [0.55, 0, -2.35] },
];

function paintBox(w, h, d, x, y, z, hex) {
  const geo = new BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  const color = new Color(hex);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < geo.attributes.position.count; i += 1) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geo;
}

function sampleKeys(keys, period, time) {
  let u = time % period;
  if (u < 0) u += period;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t < u) i += 1;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const span = Math.max(0.0001, b.t - a.t);
  const e = Math.min(1, Math.max(0, (u - a.t) / span));
  return {
    x: a.p[0] + (b.p[0] - a.p[0]) * e,
    y: a.p[1] + (b.p[1] - a.p[1]) * e,
    z: a.p[2] + (b.p[2] - a.p[2]) * e,
  };
}

function wakeGeometry() {
  const geo = new PlaneGeometry(0.22, 1.25, 1, 8);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  let zmin = Infinity;
  let zmax = -Infinity;
  for (let i = 0; i < pos.count; i += 1) {
    zmin = Math.min(zmin, pos.getZ(i));
    zmax = Math.max(zmax, pos.getZ(i));
  }
  const colors = new Float32Array(pos.count * 4);
  const span = zmax - zmin || 1;
  for (let i = 0; i < pos.count; i += 1) {
    const t = (pos.getZ(i) - zmin) / span;
    const alpha = 0.5 * (1 - t);
    colors[i * 4] = 1;
    colors[i * 4 + 1] = 1;
    colors[i * 4 + 2] = 1;
    colors[i * 4 + 3] = alpha;
  }
  geo.setAttribute("color", new BufferAttribute(colors, 4));
  return geo;
}

export function createLife(scene, { motion, reduced }) {
  const chimneys = [];
  const sailors = [];
  const parked = [];
  const periods = [66, 78, 90];
  const phases = [0.08, 0.41, 0.73];
  let beam = null;
  let curve = null;
  let wings = null;
  let wakes = null;
  let smoke = null;
  let radii = [];
  let port = null;
  let portTime = 0;
  let planeYaw = Math.PI / 2;
  let shipYaw = Math.PI;
  const dummy = new Object3D();
  const at = new Vector3();
  const portNow = new Vector3();
  const portAhead = new Vector3();
  const noseAt = new Vector3();
  const tailAt = new Vector3();

  function addBeam(group, x, y, z) {
    const cone = new ConeGeometry(0.6, 4, 24, 1, true);
    cone.translate(0, 2, 0);
    const mat = new MeshBasicMaterial({
      color: 0xffe1a8,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(cone, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.raycast = () => {};
    mesh.frustumCulled = false;
    const pivot = new Group();
    pivot.position.set(x, y, z);
    pivot.add(mesh);
    group.add(pivot);
    beam = { pivot, mat };
  }

  function addChimney(group, x, y, z) {
    const anchor = new Object3D();
    anchor.position.set(x, y, z);
    group.add(anchor);
    chimneys.push(anchor);
  }

  function mount(groups, blockers) {
    groups.forEach((group, index) => {
      const row = {
        group,
        spawn: { x: group.position.x, z: group.position.z, yaw: group.rotation.y },
        period: periods[index] || 0,
        phase: phases[index] || 0,
        u: 0,
      };
      if (index < 3) sailors.push(row);
      else parked.push(row);
    });
    const ring = [];
    radii = [];
    for (let i = 0; i < 8; i += 1) {
      const ang = (i / 8) * Math.PI * 2;
      let radius = 13 + (i % 3) * 0.85;
      let x = Math.cos(ang) * radius;
      let z = Math.sin(ang) * radius;
      for (let n = 0; n < 8; n += 1) {
        const hit = blockers.some((block) => Math.hypot(x - block.x, z - block.z) < block.r);
        if (!hit || radius >= 15) break;
        radius = Math.min(15, radius + 0.3);
        x = Math.cos(ang) * radius;
        z = Math.sin(ang) * radius;
      }
      radii.push(radius);
      ring.push(new Vector3(x, 0, z));
    }
    curve = new CatmullRomCurve3(ring, true, "catmullrom", 0.35);

    const wingGeo = new BufferGeometry();
    wingGeo.setAttribute("position", new Float32BufferAttribute([
      0, 0, 0,
      0.18, 0, 0.02,
      0.03, 0.07, 0,
    ], 3));
    wingGeo.computeVertexNormals();
    wings = new InstancedMesh(wingGeo, new MeshBasicMaterial({ color: 0xf4f1ea, side: DoubleSide }), 20);
    wings.userData.kind = "bird";
    wings.frustumCulled = false;
    wings.raycast = () => {};
    wings.instanceMatrix.setUsage(DynamicDrawUsage);
    scene.add(wings);

    wakes = new InstancedMesh(wakeGeometry(), new MeshBasicMaterial({
      color: 0xd5ebe8,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      vertexColors: true,
      vertexAlphas: true,
      side: DoubleSide,
    }), sailors.length);
    wakes.userData.kind = "wake";
    wakes.frustumCulled = false;
    wakes.raycast = () => {};
    wakes.instanceMatrix.setUsage(DynamicDrawUsage);
    wakes.visible = !reduced;
    scene.add(wakes);

    const count = Math.max(1, chimneys.length * 6);
    const smokeGeo = new BufferGeometry();
    smokeGeo.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
    smokeGeo.setAttribute("aFade", new BufferAttribute(new Float32Array(count), 1));
    smoke = new Points(smokeGeo, new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new Color(0xd5d0c6) } },
      vertexShader: `
        attribute float aFade;
        varying float vFade;
        void main() {
          vFade = aFade;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 2.2 * (90.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vFade;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          if (dot(p, p) > 1.0) discard;
          gl_FragColor = vec4(uColor, vFade);
        }
      `,
    }));
    smoke.userData.kind = "smoke";
    smoke.frustumCulled = false;
    smoke.raycast = () => {};
    smoke.visible = chimneys.length > 0;
    scene.add(smoke);
    poseBirds(0, false);
    poseSmoke(0);
    if (!reduced) {
      for (const row of sailors) poseBoat(row, 0, true);
      for (const row of parked) poseBoat(row, 0, false);
      poseWakes();
    }
  }

  function poseBirds(time, flap) {
    for (let i = 0; i < 10; i += 1) {
      const flock = i < 5 ? 0 : 1;
      const k = i % 5;
      const radius = 9 + flock * 2.4;
      const t = time * (0.16 + flock * 0.03) + flock * 2.1 + k * 0.18;
      const x = Math.sin(t) * radius;
      const z = Math.sin(t * 0.73 + 1.2) * radius * 0.92;
      const y = Math.min(5.5, Math.max(4, 4.35 + flock * 0.5 + Math.sin(t * 1.7) * 0.22 + k * 0.03));
      const ahead = t + 0.04;
      const dx = Math.sin(ahead) * radius - x;
      const dz = Math.sin(ahead * 0.73 + 1.2) * radius * 0.92 - z;
      const yaw = Math.atan2(dx, dz);
      const angle = flap ? Math.sin(time * 10 + i) * 0.6 : 0;
      for (let side = 0; side < 2; side += 1) {
        const sign = side === 0 ? 1 : -1;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, yaw, sign * angle);
        dummy.scale.set(sign, 1, 1);
        dummy.updateMatrix();
        wings.setMatrixAt(i * 2 + side, dummy.matrix);
      }
    }
    wings.instanceMatrix.needsUpdate = true;
  }

  function poseBoat(row, time, sail) {
    const group = row.group;
    let x = row.spawn.x;
    let z = row.spawn.z;
    let yaw = row.spawn.yaw;
    if (sail && curve) {
      const u = ((time / row.period) + row.phase) % 1;
      const point = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      x = point.x;
      z = point.z;
      yaw = Math.atan2(-tan.z, tan.x);
      row.u = u;
    }
    const wave = gerstnerAt(x, z, time);
    group.position.set(wave.x, wave.y, wave.z);
    group.rotation.set(Math.atan(wave.slopeZ), yaw, -Math.atan(wave.slopeX));
  }

  function poseWakes() {
    sailors.forEach((row, index) => {
      const yaw = row.group.rotation.y;
      const forwardX = Math.cos(yaw);
      const forwardZ = -Math.sin(yaw);
      const y = row.group.position.y + 0.04;
      dummy.position.set(
        row.group.position.x - forwardX * 0.9,
        y,
        row.group.position.z - forwardZ * 0.9,
      );
      dummy.scale.set(1, 1, 1);
      dummy.up.set(0, 1, 0);
      dummy.lookAt(row.group.position.x, y, row.group.position.z);
      dummy.updateMatrix();
      wakes.setMatrixAt(index, dummy.matrix);
    });
    wakes.instanceMatrix.needsUpdate = true;
  }

  function poseSmoke(time) {
    const attr = smoke.geometry.attributes.position;
    const fade = smoke.geometry.attributes.aFade;
    chimneys.forEach((anchor, c) => {
      anchor.getWorldPosition(at);
      for (let i = 0; i < 6; i += 1) {
        const n = c * 6 + i;
        const age = ((time + i * 0.5) % 3) / 3;
        attr.setXYZ(n, at.x, at.y + age * 0.6, at.z);
        fade.setX(n, at.y < -0.2 ? 0 : 0.5 * (1 - age));
      }
    });
    attr.needsUpdate = true;
    fade.needsUpdate = true;
  }

  function pose(time, flap) {
    for (const row of sailors) poseBoat(row, time, true);
    for (const row of parked) poseBoat(row, time, false);
    poseWakes();
    poseBirds(time, flap);
    poseSmoke(time);
  }

  function addPort(group) {
    const craftMat = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.74,
      metalness: 0,
      flatShading: true,
    });
    const planeGeo = mergeGeometries([
      paintBox(0.09, 0.07, 0.46, 0, 0.02, 0, 0xf4f7fb),
      paintBox(0.62, 0.018, 0.12, 0, 0.03, -0.02, 0xd5dde6),
      paintBox(0.016, 0.1, 0.08, 0, 0.08, 0.18, 0xc45a3a),
      paintBox(0.2, 0.014, 0.06, 0, 0.05, 0.2, 0xd5dde6),
    ]);
    planeGeo.computeVertexNormals();
    const planeBody = new Group();
    const planeMesh = new Mesh(planeGeo, craftMat);
    planeMesh.castShadow = false;
    planeMesh.raycast = () => {};
    const prop = new Mesh(
      new BoxGeometry(0.2, 0.02, 0.02),
      new MeshStandardMaterial({ color: 0x5c6670, roughness: 0.6, metalness: 0, flatShading: true }),
    );
    prop.position.set(0, 0.02, -0.26);
    prop.castShadow = false;
    prop.raycast = () => {};
    const planeNose = new Object3D();
    planeNose.position.set(0, 0.02, -0.3);
    const planeTail = new Object3D();
    planeTail.position.set(0, 0.02, 0.2);
    planeBody.add(planeMesh, prop, planeNose, planeTail);
    const planeRig = new Group();
    planeRig.add(planeBody);
    planeRig.userData.kind = "plane";
    planeRig.raycast = () => {};
    planeRig.frustumCulled = false;
    scene.add(planeRig);

    const shipGeo = mergeGeometries([
      paintBox(0.26, 0.09, 0.78, 0, 0.05, 0, 0x3e6d78),
      paintBox(0.16, 0.06, 0.16, 0, 0.05, -0.42, 0x3e6d78),
      paintBox(0.16, 0.12, 0.16, 0, 0.14, 0.22, 0xf4ede0),
      paintBox(0.18, 0.1, 0.2, 0, 0.13, -0.12, 0xc46a45),
      paintBox(0.16, 0.08, 0.16, 0, 0.12, 0.02, 0xd7c7a2),
    ]);
    shipGeo.computeVertexNormals();
    const shipMesh = new Mesh(shipGeo, craftMat);
    shipMesh.castShadow = false;
    shipMesh.raycast = () => {};
    const shipWake = new Mesh(
      new PlaneGeometry(0.22, 0.7),
      new MeshBasicMaterial({
        color: 0xd5ebe8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    shipWake.rotation.x = -Math.PI / 2;
    shipWake.position.set(0, 0.03, 0.62);
    shipWake.raycast = () => {};
    const shipNose = new Object3D();
    shipNose.position.set(0, 0.08, -0.42);
    const shipTail = new Object3D();
    shipTail.position.set(0, 0.08, 0.28);
    const shipRig = new Group();
    shipRig.add(shipMesh, shipWake, shipNose, shipTail);
    shipRig.userData.kind = "ship";
    shipRig.raycast = () => {};
    shipRig.frustumCulled = false;
    scene.add(shipRig);

    port = { group, planeRig, planeBody, prop, planeNose, planeTail, shipRig, shipWake, shipNose, shipTail };
    posePort(0, 0);
  }

  function portLocal(local, out) {
    const g = port.group;
    const s = g.scale.x || 1;
    out.set(g.position.x + local.x * s, g.position.y + local.y * s, g.position.z + local.z * s);
    return out;
  }

  function aimYaw(current, ahead, fallback) {
    const dx = ahead.x - current.x;
    const dz = ahead.z - current.z;
    if (dx * dx + dz * dz < 0.0004) return fallback;
    return Math.atan2(-dx, -dz);
  }

  function posePort(time, spin) {
    if (!port) return;
    const here = sampleKeys(PLANE_KEYS, PLANE_PERIOD, time);
    const next = sampleKeys(PLANE_KEYS, PLANE_PERIOD, time + 0.4);
    planeYaw = aimYaw(here, next, planeYaw);
    const climb = next.y - here.y;
    const horiz = Math.hypot(next.x - here.x, next.z - here.z) || 0.0001;
    port.planeRig.rotation.y = planeYaw;
    port.planeBody.rotation.x = Math.max(-0.45, Math.min(0.55, Math.atan2(climb, horiz)));
    portLocal(here, portNow);
    port.planeRig.position.copy(portNow);
    port.planeRig.scale.setScalar(port.group.scale.x || 1);
    if (spin) port.prop.rotation.z += spin * 18;

    const shipHere = sampleKeys(SHIP_KEYS, SHIP_PERIOD, time);
    const shipNext = sampleKeys(SHIP_KEYS, SHIP_PERIOD, time + 0.4);
    shipYaw = aimYaw(shipHere, shipNext, shipYaw);
    portLocal(shipHere, portNow);
    const wave = gerstnerAt(portNow.x, portNow.z, time);
    port.shipRig.position.set(portNow.x, wave.y, portNow.z);
    port.shipRig.rotation.y = shipYaw;
    port.shipRig.scale.setScalar(port.group.scale.x || 1);
    const speed = Math.hypot(shipNext.x - shipHere.x, shipNext.z - shipHere.z) / 0.4;
    port.shipWake.material.opacity = speed > 0.12 ? 0.4 : 0;
  }

  function scrubPort(time) {
    posePort(time, 0);
  }

  function step(dt, { live, night }) {
    motion.uAmp.value = reduced ? 0 : 1;
    if (beam) {
      if (live) beam.pivot.rotation.y += dt * 0.9;
      beam.mat.opacity = 0.18 * night;
    }
    if (wings) wings.visible = night < 0.5;
    if (!live) return;
    pose(motion.uTime.value, true);
    portTime += dt;
    posePort(portTime, dt);
  }

  function probe() {
    const birdAt = new Vector3();
    if (wings) {
      wings.getMatrixAt(0, dummy.matrix);
      birdAt.setFromMatrixPosition(dummy.matrix);
    }
    const smokeY = smoke ? smoke.geometry.attributes.position.getY(0) : null;
    return {
      time: motion.uTime.value,
      amp: motion.uAmp.value,
      crowned: Boolean(motion.crowned),
      flagged: Boolean(motion.flagged),
      beamY: beam ? beam.pivot.rotation.y : null,
      beamOpacity: beam ? beam.mat.opacity : null,
      birds: wings ? wings.visible : false,
      birdY: birdAt.y,
      radii,
      sailors: sailors.map((row) => ({
        x: Number(row.group.position.x.toFixed(3)),
        y: Number(row.group.position.y.toFixed(3)),
        z: Number(row.group.position.z.toFixed(3)),
        u: Number((row.u || 0).toFixed(4)),
      })),
      parked: parked[0] ? {
        x: Number(parked[0].group.position.x.toFixed(3)),
        y: Number(parked[0].group.position.y.toFixed(3)),
        z: Number(parked[0].group.position.z.toFixed(3)),
      } : null,
      chimneys: chimneys.length,
      wakes: wakes ? wakes.visible : false,
      smokeY,
      port: port ? portProbe() : null,
    };
  }

  function flatForward(nose, tail) {
    nose.getWorldPosition(noseAt);
    tail.getWorldPosition(tailAt);
    return { x: noseAt.x - tailAt.x, z: noseAt.z - tailAt.z };
  }

  function portProbe() {
    const planeF = flatForward(port.planeNose, port.planeTail);
    const shipF = flatForward(port.shipNose, port.shipTail);
    return {
      portTime,
      plane: {
        x: port.planeRig.position.x,
        y: port.planeRig.position.y,
        z: port.planeRig.position.z,
        fx: planeF.x,
        fz: planeF.z,
      },
      ship: {
        x: port.shipRig.position.x,
        y: port.shipRig.position.y,
        z: port.shipRig.position.z,
        fx: shipF.x,
        fz: shipF.z,
      },
    };
  }

  return { addBeam, addChimney, addPort, mount, step, probe, scrubPort };
}
