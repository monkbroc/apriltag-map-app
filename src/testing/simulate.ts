/**
 * Generates native-like frame events for a simulated scan of a known field, so the scan flow
 * can be tested end to end without a device (replaces the native module in tests).
 */
import { ZUP_FROM_AR } from '@/core/align';
import { AR_CAMERA_FROM_CV_CAMERA, type FrameLike } from '@/core/frames';
import { invert4, mat3FromEuler, mat4FromRT, mul4, rotZ, transpose3, type Mat4 } from '@/core/math';
import { APRILTAG_TO_FMAP_TAG } from '@/core/scan';
import { gaussian, rng } from '@/core/testUtils';

const FMAP_TO_APRILTAG = mat4FromRT(transpose3(APRILTAG_TO_FMAP_TAG), [0, 0, 0]);

export interface SimTag {
  id: number;
  transform: Mat4;
}

export interface SimOptions {
  /** Yaw (rad) and translation of the field in the AR session's Z-up frame. */
  sessionYaw?: number;
  sessionOffset?: [number, number, number];
  framesPerTag?: number;
  /** Std-dev of tag position noise (m) and rotation noise (deg). */
  noiseM?: number;
  noiseDeg?: number;
  seed?: number;
}

/** AR world (Y up) from field (Z up) for the simulated session. */
export function worldFromField(yaw: number, offset: [number, number, number]): Mat4 {
  return invert4(mul4(mat4FromRT(rotZ(yaw), offset), ZUP_FROM_AR));
}

/** Frames where the camera sits 2 m in front of each tag in turn and looks at it. */
export function simulateScan(tags: readonly SimTag[], opts: SimOptions = {}): FrameLike[] {
  const {
    sessionYaw = 0.8,
    sessionOffset = [2, -1, 0],
    framesPerTag = 15,
    noiseM = 0.005,
    noiseDeg = 0.3,
    seed = 11,
  } = opts;
  const rand = rng(seed);
  const wff = worldFromField(sessionYaw, sessionOffset);
  const frames: FrameLike[] = [];
  let timestamp = 0;

  for (const tag of tags) {
    // Camera 2 m in front of the tag (along the tag's +X normal), looking back at it:
    // CV x (right) = tag +Y, CV y (down) = tag -Z, CV z (forward) = tag -X.
    const fieldFromTag = tag.transform;
    const tagFromCvCamera = mat4FromRT([0, 0, -1, 1, 0, 0, 0, -1, 0], [2, 0, 0]);
    for (let i = 0; i < framesPerTag; i++) {
      const jitter = mat4FromRT(
        mat3FromEuler({
          yawDeg: gaussian(rand, noiseDeg),
          pitchDeg: gaussian(rand, noiseDeg),
          rollDeg: gaussian(rand, noiseDeg),
        }),
        [gaussian(rand, noiseM), gaussian(rand, noiseM), gaussian(rand, noiseM)],
      );
      const worldFromCv = mul4(wff, mul4(fieldFromTag, tagFromCvCamera));
      const worldFromCamera = mul4(worldFromCv, invert4(AR_CAMERA_FROM_CV_CAMERA));
      const worldFromTagApriltag = mul4(wff, mul4(mul4(fieldFromTag, jitter), FMAP_TO_APRILTAG));
      const cameraFromTag = mul4(invert4(worldFromCv), worldFromTagApriltag);
      frames.push({
        timestamp: (timestamp += 0.1),
        tracking: 'normal',
        worldFromCamera,
        detections: [
          {
            id: tag.id,
            hamming: 0,
            decisionMargin: 120,
            pixelSize: 80,
            viewAngleDeg: 5,
            cameraFromTag,
            corners: [0.4, 0.4, 0.6, 0.4, 0.6, 0.6, 0.4, 0.6],
          },
        ],
      });
    }
  }
  return frames;
}
