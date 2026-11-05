/**
 * Small linear-algebra toolkit for rigid transforms.
 *
 * - `Vec3` is [x, y, z].
 * - `Mat3` is 9 numbers, row-major.
 * - `Mat4` is 16 numbers, row-major (same layout as the .fmap `transform` field).
 * - `Quat` is [w, x, y, z], unit length.
 */

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly number[];
export type Mat4 = readonly number[];
export type Quat = readonly [number, number, number, number];

const DEG = 180 / Math.PI;
export const toDeg = (rad: number) => rad * DEG;
export const toRad = (deg: number) => deg / DEG;

const at = (m: readonly number[], i: number) => m[i] as number;

// ---------------------------------------------------------------- Vec3

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: Vec3) => Math.sqrt(dot(a, a));

// ---------------------------------------------------------------- Mat3

export const IDENTITY3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul3(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push(
        at(a, r * 3) * at(b, c) + at(a, r * 3 + 1) * at(b, 3 + c) + at(a, r * 3 + 2) * at(b, 6 + c),
      );
    }
  }
  return out;
}

export function transpose3(m: Mat3): Mat3 {
  return [at(m, 0), at(m, 3), at(m, 6), at(m, 1), at(m, 4), at(m, 7), at(m, 2), at(m, 5), at(m, 8)];
}

export function apply3(m: Mat3, v: Vec3): Vec3 {
  return [
    at(m, 0) * v[0] + at(m, 1) * v[1] + at(m, 2) * v[2],
    at(m, 3) * v[0] + at(m, 4) * v[1] + at(m, 5) * v[2],
    at(m, 6) * v[0] + at(m, 7) * v[1] + at(m, 8) * v[2],
  ];
}

export function det3(m: Mat3): number {
  return (
    at(m, 0) * (at(m, 4) * at(m, 8) - at(m, 5) * at(m, 7)) -
    at(m, 1) * (at(m, 3) * at(m, 8) - at(m, 5) * at(m, 6)) +
    at(m, 2) * (at(m, 3) * at(m, 7) - at(m, 4) * at(m, 6))
  );
}

/** Largest absolute deviation of RᵀR from the identity, plus |det − 1|. */
export function orthonormalityError(m: Mat3): number {
  const rtr = mul3(transpose3(m), m);
  let err = Math.abs(det3(m) - 1);
  for (let i = 0; i < 9; i++) err = Math.max(err, Math.abs(at(rtr, i) - at(IDENTITY3, i)));
  return err;
}

/** Rotation about +Z by `rad`. */
export function rotZ(rad: number): Mat3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** Angle in degrees of the relative rotation between two rotation matrices (geodesic distance). */
export function rotationAngleDeg(a: Mat3, b: Mat3): number {
  const rel = mul3(transpose3(a), b);
  const cos = (at(rel, 0) + at(rel, 4) + at(rel, 8) - 1) / 2;
  return toDeg(Math.acos(Math.min(1, Math.max(-1, cos))));
}

/** Yaw (rotation about Z, radians) that best matches a rotation that is mostly about Z. */
export function yawOf(m: Mat3): number {
  return Math.atan2(at(m, 3) - at(m, 1), at(m, 0) + at(m, 4));
}

// ---------------------------------------------------------------- Quaternions

export function quatFromMat3(m: Mat3): Quat {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m as unknown as number[];
  const tr = m00! + m11! + m22!;
  let q: [number, number, number, number];
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [0.25 * s, (m21! - m12!) / s, (m02! - m20!) / s, (m10! - m01!) / s];
  } else if (m00! > m11! && m00! > m22!) {
    const s = Math.sqrt(1 + m00! - m11! - m22!) * 2;
    q = [(m21! - m12!) / s, 0.25 * s, (m01! + m10!) / s, (m02! + m20!) / s];
  } else if (m11! > m22!) {
    const s = Math.sqrt(1 + m11! - m00! - m22!) * 2;
    q = [(m02! - m20!) / s, (m01! + m10!) / s, 0.25 * s, (m12! + m21!) / s];
  } else {
    const s = Math.sqrt(1 + m22! - m00! - m11!) * 2;
    q = [(m10! - m01!) / s, (m02! + m20!) / s, (m12! + m21!) / s, 0.25 * s];
  }
  return normalizeQuat(q);
}

export function mat3FromQuat(q: Quat): Mat3 {
  const [w, x, y, z] = normalizeQuat(q);
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - w * z),
    2 * (x * z + w * y),
    2 * (x * y + w * z),
    1 - 2 * (x * x + z * z),
    2 * (y * z - w * x),
    2 * (x * z - w * y),
    2 * (y * z + w * x),
    1 - 2 * (x * x + y * y),
  ];
}

export function normalizeQuat(q: Quat): Quat {
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  if (n === 0) return [1, 0, 0, 0];
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

export const quatDot = (a: Quat, b: Quat) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

/** Project a nearly-orthonormal matrix onto the closest rotation (via a quaternion round trip). */
export function orthonormalize(m: Mat3): Mat3 {
  return mat3FromQuat(quatFromMat3(m));
}

// ---------------------------------------------------------------- Euler (intrinsic Z-Y-X)

export interface Euler {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

/** R = Rz(yaw) · Ry(pitch) · Rx(roll). */
export function mat3FromEuler({ yawDeg, pitchDeg, rollDeg }: Euler): Mat3 {
  const [cy, sy] = [Math.cos(toRad(yawDeg)), Math.sin(toRad(yawDeg))];
  const [cp, sp] = [Math.cos(toRad(pitchDeg)), Math.sin(toRad(pitchDeg))];
  const [cr, sr] = [Math.cos(toRad(rollDeg)), Math.sin(toRad(rollDeg))];
  return [
    cy * cp,
    cy * sp * sr - sy * cr,
    cy * sp * cr + sy * sr,
    sy * cp,
    sy * sp * sr + cy * cr,
    sy * sp * cr - cy * sr,
    -sp,
    cp * sr,
    cp * cr,
  ];
}

export function eulerFromMat3(m: Mat3): Euler {
  const r20 = Math.min(1, Math.max(-1, at(m, 6)));
  const pitch = Math.asin(-r20);
  if (Math.abs(r20) > 1 - 1e-9) {
    // Gimbal lock: roll is folded into yaw.
    return { yawDeg: toDeg(Math.atan2(-at(m, 1), at(m, 4))), pitchDeg: toDeg(pitch), rollDeg: 0 };
  }
  return {
    yawDeg: toDeg(Math.atan2(at(m, 3), at(m, 0))),
    pitchDeg: toDeg(pitch),
    rollDeg: toDeg(Math.atan2(at(m, 7), at(m, 8))),
  };
}

// ---------------------------------------------------------------- Mat4

export const IDENTITY4: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function mat4FromRT(r: Mat3, t: Vec3): Mat4 {
  return [
    at(r, 0),
    at(r, 1),
    at(r, 2),
    t[0],
    at(r, 3),
    at(r, 4),
    at(r, 5),
    t[1],
    at(r, 6),
    at(r, 7),
    at(r, 8),
    t[2],
    0,
    0,
    0,
    1,
  ];
}

export function rotationOf(m: Mat4): Mat3 {
  return [
    at(m, 0),
    at(m, 1),
    at(m, 2),
    at(m, 4),
    at(m, 5),
    at(m, 6),
    at(m, 8),
    at(m, 9),
    at(m, 10),
  ];
}

export function translationOf(m: Mat4): Vec3 {
  return [at(m, 3), at(m, 7), at(m, 11)];
}

/** Compose rigid transforms: a · b. */
export function mul4(a: Mat4, b: Mat4): Mat4 {
  const ra = rotationOf(a);
  return mat4FromRT(mul3(ra, rotationOf(b)), add(apply3(ra, translationOf(b)), translationOf(a)));
}

/** Inverse of a rigid transform. */
export function invert4(m: Mat4): Mat4 {
  const rt = transpose3(rotationOf(m));
  return mat4FromRT(rt, scale(apply3(rt, translationOf(m)), -1));
}

export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  return add(apply3(rotationOf(m), p), translationOf(m));
}
