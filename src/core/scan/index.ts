import { ACCEPTANCE } from '../config';
import {
  add,
  mat3FromQuat,
  mat4FromRT,
  mul4,
  normalizeQuat,
  quatDot,
  quatFromMat3,
  rotationOf,
  scale,
  translationOf,
  type Mat3,
  type Mat4,
  type Quat,
  type Vec3,
} from '../math';

/**
 * Rotation from the .fmap tag-local frame to the AprilTag library's tag frame.
 *
 * AprilTag library tag frame (seen from the viewer): x right, y down, z into the tag.
 * .fmap / WPILib tag frame: x out of the tag face (toward the viewer), y to the viewer's
 * right, z up. The columns below are the .fmap axes expressed in AprilTag axes.
 * Verified on device by the checklist in docs/device-test.md.
 */
export const APRILTAG_TO_FMAP_TAG: Mat3 = [0, 1, 0, 0, 0, -1, -1, 0, 0];

/** One detection of one tag, already expressed in the AR world frame. */
export interface Observation {
  tagId: number;
  /** Tag pose in the AR world frame, using the .fmap tag-local axes. */
  worldFromTag: Mat4;
  decisionMargin: number;
  /** Shortest side of the detected quad, in pixels. */
  pixelSize: number;
  /** Angle between the camera ray and the tag normal, in degrees. */
  viewAngleDeg: number;
  hamming: number;
  /** True when AR tracking was "normal" for this frame. */
  trackingNormal: boolean;
  timestamp: number;
}

/** Convert a tag pose that uses the AprilTag library's tag axes to the .fmap tag axes. */
export function fromAprilTagFrame(worldFromAprilTag: Mat4): Mat4 {
  return mul4(worldFromAprilTag, mat4FromRT(APRILTAG_TO_FMAP_TAG, [0, 0, 0]));
}

/** R-5.3.3: should this observation be used? */
export function acceptObservation(o: Observation, thresholds = ACCEPTANCE): boolean {
  return (
    o.trackingNormal &&
    o.decisionMargin >= thresholds.minDecisionMargin &&
    o.pixelSize >= thresholds.minPixelSize &&
    o.viewAngleDeg <= thresholds.maxViewAngleDeg &&
    o.hamming <= thresholds.maxHamming
  );
}

export interface AggregatedTag {
  tagId: number;
  /** Averaged pose in the AR world frame. */
  worldFromTag: Mat4;
  count: number;
}

interface Sums {
  position: Vec3;
  quat: Quat;
  reference: Quat;
  count: number;
}

/**
 * Running average of tag poses (R-5.3.4): mean position, and the normalized sum of
 * quaternions after flipping each into the same hemisphere as the first one.
 */
export class ScanAccumulator {
  private sums = new Map<number, Sums>();

  /** Add an observation. Returns false when it was rejected by the acceptance filter. */
  add(o: Observation, thresholds = ACCEPTANCE): boolean {
    if (!acceptObservation(o, thresholds)) return false;
    const p = translationOf(o.worldFromTag);
    let q = quatFromMat3(rotationOf(o.worldFromTag));
    const s = this.sums.get(o.tagId);
    if (!s) {
      this.sums.set(o.tagId, { position: p, quat: q, reference: q, count: 1 });
      return true;
    }
    if (quatDot(q, s.reference) < 0) q = [-q[0], -q[1], -q[2], -q[3]];
    s.position = add(s.position, p);
    s.quat = [s.quat[0] + q[0], s.quat[1] + q[1], s.quat[2] + q[2], s.quat[3] + q[3]];
    s.count += 1;
    return true;
  }

  count(tagId: number): number {
    return this.sums.get(tagId)?.count ?? 0;
  }

  counts(): Map<number, number> {
    return new Map([...this.sums].map(([id, s]) => [id, s.count]));
  }

  results(): AggregatedTag[] {
    return [...this.sums]
      .map(([tagId, s]) => ({
        tagId,
        count: s.count,
        worldFromTag: mat4FromRT(
          mat3FromQuat(normalizeQuat(s.quat)),
          scale(s.position, 1 / s.count),
        ),
      }))
      .sort((a, b) => a.tagId - b.tagId);
  }

  reset(): void {
    this.sums.clear();
  }
}
