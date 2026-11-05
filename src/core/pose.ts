import {
  eulerFromMat3,
  mat3FromEuler,
  mat4FromRT,
  rotationOf,
  translationOf,
  type Mat4,
} from './math';

/** Human-editable pose: meters and degrees (R-3.3.3). */
export interface PoseFields {
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

export function poseFromTransform(t: Mat4): PoseFields {
  const [x, y, z] = translationOf(t);
  return { x, y, z, ...eulerFromMat3(rotationOf(t)) };
}

export function transformFromPose(p: PoseFields): Mat4 {
  return mat4FromRT(mat3FromEuler(p), [p.x, p.y, p.z]);
}

/** Parse a user-typed number; returns null for empty or invalid input. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(trimmed)) return null;
  const v = Number(trimmed);
  return Number.isFinite(v) ? v : null;
}

/** Format for display, trimming trailing zeros. */
export function formatNumber(v: number, decimals = 3): string {
  const s = v.toFixed(decimals);
  const trimmed = s.includes('.') ? s.replace(/\.?0+$/, '') : s;
  return trimmed === '-0' ? '0' : trimmed;
}
