import {
  mat4FromRT,
  mul3,
  mul4,
  norm,
  rotZ,
  rotationOf,
  sub,
  transformPoint,
  translationOf,
  transpose3,
  yawOf,
  type Mat4,
  type Vec3,
} from '../math';
import type { AggregatedTag } from '../scan';

/**
 * ARKit/ARCore world frames are gravity-aligned with +Y up. This fixed rotation
 * (+90° about X) maps AR +Y onto +Z so the field fit only needs yaw + translation.
 */
export const ZUP_FROM_AR: Mat4 = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];

export interface ReferenceTag {
  id: number;
  /** Tag pose in the field frame. */
  transform: Mat4;
}

export interface TagResidual {
  tagId: number;
  residualM: number;
  excluded: boolean;
}

export type AlignResult =
  | {
      ok: true;
      /** Maps AR world coordinates to field coordinates. */
      fieldFromWorld: Mat4;
      method: 'positions' | 'single-tag';
      /** Residuals for every tag present in both the scan and the reference. */
      residuals: TagResidual[];
      /** RMS of the residuals of the tags used in the fit (0 for a single-tag fit). */
      rmsM: number;
    }
  | { ok: false; error: 'no-shared-tags' | 'all-excluded' };

/** Smallest XY spread (sum of squared distances from the centroid, m²) for a position fit. */
const MIN_SPREAD_M2 = 1e-4;

interface Pair {
  tagId: number;
  count: number;
  scan: Mat4; // in the Z-up AR frame
  ref: Mat4; // in the field frame
}

/** Closed-form least-squares yaw + translation fit on positions. */
function fitPositions(pairs: Pair[]): Mat4 | null {
  const ps = pairs.map((p) => translationOf(p.scan));
  const qs = pairs.map((p) => translationOf(p.ref));
  const mean = (vs: Vec3[]): Vec3 => {
    const s = vs.reduce<Vec3>((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]);
    return [s[0] / vs.length, s[1] / vs.length, s[2] / vs.length];
  };
  const mp = mean(ps);
  const mq = mean(qs);
  let sumCross = 0;
  let sumDot = 0;
  let spread = 0;
  ps.forEach((p, i) => {
    const a = sub(p, mp);
    const b = sub(qs[i]!, mq);
    sumCross += a[0] * b[1] - a[1] * b[0];
    sumDot += a[0] * b[0] + a[1] * b[1];
    spread += a[0] * a[0] + a[1] * a[1];
  });
  if (spread < MIN_SPREAD_M2) return null;
  const r = rotZ(Math.atan2(sumCross, sumDot));
  const rotated = transformPoint(mat4FromRT(r, [0, 0, 0]), mp);
  return mat4FromRT(r, sub(mq, rotated));
}

/** Yaw + translation that puts one scanned tag exactly on its reference pose. */
function fitSingleTag(pair: Pair): Mat4 {
  const yaw = yawOf(mul3(rotationOf(pair.ref), transpose3(rotationOf(pair.scan))));
  const r = rotZ(yaw);
  const rotated = transformPoint(mat4FromRT(r, [0, 0, 0]), translationOf(pair.scan));
  return mat4FromRT(r, sub(translationOf(pair.ref), rotated));
}

/**
 * Align a scan to the field (R-5.4): least squares on positions when 2+ shared tags are
 * spread out in XY, otherwise the pose of the best-observed shared tag.
 */
export function align(
  scanned: readonly AggregatedTag[],
  reference: readonly ReferenceTag[],
  excludedIds: ReadonlySet<number> = new Set(),
): AlignResult {
  const refById = new Map(reference.map((r) => [r.id, r.transform]));
  const shared: Pair[] = scanned
    .filter((s) => refById.has(s.tagId))
    .map((s) => ({
      tagId: s.tagId,
      count: s.count,
      scan: mul4(ZUP_FROM_AR, s.worldFromTag),
      ref: refById.get(s.tagId)!,
    }));
  if (!shared.length) return { ok: false, error: 'no-shared-tags' };
  const used = shared.filter((p) => !excludedIds.has(p.tagId));
  if (!used.length) return { ok: false, error: 'all-excluded' };

  let fieldFromZup = used.length >= 2 ? fitPositions(used) : null;
  const method = fieldFromZup ? 'positions' : 'single-tag';
  if (!fieldFromZup) {
    const best = used.reduce((a, b) => (b.count > a.count ? b : a));
    fieldFromZup = fitSingleTag(best);
  }

  const residuals = shared.map((p) => ({
    tagId: p.tagId,
    excluded: excludedIds.has(p.tagId),
    residualM: norm(sub(transformPoint(fieldFromZup, translationOf(p.scan)), translationOf(p.ref))),
  }));
  const usedResiduals = residuals.filter((r) => !r.excluded);
  const rmsM =
    method === 'single-tag'
      ? 0
      : Math.sqrt(usedResiduals.reduce((s, r) => s + r.residualM ** 2, 0) / usedResiduals.length);

  return {
    ok: true,
    fieldFromWorld: mul4(fieldFromZup, ZUP_FROM_AR),
    method,
    residuals,
    rmsM,
  };
}

export interface FieldTag {
  id: number;
  transform: Mat4;
  count: number;
}

/** Move aggregated scan poses into the field frame. */
export function toField(fieldFromWorld: Mat4, scanned: readonly AggregatedTag[]): FieldTag[] {
  return scanned.map((s) => ({
    id: s.tagId,
    count: s.count,
    transform: mul4(fieldFromWorld, s.worldFromTag),
  }));
}
