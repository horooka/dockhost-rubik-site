/**
 * Facelet model — URFDLB order, 54 chars.
 *
 * Notation (WCA / keyboard):
 *   R L U D F B  — clockwise 90° looking straight at that face
 *   M            — middle slice (same direction as L)
 *   x y z        — whole-cube rotation (same direction as R / U / F)
 *   Shift + key  — prime (counter-clockwise 90°)
 *   Ctrl + key   — half turn (180°)
 *
 * Grid (cubie slot coords, each 0..2):
 *   x: 0 = Left,  2 = Right
 *   y: 0 = Down,  2 = Up
 *   z: 0 = Back,  2 = Front
 *
 * Facelet string URFDLB: U[0-8] R[9-17] F[18-26] D[27-35] L[36-44] B[45-53]
 *
 * Index helpers (row * 3 + col on each 3×3 face, looking from OUTSIDE):
 *   R  rIndex(y,z) = (2-y)*3 + z       — y=2 is top row; z grows toward back
 *   L  lIndex(y,z) = (2-y)*3 + (2-z)   — same rows as R; z mirrored ( −X face)
 *   U  uIndex(x,z) = (2-z)*3 + x       — z=2 (front) is top row; x left→right
 *   D  dIndex(x,z) = (2-z)*3 + (2-x)   — same row order as U; x mirrored ( −Y view)
 *   F  fIndex(x,y) = (2-y)*3 + x       — y=2 is top row; x left→right
 *   B  bIndex(x,y) = (2-y)*3 + (2-x)   — same rows as F; x mirrored ( −Z face)
 *
 * MOVE_SPIN: Three.js quarter-turn sign for clockwise (outside view).
 */

export const SOLVED =
  "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

/** Animation sign: clockwise quarter turn when looking at the face (Three.js). */
export const MOVE_SPIN = {
  R: -1,
  L: -1,
  U: -1,
  D: -1,
  F: -1,
  B: -1,
  M: -1,
  x: -1,
  y: 1,
  z: 1,
};

/** WCA whole-cube rotation axis (x~R, y~U, z~F). */
export const ROTATION_AXIS = { x: "R", y: "U", z: "F" };

const COLORS = {
  U: 0xffffff,
  D: 0xffd500,
  F: 0x009b48,
  B: 0x0046ad,
  L: 0xff5800,
  R: 0xb71234,
};

function uIndex(x, z) {
  return (2 - z) * 3 + x;
}
function rIndex(y, z) {
  return (2 - y) * 3 + z;
}
function fIndex(x, y) {
  return (2 - y) * 3 + x;
}
function dIndex(x, z) {
  return (2 - z) * 3 + (2 - x);
}
function lIndex(y, z) {
  return (2 - y) * 3 + (2 - z);
}
function bIndex(x, y) {
  return (2 - y) * 3 + (2 - x);
}

/** Map cubie slot + outward normal to facelet index (matches stickerAt). */
function faceletIndex(x, y, z, nx, ny, nz) {
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  if (ay >= ax && ay >= az) {
    if (ny > 0) return uIndex(x, z);
    return 27 + dIndex(x, z);
  }
  if (ax >= ay && ax >= az) {
    if (nx > 0) return 9 + rIndex(y, z);
    return 36 + lIndex(y, z);
  }
  if (nz > 0) return 18 + fIndex(x, y);
  return 45 + bIndex(x, y);
}

function inLayer(face, x, y, z) {
  if (face === "R") return x === 2;
  if (face === "L") return x === 0;
  if (face === "U") return y === 2;
  if (face === "D") return y === 0;
  if (face === "F") return z === 2;
  if (face === "B") return z === 0;
  if (face === "M") return x === 1;
  return false;
}

/** One clockwise quarter turn of cubie slot coords (no sticker normal). */
function rotateSlotOnceCw(face, x, y, z) {
  let cx = x - 1;
  let cy = y - 1;
  let cz = z - 1;

  switch (face) {
    case "R":
      [cy, cz] = [cz, -cy];
      break;
    case "L":
      [cy, cz] = [-cz, cy];
      break;
    case "U":
      [cx, cz] = [cz, -cx];
      break;
    case "D":
      [cx, cz] = [-cz, cx];
      break;
    case "F":
      [cx, cy] = [-cy, cx];
      break;
    case "B":
      [cx, cy] = [cy, -cx];
      break;
    default:
      break;
  }

  return [cx + 1, cy + 1, cz + 1];
}

/** One clockwise quarter turn (viewed from outside) on grid + normal. */
function rotateOnceCw(face, x, y, z, nx, ny, nz) {
  let cx = x - 1;
  let cy = y - 1;
  let cz = z - 1;
  let nnx = nx;
  let nny = ny;
  let nnz = nz;

  switch (face) {
    case "R":
      [cy, cz] = [cz, -cy];
      [nny, nnz] = [nnz, -nny];
      break;
    case "L":
      [cy, cz] = [-cz, cy];
      [nny, nnz] = [-nnz, nny];
      break;
    case "U":
      [cx, cz] = [cz, -cx];
      [nnx, nnz] = [nnz, -nnx];
      break;
    case "D":
      [cx, cz] = [-cz, cx];
      [nnx, nnz] = [-nnz, nnx];
      break;
    case "F":
      [cx, cy] = [-cy, cx];
      [nnx, nny] = [-nny, nnx];
      break;
    case "B":
      [cx, cy] = [cy, -cx];
      [nnx, nny] = [nny, -nnx];
      break;
    default:
      break;
  }

  return [cx + 1, cy + 1, cz + 1, nnx, nny, nnz];
}

function buildFaceletSpecs() {
  const specs = new Array(54);

  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        if (x === 1 && y === 1 && z === 1) continue;

        const normals = [];
        if (x === 2) normals.push([1, 0, 0]);
        if (x === 0) normals.push([-1, 0, 0]);
        if (y === 2) normals.push([0, 1, 0]);
        if (y === 0) normals.push([0, -1, 0]);
        if (z === 2) normals.push([0, 0, 1]);
        if (z === 0) normals.push([0, 0, -1]);

        for (const [nx, ny, nz] of normals) {
          const idx = faceletIndex(x, y, z, nx, ny, nz);
          specs[idx] = { x, y, z, nx, ny, nz };
        }
      }
    }
  }

  return specs;
}

function buildMoveTableWithFilter(rotateFace, layerFilter) {
  const specs = buildFaceletSpecs();
  const table = Array.from({ length: 54 }, (_, i) => i);

  for (let src = 0; src < 54; src++) {
    const s = specs[src];
    if (!layerFilter(s.x, s.y, s.z)) continue;

    const [gx, gy, gz, gnx, gny, gnz] = rotateOnceCw(
      rotateFace,
      s.x,
      s.y,
      s.z,
      s.nx,
      s.ny,
      s.nz,
    );
    const dst = faceletIndex(gx, gy, gz, gnx, gny, gnz);
    table[dst] = src;
  }

  return table;
}

/** new[i] = old[table[i]] — one clockwise quarter turn of `face`. */
function buildMoveTable(face) {
  return buildMoveTableWithFilter(face, (x, y, z) => inLayer(face, x, y, z));
}

/** Y/Z axes: rotateOnceCw vs Three.js need inverted facelet tables. */
const INVERT_TABLE_FACE = new Set(["U", "D", "F", "B"]);

function moveTableForFace(face) {
  const table = buildMoveTable(face);
  return INVERT_TABLE_FACE.has(face) ? invert(table) : table;
}

/** Whole-cube rotation: every facelet permutes (x~R, y~U, z~F). */
function buildCubeRotationTable(axisFace) {
  const specs = buildFaceletSpecs();
  const table = Array.from({ length: 54 }, (_, i) => i);

  for (let src = 0; src < 54; src++) {
    const s = specs[src];
    const [gx, gy, gz, gnx, gny, gnz] = rotateOnceCw(
      axisFace,
      s.x,
      s.y,
      s.z,
      s.nx,
      s.ny,
      s.nz,
    );
    const dst = faceletIndex(gx, gy, gz, gnx, gny, gnz);
    table[dst] = src;
  }

  return table;
}

/** Middle slice M — follows L. */
function buildSliceMoveTable(slice) {
  return buildMoveTableWithFilter("L", (x, y, z) => inLayer(slice, x, y, z));
}

function invert(table) {
  const inv = new Array(54);
  for (let i = 0; i < 54; i++) inv[table[i]] = i;
  return inv;
}

function compose(a, b) {
  return a.map((i) => b[i]);
}

const MOVE_TABLES = {
  R: moveTableForFace("R"),
  L: moveTableForFace("L"),
  U: moveTableForFace("U"),
  D: moveTableForFace("D"),
  F: moveTableForFace("F"),
  B: moveTableForFace("B"),
};

const BASE = ["R", "L", "U", "D", "F", "B"];
const MOVE_MAP = {};
for (const face of BASE) {
  const t = MOVE_TABLES[face];
  MOVE_MAP[face] = t;
  MOVE_MAP[face + "'"] = invert(t);
  MOVE_MAP[face + "2"] = compose(t, t);
}

const mTable = buildSliceMoveTable("M");
MOVE_MAP.M = mTable;
MOVE_MAP["M'"] = invert(mTable);
MOVE_MAP.M2 = compose(mTable, mTable);

for (const key of ["x", "y", "z"]) {
  const t = buildCubeRotationTable(ROTATION_AXIS[key]);
  MOVE_MAP[key] = t;
  MOVE_MAP[key + "'"] = invert(t);
  MOVE_MAP[key + "2"] = compose(t, t);
}

/** Cubies to include in the animated layer/group. */
export function inAnimateLayer(move, x, y, z) {
  const face = move[0];
  if (face === "M") return x === 1;
  if (face === "x" || face === "y" || face === "z") return true;
  return inLayer(face, x, y, z);
}

/** Three.js spin on Y/Z layers uses paired-axis slot permutation. */
const SLOT_ROT_FACE = { U: "D", D: "U", F: "B", B: "F" };

/** WCA scramble notation for U/D (keyboard uses internal move labels). */
export function wcaMoveToInternal(move) {
  const face = move[0];
  if (face !== "U" && face !== "D") return move;
  if (move.includes("2")) return move;
  if (move.includes("'")) return face;
  return face + "'";
}

function rotationFaceForMove(move) {
  const face = move[0];
  if ("RLUDFB".includes(face)) return SLOT_ROT_FACE[face] ?? face;
  if (face === "M") return "L";
  if (face === "x" || face === "y" || face === "z") return ROTATION_AXIS[face];
  return null;
}

/** Grid slot after animated move (matches facelet permutation geometry). */
export function cubieSlotAfterMove(move, x, y, z) {
  const face = move[0];
  const rot = rotationFaceForMove(move);
  if (!rot) return [x, y, z];
  if (!inAnimateLayer(move, x, y, z)) return [x, y, z];

  const quarter = move.includes("2") ? 2 : 1;
  const steps = move.includes("'") ? 4 - quarter : quarter;
  let sx = x;
  let sy = y;
  let sz = z;
  for (let i = 0; i < steps; i++) {
    [sx, sy, sz] = rotateSlotOnceCw(rot, sx, sy, sz);
  }
  return [sx, sy, sz];
}

export function applyMove(state, move) {
  const table = MOVE_MAP[move];
  if (!table) return state;
  const s = state.split("");
  return table.map((i) => s[i]).join("");
}

export function parseMoves(notation) {
  return notation.match(/[RLUDFBMxyz](?:'|2)?/g) || [];
}

export function applySequence(state, notation) {
  let s = state;
  for (const m of parseMoves(notation)) s = applyMove(s, m);
  return s;
}

export function isSolved(state) {
  if (state.length !== 54) return false;
  for (let f = 0; f < 6; f++) {
    const c = state[f * 9];
    for (let i = 1; i < 9; i++) {
      if (state[f * 9 + i] !== c) return false;
    }
  }
  return true;
}

/** Sticker color for cubie at grid (x,y,z) and outward local face. */
export function stickerAt(facelets, x, y, z, face) {
  if (face === "R" && x === 2) return facelets[9 + rIndex(y, z)];
  if (face === "L" && x === 0) return facelets[36 + lIndex(y, z)];
  if (face === "U" && y === 2) return facelets[uIndex(x, z)];
  if (face === "D" && y === 0) return facelets[27 + dIndex(x, z)];
  if (face === "F" && z === 2) return facelets[18 + fIndex(x, y)];
  if (face === "B" && z === 0) return facelets[45 + bIndex(x, y)];
  return null;
}

export function colorHex(letter) {
  return COLORS[letter] ?? 0x111111;
}

export class CubeState {
  constructor(facelets = SOLVED) {
    this.facelets = facelets;
    this.moveCount = 0;
  }

  apply(move) {
    this.facelets = applyMove(this.facelets, move);
    this.moveCount += 1;
  }

  applySequence(notation) {
    for (const m of parseMoves(notation)) this.apply(m);
  }

  scramble(notation) {
    this.facelets = SOLVED;
    this.moveCount = 0;
    this.applySequence(notation);
  }

  solved() {
    return isSolved(this.facelets);
  }
}
