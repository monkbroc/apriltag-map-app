/**
 * All tuning constants for the app (REQUIREMENTS R-2.6). There is no Settings screen:
 * adjust these values and rebuild.
 */

/** Minimum accepted observations before a scanned tag counts as "seen" (R-5.3.2, R-5.5.4). */
export const MIN_OBSERVATIONS = 10;

/** Observation acceptance thresholds (R-5.3.3). */
export const ACCEPTANCE = {
  /** Minimum AprilTag decision margin. */
  minDecisionMargin: 30,
  /** Minimum apparent tag size in pixels (shortest side of the detected quad). */
  minPixelSize: 30,
  /** Maximum angle between the camera ray and the tag normal, in degrees. */
  maxViewAngleDeg: 60,
  /** Maximum Hamming distance (number of corrected bits). */
  maxHamming: 0,
} as const;

/** Comparison screen color thresholds (R-5.5.2). */
export const DELTA_THRESHOLDS = {
  green: { positionM: 0.02, rotationDeg: 1 },
  yellow: { positionM: 0.05, rotationDeg: 3 },
} as const;

/** Show "—" for % change when the reference tag is closer than this to the origin (R-5.5.1). */
export const PERCENT_MIN_DISTANCE_M = 0.1;

/** Warn when the alignment RMS residual exceeds this (R-5.4.3). */
export const RMS_WARN_M = 0.05;

/** Default size for new tags, in millimeters (R-4.4). */
export const DEFAULT_TAG_SIZE_MM = 165.1;

/** The only supported AprilTag family (R-3.1.3). */
export const TAG_FAMILY = 'apriltag3_36h11_classic';

/** The only supported map type (R-3.1.2). */
export const MAP_TYPE = 'frc';

/**
 * Field size used for WPIBlue coordinates when a set has no field of its own (fresh scans,
 * imports): the FRC 2026 welded field, from WPILib.
 */
export const DEFAULT_FIELD = { lengthM: 16.541, widthM: 8.069 } as const;
