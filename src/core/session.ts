import { align, toField, type AlignResult, type FieldTag, type ReferenceTag } from './align';
import { MIN_OBSERVATIONS } from './config';
import { diffSets, summarize } from './diff';
import { eligibleScans, mergeReplaceAllSeen } from './merge';
import type { AggregatedTag } from './scan';
import type { Fiducial } from './types';

export type ScanOutcome =
  | { ok: true; alignment: Extract<AlignResult, { ok: true }>; placed: FieldTag[] }
  | { ok: false; error: Extract<AlignResult, { ok: false }>['error'] | 'no-eligible-tags' };

/**
 * From the aggregated scan, keep tags with enough observations, align them to the reference
 * poses and place them in the field frame (R-5.3.2, R-5.4).
 */
export function computeScanOutcome(
  aggregated: readonly AggregatedTag[],
  reference: readonly ReferenceTag[],
  excludedIds: ReadonlySet<number> = new Set(),
  minObservations = MIN_OBSERVATIONS,
): ScanOutcome {
  const eligible = aggregated.filter((a) => a.count >= minObservations);
  if (!eligible.length) return { ok: false, error: 'no-eligible-tags' };
  const alignment = align(eligible, reference, excludedIds);
  if (!alignment.ok) return { ok: false, error: alignment.error };
  return { ok: true, alignment, placed: toField(alignment.fieldFromWorld, eligible) };
}

/** Comparison rows, summary and merged fiducials for a refine scan (R-5.5). */
export function refineResult(reference: readonly Fiducial[], placed: readonly FieldTag[]) {
  const rows = diffSets(reference, placed);
  return {
    rows,
    summary: summarize(rows),
    merged: mergeReplaceAllSeen(reference, placed, 0),
  };
}

/** Fiducials for a fresh scan (R-5.5.7): every placed tag with the default size. */
export function freshResult(placed: readonly FieldTag[]): Fiducial[] {
  return mergeReplaceAllSeen([], placed, 0);
}

/** "2026-11-05" in local time, for default set names. */
export function isoDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const OUTCOME_MESSAGES: Record<Extract<ScanOutcome, { ok: false }>['error'], string> = {
  'no-eligible-tags': `No tag was seen at least ${MIN_OBSERVATIONS} times. Keep scanning.`,
  'no-shared-tags': 'None of the scanned tags are in the reference set. Rescan or discard.',
  'all-excluded': 'Every reference tag is excluded from the fit. Include at least one.',
};

export { eligibleScans };
