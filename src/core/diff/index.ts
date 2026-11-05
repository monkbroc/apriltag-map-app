import { DELTA_THRESHOLDS, PERCENT_MIN_DISTANCE_M } from '../config';
import { norm, rotationAngleDeg, rotationOf, sub, translationOf, type Mat4 } from '../math';

export type DiffStatus = 'updated' | 'new' | 'not-scanned';
export type DeltaLevel = 'green' | 'yellow' | 'red';

export interface PoseLike {
  id: number;
  transform: Mat4;
}

export interface ScannedPose extends PoseLike {
  count: number;
}

export interface DiffRow {
  tagId: number;
  status: DiffStatus;
  /** ‖Δt‖ in meters (updated rows only). */
  positionDeltaM?: number;
  /** Geodesic rotation delta in degrees (updated rows only). */
  rotationDeltaDeg?: number;
  /** ‖Δt‖ / ‖t_reference‖ × 100, or null near the origin (updated rows only). */
  percentChange?: number | null;
  /** Color class (updated rows only). */
  level?: DeltaLevel;
  /** Scan observations (updated and new rows). */
  count?: number;
}

export interface DiffSummary {
  updated: number;
  added: number;
  notScanned: number;
  medianPositionDeltaM: number | null;
  maxPositionDeltaM: number | null;
}

export function classifyDelta(
  positionM: number,
  rotationDeg: number,
  thresholds = DELTA_THRESHOLDS,
): DeltaLevel {
  const within = (t: { positionM: number; rotationDeg: number }) =>
    positionM < t.positionM && rotationDeg < t.rotationDeg;
  if (within(thresholds.green)) return 'green';
  if (within(thresholds.yellow)) return 'yellow';
  return 'red';
}

export function percentChange(positionDeltaM: number, referenceDistanceM: number): number | null {
  if (referenceDistanceM < PERCENT_MIN_DISTANCE_M) return null;
  return (positionDeltaM / referenceDistanceM) * 100;
}

/** Compare a reference set with scanned poses in the field frame (R-5.5.1). */
export function diffSets(
  reference: readonly PoseLike[],
  scanned: readonly ScannedPose[],
): DiffRow[] {
  const refById = new Map(reference.map((r) => [r.id, r]));
  const scanById = new Map(scanned.map((s) => [s.id, s]));
  const ids = [...new Set([...refById.keys(), ...scanById.keys()])].sort((a, b) => a - b);

  return ids.map((tagId): DiffRow => {
    const ref = refById.get(tagId);
    const scan = scanById.get(tagId);
    if (!scan) return { tagId, status: 'not-scanned' };
    if (!ref) return { tagId, status: 'new', count: scan.count };
    const refT = translationOf(ref.transform);
    const positionDeltaM = norm(sub(translationOf(scan.transform), refT));
    const rotationDeltaDeg = rotationAngleDeg(
      rotationOf(ref.transform),
      rotationOf(scan.transform),
    );
    return {
      tagId,
      status: 'updated',
      positionDeltaM,
      rotationDeltaDeg,
      percentChange: percentChange(positionDeltaM, norm(refT)),
      level: classifyDelta(positionDeltaM, rotationDeltaDeg),
      count: scan.count,
    };
  });
}

/** Summary header for the comparison screen (R-5.5.3). */
export function summarize(rows: readonly DiffRow[]): DiffSummary {
  const deltas = rows
    .filter((r) => r.status === 'updated')
    .map((r) => r.positionDeltaM!)
    .sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  const median = !deltas.length
    ? null
    : deltas.length % 2
      ? deltas[mid]!
      : (deltas[mid - 1]! + deltas[mid]!) / 2;
  return {
    updated: deltas.length,
    added: rows.filter((r) => r.status === 'new').length,
    notScanned: rows.filter((r) => r.status === 'not-scanned').length,
    medianPositionDeltaM: median,
    maxPositionDeltaM: deltas.length ? deltas[deltas.length - 1]! : null,
  };
}
