import type { Mat4 } from './math';

/** One AprilTag entry, matching the .fmap `fiducials[]` item plus optional app metadata. */
export interface Fiducial {
  id: number;
  /** Tag size in millimeters. */
  size: number;
  /** 4x4 row-major tag-to-field transform; translation in meters. */
  transform: Mat4;
  family: string;
  unique: number;
  /** Observations from the scan that last set this pose (app metadata, not written to .fmap). */
  observationCount?: number;
}

/** Contents of an .fmap file. */
export interface FmapDoc {
  type: string;
  fiducials: Fiducial[];
}

export interface FieldDimensions {
  lengthM: number;
  widthM: number;
}

/** A saved (or built-in) tag set. */
export interface TagSet {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  fiducials: Fiducial[];
  /** True for read-only sets that ship with the app. */
  builtin?: boolean;
  /** Field outline for the map view, when known. */
  field?: FieldDimensions;
}
