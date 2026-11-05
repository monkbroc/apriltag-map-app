import { mat4FromRT, mul4, type Mat4 } from './math';
import { fromAprilTagFrame, type Observation } from './scan';

/**
 * Computer-vision camera axes (x right, y down, z forward) expressed in AR camera axes
 * (x right, y up, z backward). Both are aligned with the image sensor.
 */
export const AR_CAMERA_FROM_CV_CAMERA: Mat4 = mat4FromRT([1, 0, 0, 0, -1, 0, 0, 0, -1], [0, 0, 0]);

/** The subset of the native frame event the conversion needs. */
export interface FrameLike {
  timestamp: number;
  tracking: 'normal' | 'limited' | 'notAvailable';
  trackingReason?: string;
  worldFromCamera: readonly number[];
  detections: readonly {
    id: number;
    hamming: number;
    decisionMargin: number;
    pixelSize: number;
    viewAngleDeg: number;
    cameraFromTag: readonly number[];
    /** View-normalized quad corners, for the overlay. */
    corners?: readonly number[];
  }[];
}

/** Turn one native frame into observations in the AR world frame with .fmap tag axes. */
export function observationsFromFrame(frame: FrameLike): Observation[] {
  const worldFromCvCamera = mul4(frame.worldFromCamera, AR_CAMERA_FROM_CV_CAMERA);
  return frame.detections.map((d) => ({
    tagId: d.id,
    worldFromTag: fromAprilTagFrame(mul4(worldFromCvCamera, d.cameraFromTag)),
    decisionMargin: d.decisionMargin,
    pixelSize: d.pixelSize,
    viewAngleDeg: d.viewAngleDeg,
    hamming: d.hamming,
    trackingNormal: frame.tracking === 'normal',
    timestamp: frame.timestamp,
  }));
}
