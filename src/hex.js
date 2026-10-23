// Pointy-top hexes, odd-r offset.
// +x east, +z south, +y up. North is -z (smaller row).
// A camera at theta = 0 sits on +z and looks toward -z, so north is up on screen.
// Neighbor centers are sqrt(3) * HEX_SIZE apart. Mesh flats are sqrt(3) * MESH_R
// apart, so HEX_SIZE > MESH_R leaves a water channel on every shared edge.

export const HEX_SIZE = 1.82;
export const MESH_R = 1.52;

const SQRT3 = Math.sqrt(3);

export function offsetToWorld(col, row, size = HEX_SIZE) {
  const x = size * SQRT3 * (col + 0.5 * (row & 1));
  const z = size * 1.5 * row;
  return { x, z };
}

export function assertHexFrame() {
  const errors = [];
  const a = offsetToWorld(0, 0);
  const east = offsetToWorld(1, 0);
  const step = Math.hypot(east.x - a.x, east.z - a.z);
  const expected = SQRT3 * HEX_SIZE;
  if (Math.abs(step - expected) > 1e-6) errors.push(`neighbor step ${step} != ${expected}`);
  if (!(step > SQRT3 * MESH_R + 0.25)) errors.push("water gap is too small");
  const north = offsetToWorld(1, 0);
  const south = offsetToWorld(1, 6);
  if (!(north.z < south.z)) errors.push("north row is not -z of south row");
  if (errors.length) throw new Error(errors.join("; "));
}
