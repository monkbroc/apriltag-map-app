import { DEFAULT_TAG_SIZE_MM, MIN_OBSERVATIONS, TAG_FAMILY } from '../config';
import type { ScannedPose } from '../diff';
import type { Fiducial } from '../types';

/** Scanned tags with enough observations to be used (R-5.3.2). */
export function eligibleScans<T extends ScannedPose>(
  scanned: readonly T[],
  minObservations = MIN_OBSERVATIONS,
): T[] {
  return scanned.filter((s) => s.count >= minObservations);
}

/**
 * Replace-all-seen merge (R-5.5.4): eligible scanned tags replace the reference pose,
 * new tags are added, unscanned tags are kept. Size and `unique` come from the reference.
 */
export function mergeReplaceAllSeen(
  reference: readonly Fiducial[],
  scanned: readonly ScannedPose[],
  minObservations = MIN_OBSERVATIONS,
  defaultSizeMm = DEFAULT_TAG_SIZE_MM,
): Fiducial[] {
  const byId = new Map(reference.map((f) => [f.id, { ...f }]));
  for (const s of eligibleScans(scanned, minObservations)) {
    const ref = byId.get(s.id);
    byId.set(s.id, {
      id: s.id,
      size: ref?.size ?? defaultSizeMm,
      family: ref?.family ?? TAG_FAMILY,
      unique: ref?.unique ?? 1,
      transform: [...s.transform],
      observationCount: s.count,
    });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
