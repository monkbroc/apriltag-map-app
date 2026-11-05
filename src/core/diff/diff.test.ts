import { classifyDelta, diffSets, percentChange, summarize } from '.';
import { mat3FromEuler, mat4FromRT } from '../math';

const pose = (id: number, x: number, y: number, yawDeg = 0, count = 20) => ({
  id,
  count,
  transform: mat4FromRT(mat3FromEuler({ yawDeg, pitchDeg: 0, rollDeg: 0 }), [x, y, 0]),
});

describe('classifyDelta', () => {
  it.each([
    [0.019, 0.9, 'green'],
    [0.02, 0.5, 'yellow'],
    [0.01, 1, 'yellow'],
    [0.049, 2.9, 'yellow'],
    [0.05, 0, 'red'],
    [0, 3, 'red'],
  ])('%p m, %p° is %s', (m, deg, level) => expect(classifyDelta(m, deg)).toBe(level));
});

describe('percentChange', () => {
  it('divides by the distance from the origin', () => expect(percentChange(0.05, 5)).toBe(1));
  it('is undefined near the origin', () => {
    expect(percentChange(0.05, 0.099)).toBeNull();
    expect(percentChange(0.05, 0.1)).toBeCloseTo(50);
  });
});

describe('diffSets', () => {
  const reference = [pose(1, 4, 3), pose(2, -5, 0), pose(3, 0, 0.05)];
  const scanned = [pose(1, 4.03, 3.04, 2), pose(3, 0, 0.06), pose(9, 1, 1, 0, 15)];
  const rows = diffSets(reference, scanned);

  it('lists every tag once, sorted', () => {
    expect(rows.map((r) => [r.tagId, r.status])).toEqual([
      [1, 'updated'],
      [2, 'not-scanned'],
      [3, 'updated'],
      [9, 'new'],
    ]);
  });

  it('computes deltas for updated tags', () => {
    const r1 = rows[0]!;
    expect(r1.positionDeltaM).toBeCloseTo(0.05, 9);
    expect(r1.rotationDeltaDeg).toBeCloseTo(2, 9);
    expect(r1.percentChange).toBeCloseTo(1, 9);
    expect(r1.level).toBe('red');
    expect(r1.count).toBe(20);
    expect(rows[2]!.percentChange).toBeNull();
    expect(rows[2]!.level).toBe('green');
    expect(rows[3]!.count).toBe(15);
  });

  it('summarizes', () => {
    const s = summarize(rows);
    expect(s).toMatchObject({ updated: 2, added: 1, notScanned: 1 });
    expect(s.medianPositionDeltaM).toBeCloseTo(0.03, 9);
    expect(s.maxPositionDeltaM).toBeCloseTo(0.05, 9);
    expect(summarize(diffSets(reference, [pose(2, -5, 0.01)])).medianPositionDeltaM).toBeCloseTo(
      0.01,
      9,
    );
    expect(summarize([])).toMatchObject({ medianPositionDeltaM: null, maxPositionDeltaM: null });
  });
});
