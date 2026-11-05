/**
 * Replays simulated scans through the same path the app uses: native frame events ->
 * scan session store -> alignment -> diff -> merge (PLAN Phase 6, step 7).
 */
import { mat4FromRT, norm, rotationAngleDeg, rotationOf, sub, translationOf } from '@/core/math';
import { computeScanOutcome, freshResult, refineResult } from '@/core/session';
import { builtinSets } from '@/data/builtinSets';
import { useScanSession } from '@/state/scanSession';

import { simulateScan } from '@/testing/simulate';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('@/storage/repository', () => ({}));

const frc2026 = builtinSets[0]!;
const truth = frc2026.fiducials.filter((f) => [1, 2, 3, 4, 9, 10, 17, 25, 26].includes(f.id));

/** The real field: tag 9 was moved 12 cm along X, everything else matches the reference. */
const actual = truth.map((f) =>
  f.id === 9
    ? {
        ...f,
        transform: mat4FromRT(rotationOf(f.transform), [
          translationOf(f.transform)[0] + 0.12,
          translationOf(f.transform)[1],
          translationOf(f.transform)[2],
        ]),
      }
    : f,
);

function scan(frames = simulateScan(actual), mode: 'refine' | 'fresh' = 'refine') {
  const s = useScanSession.getState();
  s.start(mode, mode === 'refine' ? frc2026.id : undefined);
  for (const f of frames) useScanSession.getState().ingestFrame(f);
  return useScanSession.getState();
}

describe('scan flow replay', () => {
  it('counts observations per tag', () => {
    const state = scan();
    expect(Object.keys(state.counts)).toHaveLength(actual.length);
    expect(Object.values(state.counts).every((n) => n === 15)).toBe(true);
  });

  it('ignores frames while paused and frames with limited tracking', () => {
    const frames = simulateScan(actual.slice(0, 1));
    const s = useScanSession.getState();
    s.start('fresh');
    s.setPaused(true);
    frames.slice(0, 5).forEach((f) => useScanSession.getState().ingestFrame(f));
    useScanSession.getState().setPaused(false);
    frames
      .slice(5, 8)
      .forEach((f) => useScanSession.getState().ingestFrame({ ...f, tracking: 'limited' }));
    frames.slice(8).forEach((f) => useScanSession.getState().ingestFrame(f));
    expect(useScanSession.getState().counts[actual[0]!.id]).toBe(7);
    expect(useScanSession.getState().overlay).toHaveLength(1);
  });

  it('refines the built-in set: flags the moved tag, keeps the rest green', () => {
    const state = scan();
    const all = computeScanOutcome(state.aggregated(), frc2026.fiducials);
    if (!all.ok) throw new Error(all.error);
    // Excluding the moved tag tightens the fit.
    const outcome = computeScanOutcome(state.aggregated(), frc2026.fiducials, new Set([9]));
    if (!outcome.ok) throw new Error(outcome.error);
    expect(outcome.alignment.rmsM).toBeLessThan(all.alignment.rmsM);
    expect(outcome.alignment.rmsM).toBeLessThan(0.01);

    const { rows, summary, merged } = refineResult(frc2026.fiducials, outcome.placed);
    expect(summary).toMatchObject({ updated: 9, added: 0, notScanned: 32 - 9 });
    const moved = rows.find((r) => r.tagId === 9)!;
    expect(moved.level).toBe('red');
    expect(moved.positionDeltaM).toBeGreaterThan(0.1);
    expect(moved.positionDeltaM).toBeLessThan(0.14);
    for (const r of rows.filter((r) => r.status === 'updated' && r.tagId !== 9)) {
      expect(r.level).toBe('green');
    }

    // Merged set: scanned tags match the real field, unscanned keep reference values.
    expect(merged).toHaveLength(32);
    for (const a of actual) {
      const m = merged.find((f) => f.id === a.id)!;
      expect(norm(sub(translationOf(m.transform), translationOf(a.transform)))).toBeLessThan(0.01);
      expect(rotationAngleDeg(rotationOf(m.transform), rotationOf(a.transform))).toBeLessThan(0.5);
      expect(m.observationCount).toBe(15);
    }
    expect(merged.find((f) => f.id === 5)).toEqual(frc2026.fiducials.find((f) => f.id === 5));
  });

  it('builds a fresh map relative to one hand-entered reference tag', () => {
    const state = scan(simulateScan(actual), 'fresh');
    const ref = actual[0]!;
    const outcome = computeScanOutcome(state.aggregated(), [ref]);
    if (!outcome.ok) throw new Error(outcome.error);
    expect(outcome.alignment.method).toBe('single-tag');
    const fiducials = freshResult(outcome.placed);
    expect(fiducials.map((f) => f.id)).toEqual(actual.map((f) => f.id));
    for (const a of actual) {
      const f = fiducials.find((x) => x.id === a.id)!;
      expect(f.size).toBe(165.1);
      // Single-tag alignment amplifies the reference tag's yaw noise over distance.
      expect(norm(sub(translationOf(f.transform), translationOf(a.transform)))).toBeLessThan(0.1);
    }
  });

  it('reports when no tag was seen often enough', () => {
    const state = scan(simulateScan(actual, { framesPerTag: 3 }));
    expect(computeScanOutcome(state.aggregated(), frc2026.fiducials)).toEqual({
      ok: false,
      error: 'no-eligible-tags',
    });
  });
});
