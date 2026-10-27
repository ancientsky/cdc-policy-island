// Original implementation for this project. Not derived from third-party source code.
// People face local -z. rotation.y = atan2(-dir.x, -dir.z) turns that axis onto dir.
// Head spheres stay at 8×6 segments: the scene self-test rejects any sphere over 12.
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { MESH_R } from "./hex.js";
import { t } from "./i18n.js";
import * as P from "./palette.js";

const RING = MESH_R * 0.8;
const SPEED = 0.42;
const ROLES = ["officer", "nurse", "lab", "chief", "kid", "elder", "courier"];
const ROLE_KEY = {
  officer: "roleOfficer",
  nurse: "roleNurse",
  lab: "roleLab",
  chief: "roleChief",
  kid: "roleKid",
  elder: "roleElder",
  courier: "roleCourier",
};
const LINE_KEY = {
  officer: "roleLineOfficer",
  nurse: "roleLineNurse",
  lab: "roleLineLab",
  chief: "roleLineChief",
  kid: "roleLineKid",
  elder: "roleLineElder",
  courier: "roleLineCourier",
};
const SKIN = [P.cf0c7a4, P.cd9a57a, P.cc48a6a, P.c8d5a3c];

const _up = new THREE.Vector3(0, 1, 0);
const _axisX = new THREE.Vector3(1, 0, 0);
const _qWorld = new THREE.Quaternion();
const _qLocal = new THREE.Quaternion();
const _qSpin = new THREE.Quaternion();
const _qTwist = new THREE.Quaternion();
const _off = new THREE.Vector3();
const _local = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _feet = new THREE.Vector3();
const _color = new THREE.Color();

function yawFacing(dx, dz) {
  return Math.atan2(-dx, -dz);
}

function surfaceY(views, id) {
  const group = views.get(id)?.group;
  return (group ? group.position.y : 0) + 0.55;
}

function bestEdge(centers, fromId, toId) {
  const a = centers.get(fromId);
  const b = centers.get(toId);
  const ang = Math.atan2(b.z - a.z, b.x - a.x);
  let best = 0;
  let bestD = Infinity;
  for (let edge = 0; edge < 6; edge += 1) {
    const mid = Math.PI / 3 + edge * (Math.PI / 3);
    const d = Math.abs(Math.atan2(Math.sin(ang - mid), Math.cos(ang - mid)));
    if (d < bestD) {
      bestD = d;
      best = edge;
    }
  }
  return best;
}

function buildGraph(views) {
  const centers = new Map();
  const nodes = new Map();
  for (const [id, view] of views) {
    const x = view.group.position.x;
    const z = view.group.position.z;
    centers.set(id, { x, z });
    for (let edge = 0; edge < 6; edge += 1) {
      const mid = Math.PI / 3 + edge * (Math.PI / 3);
      nodes.set(`${id}:${edge}`, {
        x: x + Math.cos(mid) * RING,
        z: z + Math.sin(mid) * RING,
      });
    }
  }
  const links = new Map();
  const decks = [];
  const seen = new Set();
  for (const id of centers.keys()) links.set(id, []);
  for (const [id, a] of centers) {
    for (const [other, b] of centers) {
      if (other <= id) continue;
      const w = Math.hypot(b.x - a.x, b.z - a.z);
      if (w > 4.2) continue;
      links.get(id).push({ id: other, w });
      links.get(other).push({ id, w });
      const key = `${id}>${other}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const exit = bestEdge(centers, id, other);
      const entry = bestEdge(centers, other, id);
      const p = nodes.get(`${id}:${exit}`);
      const q = nodes.get(`${other}:${entry}`);
      decks.push({ ax: p.x, az: p.z, bx: q.x, bz: q.z, a: id, b: other });
    }
  }
  return { centers, nodes, links, decks };
}

function islandRoute(links, start, goal) {
  if (start === goal) return [start];
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const queue = [start];
  while (queue.length) {
    queue.sort((a, b) => dist.get(a) - dist.get(b));
    const cur = queue.shift();
    if (cur === goal) break;
    for (const link of links.get(cur) ?? []) {
      const next = dist.get(cur) + link.w;
      if (next < (dist.get(link.id) ?? Infinity)) {
        dist.set(link.id, next);
        prev.set(link.id, cur);
        if (!queue.includes(link.id)) queue.push(link.id);
      }
    }
  }
  if (!prev.has(goal)) return null;
  const path = [goal];
  let cur = goal;
  while (cur !== start) {
    cur = prev.get(cur);
    if (!cur) return null;
    path.push(cur);
  }
  path.reverse();
  return path;
}

function appendRing(pts, nodes, island, fromEdge, toEdge) {
  const cw = (toEdge - fromEdge + 6) % 6;
  const ccw = (fromEdge - toEdge + 6) % 6;
  const step = cw <= ccw ? 1 : -1;
  const count = Math.min(cw, ccw);
  for (let i = 0; i <= count; i += 1) {
    const edge = (fromEdge + step * i + 60) % 6;
    const node = nodes.get(`${island}:${edge}`);
    const last = pts[pts.length - 1];
    if (last && Math.hypot(last.x - node.x, last.z - node.z) < 0.02) continue;
    pts.push({ x: node.x, z: node.z, island, island2: null, blend: 0 });
  }
}

function flowPath(graph, fromId, toId) {
  const hops = islandRoute(graph.links, fromId, toId);
  const pts = [];
  if (!hops || hops.length < 2) {
    appendRing(pts, graph.nodes, fromId, 0, 3);
    appendRing(pts, graph.nodes, fromId, 3, 0);
  } else {
    let entryEdge = 0;
    for (let i = 0; i < hops.length - 1; i += 1) {
      const from = hops[i];
      const to = hops[i + 1];
      const exit = bestEdge(graph.centers, from, to);
      const entry = bestEdge(graph.centers, to, from);
      if (i === 0) appendRing(pts, graph.nodes, from, (exit + 3) % 6, exit);
      else appendRing(pts, graph.nodes, from, entryEdge, exit);
      const node = graph.nodes.get(`${to}:${entry}`);
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(last.x - node.x, last.z - node.z) > 0.02) {
        pts.push({ x: node.x, z: node.z, island: from, island2: to, blend: 1 });
      }
      entryEdge = entry;
    }
    const lastIsland = hops[hops.length - 1];
    appendRing(pts, graph.nodes, lastIsland, entryEdge, (entryEdge + 2) % 6);
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  }
  return { pts, cum, length: cum[cum.length - 1] || 0 };
}

function pointY(views, p) {
  const yA = surfaceY(views, p.island);
  if (!p.island2) return yA;
  return yA + (surfaceY(views, p.island2) - yA) * p.blend;
}

function samplePath(views, path, dist, lane, out) {
  const { pts, cum, length } = path;
  const d = Math.min(Math.max(dist, 0), length);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i += 1;
  const span = cum[i] - cum[i - 1] || 1;
  const u = (d - cum[i - 1]) / span;
  const p = pts[i - 1];
  const q = pts[i];
  const dx = q.x - p.x;
  const dz = q.z - p.z;
  const len = Math.hypot(dx, dz) || 1;
  out.x = p.x + dx * u + (-dz / len) * lane;
  out.z = p.z + dz * u + (dx / len) * lane;
  out.y = pointY(views, p) + (pointY(views, q) - pointY(views, p)) * u;
  out.dx = dx;
  out.dz = dz;
  return out;
}

function part(channel, joint, x, y, z, sx, sy, sz, color) {
  return { channel, joint, x, y, z, sx, sy, sz, color };
}

function roleParts(role, skin, scale) {
  const hair = role === "elder" ? P.cf3efe4 : role === "kid" ? P.ce39a3a : P.c8d6244;
  const parts = [
    part("body", "body", 0, 0.08, 0, scale, scale, scale, skin),
    part("box", "legL", 0, -0.08, 0, 0.055 * scale, 0.16 * scale, 0.055 * scale, skin),
    part("box", "legR", 0, -0.08, 0, 0.055 * scale, 0.16 * scale, 0.055 * scale, skin),
    part("box", "armL", 0, -0.065, 0, 0.04 * scale, 0.13 * scale, 0.04 * scale, skin),
    part("box", "armR", 0, -0.065, 0, 0.04 * scale, 0.13 * scale, 0.04 * scale, skin),
    part("sphere", "head", 0, 0.045, 0, 0.075 * scale, 0.075 * scale, 0.075 * scale, skin),
    part("hair", "head", 0, 0.055, 0.012, 0.086 * scale, 0.07 * scale, 0.09 * scale, hair),
    part("sphere", "head", -0.022, 0.05, -0.062, 0.014 * scale, 0.016 * scale, 0.012 * scale, P.c2a2630),
    part("sphere", "head", 0.022, 0.05, -0.062, 0.014 * scale, 0.016 * scale, 0.012 * scale, P.c2a2630),
    part("sphere", "head", -0.038, 0.02, -0.05, 0.016 * scale, 0.011 * scale, 0.01 * scale, P.bloom),
    part("sphere", "head", 0.038, 0.02, -0.05, 0.016 * scale, 0.011 * scale, 0.01 * scale, P.bloom),
  ];
  if (role === "officer") {
    parts.push(part("box", "body", 0, 0.09, -0.01, 0.13 * scale, 0.12 * scale, 0.08 * scale, P.c14756f));
    parts.push(part("box", "body", 0.03, 0.11, -0.055, 0.028 * scale, 0.036 * scale, 0.012 * scale, P.cf4f0e6));
  } else if (role === "nurse") {
    parts.push(part("cone", "head", 0, 0.09, 0, 0.055 * scale, 0.05 * scale, 0.055 * scale, P.cf4efe4));
    parts.push(part("box", "head", 0, 0.01, -0.06, 0.07 * scale, 0.028 * scale, 0.012 * scale, P.cd5dbde));
  } else if (role === "lab") {
    // Coat sits on the −z chest. A +z coat is hidden behind the capsule in the front portrait.
    parts.push(part("box", "body", 0, 0.02, -0.04, 0.2 * scale, 0.18 * scale, 0.12 * scale, P.cf3efe4));
    parts.push(part("box", "head", 0, 0.045, -0.06, 0.078 * scale, 0.02 * scale, 0.014 * scale, P.c2f6f9e));
  } else if (role === "chief") {
    parts.push(part("box", "armL", -0.01, -0.02, 0, 0.05 * scale, 0.035 * scale, 0.05 * scale, P.cc4473a));
    // Tank is in front of the left hip so the portrait crop still shows it.
    parts.push(part("cyl", "root", -0.11, 0.2, -0.06, 0.05 * scale, 0.15 * scale, 0.05 * scale, P.cd7e4ea));
  } else if (role === "kid") {
    // Wider than the torso, so the front portrait shows the pack past both shoulders.
    parts.push(part("box", "body", 0, 0.04, 0.08, 0.2 * scale, 0.11 * scale, 0.055 * scale, P.cb98348));
  } else if (role === "elder") {
    parts.push(part("cyl", "root", 0.12, 0.16, 0.02, 0.012 * scale, 0.32 * scale, 0.012 * scale, P.c8d6244));
    parts.push(part("box", "head", 0, 0.05, -0.055, 0.07 * scale, 0.012 * scale, 0.012 * scale, P.c5c6670));
  } else if (role === "courier") {
    parts.push(part("sphere", "head", 0, 0.04, 0, 0.09 * scale, 0.07 * scale, 0.09 * scale, P.ce39a3a));
    parts.push(part("box", "armL", -0.02, -0.1, -0.04, 0.08 * scale, 0.07 * scale, 0.06 * scale, P.cb7d7ea));
  }
  return parts;
}

const JOINT = {
  root: [0, 0, 0],
  body: [0, 0.22, 0],
  head: [0, 0.4, 0],
  legL: [-0.045, 0.2, 0],
  legR: [0.045, 0.2, 0],
  armL: [-0.105, 0.36, 0],
  armR: [0.105, 0.36, 0],
};

function makeChannels(scene) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, flatShading: true });
  const shadowMat = new THREE.MeshBasicMaterial({
    color: P.c1a2030,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const hairGeo = new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const shadowGeo = new THREE.CircleGeometry(0.14, 10);
  shadowGeo.rotateX(-Math.PI / 2);
  const spec = {
    body: new THREE.CapsuleGeometry(0.07, 0.11, 2, 6),
    box: new RoundedBoxGeometry(1, 1, 1, 2, 0.12),
    sphere: new THREE.SphereGeometry(1, 8, 6),
    hair: hairGeo,
    cyl: new THREE.CylinderGeometry(1, 1, 1, 7),
    cone: new THREE.ConeGeometry(1, 1, 8),
    shadow: shadowGeo,
  };
  const channels = {};
  for (const [name, geo] of Object.entries(spec)) {
    const mesh = new THREE.InstancedMesh(geo, name === "shadow" ? shadowMat : mat, 1);
    mesh.name = `people-${name}`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.owners = [];
    mesh.userData.kind = name === "shadow" ? "person-shadow" : "person";
    if (name === "shadow") mesh.raycast = () => {};
    scene.add(mesh);
    channels[name] = mesh;
  }
  return { channels, mat, geos: spec };
}

function resizeChannel(mesh, count) {
  const geo = mesh.geometry;
  const mat = mesh.material;
  const parent = mesh.parent;
  const fresh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
  fresh.name = mesh.name;
  fresh.frustumCulled = false;
  fresh.castShadow = false;
  fresh.receiveShadow = false;
  fresh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fresh.userData.owners = new Array(count);
  fresh.userData.kind = mesh.userData.kind;
  if (mesh.userData.kind === "person-shadow") fresh.raycast = () => {};
  fresh.count = count;
  if (parent) {
    parent.add(fresh);
    parent.remove(mesh);
  }
  return fresh;
}

export function createPeople({ scene, renderer, camera, views, flows, crews, onArrive }) {
  const graph = buildGraph(views);
  const { channels } = makeChannels(scene);
  const list = [];
  const planned = [];

  function addPerson(record, parts) {
    record.parts = parts;
    record.index = list.length;
    list.push(record);
    planned.push(parts);
  }

  flows.forEach((flow, flowIndex) => {
    const path = flowPath(graph, flow.a, flow.b);
    for (let k = 0; k < 3; k += 1) {
      const role = ROLES[(flowIndex * 3 + k) % ROLES.length];
      const dir = k % 2 === 0 ? 1 : -1;
      const scale = role === "kid" ? 0.82 : 1;
      const skin = SKIN[(flowIndex * 3 + k) % SKIN.length];
      addPerson({
        kind: "flow",
        role,
        skin,
        scale,
        flow,
        path,
        dist: ((k + 0.2) / 3) * path.length,
        dir,
        lane: dir * 0.08,
        dwell: 0,
        phase0: (flowIndex * 0.7 + k) * 1.3,
        shown: true,
        yaw: 0,
        moving: true,
        mode: "walk",
      }, roleParts(role, skin, scale));
    }
  });

  const ambientPlan = [
    ["vax", "queue", 0], ["vax", "queue", 2],
    ["dengue", "dump", 1], ["dengue", "dump", 4],
    ["entero", "wash", 2], ["ipc", "wash", 5],
    ["watch", "phone", 0], ["watch", "phone", 3],
    ["hiv", "sit", 1], ["hepa", "sit", 4],
    ["flu", "sit", 2], ["flu", "sit", 5],
  ];
  const carryKey = { queue: "carryQueue", dump: "carryDump", wash: "carryWash", phone: "carryPhone", sit: "carrySit" };
  ambientPlan.forEach(([islandId, mode, edge], index) => {
    const node = graph.nodes.get(`${islandId}:${edge}`);
    const center = graph.centers.get(islandId);
    const role = ["nurse", "kid", "chief", "elder", "officer", "lab", "elder", "courier", "nurse", "kid", "elder", "officer"][index];
    const scale = role === "kid" ? 0.82 : 1;
    const skin = SKIN[index % SKIN.length];
    const inward = 0.82;
    addPerson({
      kind: "ambient",
      role,
      skin,
      scale,
      islandId,
      mode,
      carryKey: carryKey[mode],
      x: center.x + (node.x - center.x) * inward,
      z: center.z + (node.z - center.z) * inward,
      phase0: index * 0.8,
      cycle: 3.2 + (index % 4) * 0.6,
      shown: true,
      yaw: yawFacing(center.x - node.x, center.z - node.z),
      moving: false,
      loop: 0,
    }, roleParts(role, skin, scale));
  });

  for (const crew of crews) {
    const scale = 1.1;
    const skin = crew.skin || SKIN[0];
    addPerson({
      kind: "crew",
      role: "officer",
      skin,
      scale,
      crew,
      islandId: crew.threat.islandId,
      tool: crew.threat.tool,
      shown: false,
      yaw: 0,
      moving: false,
      phase0: crew.spread,
    }, roleParts("officer", skin, scale));
  }

  const tally = {};
  for (const name of Object.keys(channels)) tally[name] = 0;
  for (const parts of planned) {
    for (const item of parts) tally[item.channel] += 1;
    tally.shadow += 1;
  }
  for (const name of Object.keys(channels)) {
    channels[name] = resizeChannel(channels[name], tally[name]);
  }
  const cursor = {};
  for (const name of Object.keys(channels)) cursor[name] = 0;
  list.forEach((person, personIndex) => {
    let eye = 0;
    person.eyes = [];
    for (const item of person.parts) {
      const mesh = channels[item.channel];
      const slot = cursor[item.channel];
      cursor[item.channel] += 1;
      item.slot = slot;
      mesh.userData.owners[slot] = personIndex;
      mesh.setColorAt(slot, _color.set(item.color));
      if (item.channel === "sphere" && item.joint === "head" && item.z < -0.04 && eye < 2) {
        person.eyes.push(slot);
        eye += 1;
      }
      if (item.channel === "sphere" && item.joint === "head" && Math.abs(item.z) < 0.001 && person.headSlot == null) person.headSlot = slot;
    }
    const shadow = channels.shadow;
    const slot = cursor.shadow;
    cursor.shadow += 1;
    person.shadowSlot = slot;
    shadow.userData.owners[slot] = personIndex;
    shadow.setColorAt(slot, _color.set(P.c1a2030));
  });
  for (const mesh of Object.values(channels)) {
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  const deckMat = new THREE.MeshStandardMaterial({ color: P.board, roughness: 0.86, flatShading: true });
  const deckMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 0.28), deckMat, Math.max(1, graph.decks.length));
  deckMesh.name = "people-deck";
  deckMesh.count = graph.decks.length;
  deckMesh.frustumCulled = false;
  deckMesh.castShadow = false;
  deckMesh.receiveShadow = false;
  deckMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  deckMesh.raycast = () => {};
  deckMesh.userData.kind = "path";
  scene.add(deckMesh);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.24, 20),
    new THREE.MeshBasicMaterial({ color: P.cf4efe4, side: THREE.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  ring.frustumCulled = false;
  ring.raycast = () => {};
  scene.add(ring);

  const bubbleAnchors = [];
  for (let i = 0; i < 8; i += 1) {
    const el = document.createElement("div");
    el.className = "person-bubble";
    const anchor = new THREE.Object3D();
    anchor.visible = false;
    anchor.add(new CSS2DObject(el));
    scene.add(anchor);
    bubbleAnchors.push({ el, anchor });
  }

  let clock = 0;
  let hoverIndex = -1;
  let selectedIndex = -1;
  let bubblesActive = false;
  const pickMeshes = ["body", "box", "sphere", "hair", "cyl", "cone"].map((name) => channels[name]);
  const spot = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };

  function placeFeet(person) {
    if (person.kind === "flow") {
      samplePath(views, person.path, person.dist, person.lane, spot);
      person.yaw = person.dwell > 0 ? person.yaw : yawFacing(spot.dx * person.dir, spot.dz * person.dir);
      return { x: spot.x, y: spot.y, z: spot.z };
    }
    if (person.kind === "ambient") {
      return { x: person.x, y: surfaceY(views, person.islandId), z: person.z };
    }
    return { x: person.feetX || 0, y: person.feetY || 0, z: person.feetZ || 0 };
  }

  function swingsFor(person, hold, cam) {
    const ph = hold ? person.phase0 : clock * 9 + person.phase0;
    const out = { legL: 0, legR: 0, armL: 0, armR: 0, bodyRx: 0, headRx: 0, headRy: 0, bounce: 0 };
    if (person.kind === "flow") {
      if (person.dwell > 0 && cam) {
        const feet = placeFeet(person);
        person.yaw = yawFacing(cam.position.x - feet.x, cam.position.z - feet.z);
      } else if (!hold) {
        const s = Math.sin(ph);
        out.legL = s * 0.5;
        out.legR = -s * 0.5;
        out.armL = -s * 0.4;
        out.armR = s * 0.4;
        out.bounce = Math.abs(s) * 0.01;
      }
      return out;
    }
    if (person.kind === "crew") {
      if (person.moving && !hold) {
        const s = Math.sin(ph);
        out.legL = s * 0.5;
        out.legR = -s * 0.5;
        out.armL = -s * 0.4;
        out.armR = s * 0.4;
        out.bounce = Math.abs(s) * 0.01;
      }
      return out;
    }
    const u = hold ? 0.2 : ((clock % person.cycle) / person.cycle);
    person.loop = u;
    const s = hold ? 0 : Math.sin(u * Math.PI * 2);
    if (person.mode === "sit") {
      out.bodyRx = 0.2;
      out.legL = 1.05;
      out.legR = 1.05;
      out.armL = 0.4;
      out.armR = 0.4;
      out.bounce = -0.06;
    } else if (person.mode === "wash") {
      out.armL = 0.85 + s * 0.45;
      out.armR = 0.85 - s * 0.45;
    } else if (person.mode === "dump") {
      out.bodyRx = 0.55;
      out.armL = 1.15;
      out.armR = 1.15;
      out.bounce = -0.01;
    } else if (person.mode === "phone") {
      out.armR = 2.15;
      out.headRx = 0.35;
      out.headRy = 0.4;
    } else {
      out.bounce = Math.abs(s) * 0.008;
    }
    return out;
  }

  function writePart(mesh, slot, feet, yaw, bounce, joint, swing, twist, item, shown, fit) {
    const origin = JOINT[joint];
    if (!shown) {
      _m.makeScale(0, 0, 0);
      mesh.setMatrixAt(slot, _m);
      return;
    }
    _qSpin.setFromAxisAngle(_axisX, swing);
    _qTwist.setFromAxisAngle(_up, twist);
    _qLocal.copy(_qTwist).multiply(_qSpin);
    _off.set(item.x, item.y, item.z).multiplyScalar(fit).applyQuaternion(_qLocal);
    _local.set(origin[0] * fit, origin[1] * fit, origin[2] * fit).add(_off);
    _qWorld.setFromAxisAngle(_up, yaw);
    _local.applyQuaternion(_qWorld);
    _pos.set(feet.x + _local.x, feet.y + _local.y + bounce, feet.z + _local.z);
    _qWorld.multiply(_qLocal);
    _scl.set(item.sx, item.sy, item.sz);
    _m.compose(_pos, _qWorld, _scl);
    mesh.setMatrixAt(slot, _m);
  }

  function writePerson(person, cam, hold) {
    const swing = swingsFor(person, hold, cam);
    const feet = placeFeet(person);
    person._feetX = feet.x;
    person._feetY = feet.y;
    person._feetZ = feet.z;
    const map = {
      legL: [swing.legL, 0],
      legR: [swing.legR, 0],
      armL: [swing.armL, 0],
      armR: [swing.armR, 0],
      body: [swing.bodyRx, 0],
      head: [swing.headRx, swing.headRy],
      root: [0, 0],
    };
    for (const item of person.parts) {
      const [spin, twist] = map[item.joint];
      writePart(channels[item.channel], item.slot, feet, person.yaw, swing.bounce, item.joint, spin, twist, item, person.shown, person.scale);
    }
    const shadow = channels.shadow;
    if (!person.shown) {
      _m.makeScale(0, 0, 0);
      shadow.setMatrixAt(person.shadowSlot, _m);
      return;
    }
    _qWorld.identity();
    _pos.set(feet.x, feet.y + 0.03, feet.z);
    _scl.set(person.scale, 1, person.scale);
    _m.compose(_pos, _qWorld, _scl);
    shadow.setMatrixAt(person.shadowSlot, _m);
  }

  function poseDecks() {
    graph.decks.forEach((deck, index) => {
      const dx = deck.bx - deck.ax;
      const dz = deck.bz - deck.az;
      const len = Math.hypot(dx, dz) || 1;
      const y = (surfaceY(views, deck.a) + surfaceY(views, deck.b)) * 0.5 - 0.02;
      _pos.set((deck.ax + deck.bx) * 0.5, y, (deck.az + deck.bz) * 0.5);
      _qWorld.setFromAxisAngle(_up, Math.atan2(-dz, dx));
      _scl.set(len + 0.08, 1, 1);
      _m.compose(_pos, _qWorld, _scl);
      deckMesh.setMatrixAt(index, _m);
    });
    deckMesh.instanceMatrix.needsUpdate = true;
  }

  function advance(person, step) {
    if (person.dwell > 0) {
      person.dwell -= step;
      return;
    }
    person.dist += person.dir * SPEED * step;
    const length = person.path.length;
    if (person.dist >= length) {
      person.dist = length;
      person.dir = -1;
      person.dwell = 1.2 + (person.index % 5) * 0.1;
      onArrive?.({ flow: person.flow, from: person.flow.a, to: person.flow.b, carried: person.flow.carried });
    } else if (person.dist <= 0) {
      person.dist = 0;
      person.dir = 1;
      person.dwell = 1.2 + (person.index % 5) * 0.1;
      onArrive?.({ flow: person.flow, from: person.flow.b, to: person.flow.a, carried: person.flow.carried });
    }
  }

  function syncCrew(person) {
    const crew = person.crew;
    person.shown = Boolean(crew.mesh.visible);
    if (!person.shown) return;
    crew.mesh.updateWorldMatrix(true, false);
    crew.mesh.getWorldPosition(_feet);
    person.feetX = _feet.x;
    person.feetY = _feet.y - 0.07;
    person.feetZ = _feet.z;
    person.yaw = crew.mesh.rotation.y;
    person.moving = crew.phase === "run";
  }

  function placeRing() {
    const index = selectedIndex >= 0 ? selectedIndex : hoverIndex;
    const person = list[index];
    if (!person?.shown || person._feetX == null) {
      ring.visible = false;
      return;
    }
    ring.visible = true;
    ring.position.set(person._feetX, person._feetY + 0.04, person._feetZ);
  }

  function update(step, { frozen, reduced, cargoOn, camera: cam, present = true }) {
    const hold = Boolean(frozen || reduced);
    if (!hold) clock += step;
    for (const person of list) {
      if (person.kind === "flow") {
        person.shown = Boolean(present && cargoOn);
        if (person.shown && !hold) advance(person, step);
      } else if (person.kind === "crew") syncCrew(person);
      else person.shown = Boolean(present);
      writePerson(person, cam, hold);
    }
    for (const mesh of Object.values(channels)) mesh.instanceMatrix.needsUpdate = true;
    poseDecks();
    placeRing();
  }

  function projectBubble(person, cam, width, height, into) {
    _pos.set(person._feetX, person._feetY + 0.62, person._feetZ);
    const dist = _pos.distanceTo(cam.position);
    if (dist >= 14) return;
    _local.copy(_pos).project(cam);
    if (_local.z > 1) return;
    into.push({
      person,
      dist,
      sx: (_local.x * 0.5 + 0.5) * width,
      sy: (-_local.y * 0.5 + 0.5) * height,
      x: _pos.x,
      y: _pos.y,
      z: _pos.z,
    });
  }

  function placeBubbles(cam, width, height) {
    const want = [];
    if (width > 2 && height > 2) {
      for (const person of list) {
        if (person.kind !== "flow" || !person.shown || person._feetX == null) continue;
        projectBubble(person, cam, width, height, want);
      }
    }
    want.sort((a, b) => a.dist - b.dist);
    const chosen = [];
    for (const item of want) {
      if (chosen.length >= 8) break;
      if (chosen.some((other) => Math.hypot(other.sx - item.sx, other.sy - item.sy) < 70)) continue;
      chosen.push(item);
    }
    bubblesActive = chosen.length > 0;
    for (let i = 0; i < bubbleAnchors.length; i += 1) {
      const slot = bubbleAnchors[i];
      const item = chosen[i];
      slot.anchor.visible = Boolean(item);
      if (!item) continue;
      slot.anchor.position.set(item.x, item.y, item.z);
      slot.el.textContent = t("personBubble", { what: item.person.flow.carried });
    }
  }

  function pick(raycaster) {
    const hits = raycaster.intersectObjects(pickMeshes, false);
    for (const hit of hits) {
      const owner = hit.object.userData.owners?.[hit.instanceId];
      const person = list[owner];
      if (!person?.shown) continue;
      return { index: owner, distance: hit.distance, point: hit.point };
    }
    return null;
  }

  function info(index) {
    const person = list[index];
    if (!person) return null;
    if (person.kind === "flow") {
      const flow = person.flow;
      const toId = person.dir > 0 ? flow.b : flow.a;
      const handing = person.dwell > 0;
      const placeId = handing ? (person.dist > person.path.length * 0.5 ? flow.b : flow.a) : toId;
      const from = views.get(flow.a).island;
      const to = views.get(flow.b).island;
      return {
        index,
        roleKey: ROLE_KEY[person.role],
        lineKey: LINE_KEY[person.role],
        flowId: flow.id,
        flowTitle: flow.title,
        carried: flow.carried,
        fromName: from.name,
        toName: to.name,
        fromAccent: from.accent,
        toAccent: to.accent,
        handing,
        ambient: false,
        placeName: views.get(placeId).island.name,
        progress: person.path.length > 0 ? person.dist / person.path.length : 0,
      };
    }
    const island = views.get(person.islandId).island;
    const progress = person.kind === "ambient" ? person.loop || 0 : 0;
    return {
      index,
      roleKey: ROLE_KEY[person.role],
      lineKey: LINE_KEY[person.role],
      flowId: null,
      flowTitle: island.pin,
      carried: "",
      carryKey: person.carryKey || "carrySit",
      fromName: island.name,
      toName: island.name,
      fromAccent: island.accent,
      toAccent: island.accent,
      handing: false,
      ambient: true,
      placeName: island.name,
      progress,
    };
  }

  const portrait = buildPortrait(renderer);

  function counts() {
    let walkers = 0;
    let ambient = 0;
    for (const person of list) {
      if (person.kind === "flow") walkers += 1;
      else if (person.kind === "ambient") ambient += 1;
    }
    const draws = Object.values(channels).length + 1 + (ring.visible ? 1 : 0);
    return { walkers, ambient, draws };
  }

  function proveMotion() {
    const person = list.find((item) => item.kind === "flow");
    const saved = {
      dist: person.dist,
      dir: person.dir,
      dwell: person.dwell,
      lane: person.lane,
      yaw: person.yaw,
      shown: person.shown,
    };
    person.shown = true;
    person.dwell = 0;
    person.dir = 1;
    person.lane = 0.08;
    person.dist = 0.15;
    writePerson(person, camera, true);
    const a = { x: person._feetX, y: person._feetY, z: person._feetZ };
    person.dist = 0.5;
    writePerson(person, camera, true);
    const b = { x: person._feetX, y: person._feetY, z: person._feetZ };
    const moved = Math.hypot(b.x - a.x, b.z - a.z);
    samplePath(views, person.path, person.dist, person.lane, spot);
    const feetOk = Math.abs(b.y - spot.y) < 0.12 && b.y < 1.3;
    let facing = 1;
    if (person.headSlot != null && person.eyes.length === 2) {
      const headMesh = channels.sphere;
      headMesh.getMatrixAt(person.headSlot, _m);
      _m.decompose(_pos, _qWorld, _scl);
      const head = _pos.clone();
      const eyePos = new THREE.Vector3();
      for (const slot of person.eyes) {
        headMesh.getMatrixAt(slot, _m);
        _m.decompose(_local, _qWorld, _scl);
        eyePos.add(_local);
      }
      eyePos.multiplyScalar(0.5);
      const front = eyePos.sub(head);
      front.y = 0;
      const travel = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
      if (front.lengthSq() > 1e-8 && travel.lengthSq() > 1e-8) facing = front.normalize().dot(travel.normalize());
    }
    person.dist = saved.dist;
    person.dir = saved.dir;
    person.dwell = saved.dwell;
    person.lane = saved.lane;
    person.yaw = saved.yaw;
    person.shown = saved.shown;
    writePerson(person, camera, true);
    for (const mesh of Object.values(channels)) mesh.instanceMatrix.needsUpdate = true;
    return { moved, feetOk, facing, ...counts() };
  }

  return {
    update,
    placeBubbles,
    bubblesOn: () => bubblesActive,
    pick,
    info,
    spot(index) {
      const person = list[index];
      return person ? { x: person._feetX || 0, y: person._feetY || 0, z: person._feetZ || 0, yaw: person.yaw || 0 } : null;
    },
    setHover(index) { hoverIndex = index; },
    setSelected(index) { selectedIndex = index; },
    portrait(index) { return portrait(list[index]); },
    counts,
    proveMotion,
    relabel() {},
  };
}

function buildPortrait(renderer) {
  const portraitScene = new THREE.Scene();
  portraitScene.background = new THREE.Color(P.cf4efe4);
  portraitScene.add(new THREE.AmbientLight(0xfff4e8, 0.85));
  const key = new THREE.DirectionalLight(0xfff7ee, 1.35);
  key.position.set(-0.4, 1.2, -1.4);
  portraitScene.add(key);
  const fill = new THREE.DirectionalLight(0xd5e4ea, 0.45);
  fill.position.set(0.8, 0.6, -0.4);
  portraitScene.add(fill);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 10);
  cam.position.set(0, 0.42, -0.72);
  cam.lookAt(0, 0.38, 0);
  const groups = new Map();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, flatShading: true });
  function geoFor(channel) {
    if (channel === "body") return new THREE.CapsuleGeometry(0.07, 0.11, 2, 6);
    if (channel === "box") return new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
    if (channel === "sphere") return new THREE.SphereGeometry(1, 8, 6);
    if (channel === "hair") return new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    if (channel === "cyl") return new THREE.CylinderGeometry(1, 1, 1, 7);
    return new THREE.ConeGeometry(1, 1, 8);
  }
  const geos = {};
  for (const role of ROLES) {
    const group = new THREE.Group();
    group.visible = false;
    const parts = roleParts(role, SKIN[0], role === "kid" ? 0.82 : 1);
    for (const item of parts) {
      if (!geos[item.channel]) geos[item.channel] = geoFor(item.channel);
      const mesh = new THREE.Mesh(geos[item.channel], mat.clone());
      mesh.material.color.set(item.color);
      const origin = JOINT[item.joint];
      const fit = role === "kid" ? 0.82 : 1;
      mesh.position.set((origin[0] + item.x) * fit, (origin[1] + item.y) * fit, (origin[2] + item.z) * fit);
      mesh.scale.set(item.sx, item.sy, item.sz);
      mesh.userData.skin = item.color === SKIN[0];
      group.add(mesh);
    }
    portraitScene.add(group);
    groups.set(role, group);
  }
  let target = new THREE.WebGLRenderTarget(160, 160, { samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  let plain = null;
  const buffer = new Uint8Array(160 * 160 * 4);
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const cache = new Map();

  function shoot(person) {
    if (!person) return "";
    if (cache.has(person.index)) return cache.get(person.index);
    try {
      return shootOnce(person);
    } catch {
      return "";
    }
  }

  function shootOnce(person) {
    for (const [role, group] of groups) {
      group.visible = role === person.role;
      if (role !== person.role) continue;
      for (const child of group.children) {
        if (child.userData.skin) child.material.color.set(person.skin);
      }
    }
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(portraitScene, cam);
    renderer.readRenderTargetPixels(target, 0, 0, 160, 160, buffer);
    let ink = 0;
    for (let i = 0; i < buffer.length; i += 16) ink += buffer[i] + buffer[i + 1] + buffer[i + 2];
    if (ink < 500) {
      if (!plain) {
        plain = new THREE.WebGLRenderTarget(160, 160);
        plain.texture.colorSpace = THREE.SRGBColorSpace;
      }
      renderer.setRenderTarget(plain);
      renderer.render(portraitScene, cam);
      renderer.readRenderTargetPixels(plain, 0, 0, 160, 160, buffer);
    }
    renderer.setRenderTarget(previous);
    const image = ctx.createImageData(160, 160);
    for (let y = 0; y < 160; y += 1) {
      const src = (159 - y) * 160 * 4;
      image.data.set(buffer.subarray(src, src + 160 * 4), y * 160 * 4);
    }
    ctx.putImageData(image, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.85);
    cache.set(person.index, url);
    return url;
  }
  return shoot;
}
