import { ZUP_FROM_AR, align, toField, type ReferenceTag } from '.';
import {
  apply3,
  det3,
  invert4,
  mat3FromEuler,
  mat4FromRT,
  mul4,
  norm,
  rotZ,
  rotationAngleDeg,
  rotationOf,
  sub,
  translationOf,
  type Mat4,
} from '../math';
import type { AggregatedTag } from '../scan';
import { expectMatClose, gaussian, rng } from '../testUtils';

/** A small synthetic field: tags on walls, facing inward, at different heights. */
const field: ReferenceTag[] = [
  [1, 8, 3, 1.2, 180],
  [2, 8, -3, 1.2, 180],
  [3, -8, 0, 1.4, 0],
  [4, 0, 4, 0.6, -90],
  [5, 2, -4, 0.9, 90],
].map(([id, x, y, z, yaw]) => ({
  id: id!,
  transform: mat4FromRT(mat3FromEuler({ yawDeg: yaw!, pitchDeg: 0, rollDeg: 0 }), [x!, y!, z!]),
}));

/** The (unknown) AR session origin, expressed in field coordinates. */
function arWorldFromField(yawRad: number, t: [number, number, number]): Mat4 {
  const fieldFromZup = mat4FromRT(rotZ(yawRad), t);
  // fieldFromWorld = fieldFromZup · ZUP_FROM_AR, so worldFromField is its inverse.
  return invert4(mul4(fieldFromZup, ZUP_FROM_AR));
}

function scanOf(worldFromField: Mat4, tags: ReferenceTag[], noise = 0, seed = 1): AggregatedTag[] {
  const rand = rng(seed);
  return tags.map((t) => {
    const w = mul4(worldFromField, t.transform);
    const p = translationOf(w).map((v) => v + gaussian(rand, noise)) as [number, number, number];
    return { tagId: t.id, count: 20, worldFromTag: mat4FromRT(rotationOf(w), p) };
  });
}

describe('ZUP_FROM_AR', () => {
  it('maps AR up (+Y) to field up (+Z)', () => {
    expectMatClose(apply3(rotationOf(ZUP_FROM_AR), [0, 1, 0]), [0, 0, 1]);
    expect(det3(rotationOf(ZUP_FROM_AR))).toBeCloseTo(1, 12);
  });
});

describe('align', () => {
  const worldFromField = arWorldFromField(1.1, [3, -2, 0.4]);

  it('recovers the transform exactly from noiseless positions', () => {
    const r = align(scanOf(worldFromField, field), field);
    if (!r.ok) throw new Error(r.error);
    expect(r.method).toBe('positions');
    expect(r.rmsM).toBeLessThan(1e-9);
    expectMatClose(r.fieldFromWorld, invert4(worldFromField), 1e-9);
    const placed = toField(r.fieldFromWorld, scanOf(worldFromField, field));
    placed.forEach((p, i) => expectMatClose(p.transform, field[i]!.transform, 1e-9));
  });

  it('stays within a few mm with 1 cm of noise', () => {
    const r = align(scanOf(worldFromField, field, 0.01, 5), field);
    if (!r.ok) throw new Error(r.error);
    const err = mul4(r.fieldFromWorld, worldFromField);
    expect(norm(translationOf(err))).toBeLessThan(0.02);
    expect(
      rotationAngleDeg(rotationOf(err), rotationOf(mat4FromRT(rotZ(0), [0, 0, 0]))),
    ).toBeLessThan(0.3);
    expect(r.rmsM).toBeGreaterThan(0.001);
    expect(r.rmsM).toBeLessThan(0.03);
  });

  it('uses the single best-observed tag when only one is shared', () => {
    const scan = scanOf(worldFromField, field).map((s) => ({
      ...s,
      count: s.tagId === 3 ? 50 : 5,
    }));
    const r = align(
      scan,
      field.filter((f) => f.id === 3),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.method).toBe('single-tag');
    expect(r.rmsM).toBe(0);
    expectMatClose(r.fieldFromWorld, invert4(worldFromField), 1e-9);
  });

  it('falls back to a single tag when shared tags are not spread out in XY', () => {
    const stacked: ReferenceTag[] = [
      field[0]!,
      { id: 9, transform: mat4FromRT(rotationOf(field[0]!.transform), [8, 3, 2]) },
    ];
    const r = align(scanOf(worldFromField, stacked), stacked);
    expect(r.ok && r.method).toBe('single-tag');
  });

  it('lets the user exclude a moved tag from the fit', () => {
    const moved = field.map((f) =>
      f.id === 4 ? { ...f, transform: mat4FromRT(rotationOf(f.transform), [0.3, 4, 0.6]) } : f,
    );
    const scan = scanOf(worldFromField, moved);
    const withMoved = align(scan, field);
    const without = align(scan, field, new Set([4]));
    if (!withMoved.ok || !without.ok) throw new Error('fit failed');
    expect(withMoved.rmsM).toBeGreaterThan(0.05);
    expect(without.rmsM).toBeLessThan(1e-9);
    const r4 = without.residuals.find((r) => r.tagId === 4)!;
    expect(r4.excluded).toBe(true);
    expect(r4.residualM).toBeCloseTo(0.3, 9);
  });

  it('reports errors when nothing can be aligned', () => {
    const scan = scanOf(worldFromField, field.slice(0, 1));
    expect(align(scan, field.slice(1))).toEqual({ ok: false, error: 'no-shared-tags' });
    expect(align(scan, field, new Set([1]))).toEqual({ ok: false, error: 'all-excluded' });
  });

  it('places unreferenced scanned tags in the field frame too', () => {
    const scan = scanOf(worldFromField, field);
    const r = align(scan.slice(0, 3), field);
    if (!r.ok) throw new Error(r.error);
    const extra = toField(r.fieldFromWorld, scan.slice(3));
    extra.forEach((e) =>
      expect(
        norm(
          sub(
            translationOf(e.transform),
            translationOf(field.find((f) => f.id === e.id)!.transform),
          ),
        ),
      ).toBeLessThan(1e-9),
    );
  });
});
