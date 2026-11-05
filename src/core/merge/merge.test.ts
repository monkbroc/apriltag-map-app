import { eligibleScans, mergeReplaceAllSeen } from '.';
import { IDENTITY4, mat3FromEuler, mat4FromRT } from '../math';
import type { Fiducial } from '../types';

const fid = (id: number, size = 165.1): Fiducial => ({
  id,
  size,
  family: 'apriltag3_36h11_classic',
  unique: 1,
  transform: IDENTITY4,
});

const moved = mat4FromRT(mat3FromEuler({ yawDeg: 90, pitchDeg: 0, rollDeg: 0 }), [1, 2, 3]);

describe('eligibleScans', () => {
  it('keeps tags with enough observations', () => {
    const s = [
      { id: 1, count: 9, transform: moved },
      { id: 2, count: 10, transform: moved },
    ];
    expect(eligibleScans(s).map((x) => x.id)).toEqual([2]);
    expect(eligibleScans(s, 5)).toHaveLength(2);
  });
});

describe('mergeReplaceAllSeen', () => {
  const reference = [fid(1, 200), fid(2), fid(3)];
  const merged = mergeReplaceAllSeen(reference, [
    { id: 3, count: 12, transform: moved },
    { id: 1, count: 3, transform: moved },
    { id: 7, count: 30, transform: moved },
  ]);

  it('replaces seen tags and keeps their size', () => {
    const t3 = merged.find((f) => f.id === 3)!;
    expect(t3.transform).toEqual(moved);
    expect(t3.size).toBe(165.1);
    expect(t3.observationCount).toBe(12);
  });

  it('keeps tags that were not seen enough', () => {
    expect(merged.find((f) => f.id === 1)).toEqual(fid(1, 200));
    expect(merged.find((f) => f.id === 2)).toEqual(fid(2));
  });

  it('adds new tags with defaults', () => {
    expect(merged.find((f) => f.id === 7)).toMatchObject({
      size: 165.1,
      unique: 1,
      family: 'apriltag3_36h11_classic',
    });
    expect(merged.map((f) => f.id)).toEqual([1, 2, 3, 7]);
  });

  it('does not mutate the reference', () => {
    expect(reference[2]!.transform).toBe(IDENTITY4);
  });
});
