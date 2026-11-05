import {
  IDENTITY3,
  apply3,
  det3,
  eulerFromMat3,
  invert4,
  mat3FromEuler,
  mat3FromQuat,
  mat4FromRT,
  mul3,
  mul4,
  norm,
  orthonormalityError,
  orthonormalize,
  quatFromMat3,
  rotZ,
  rotationAngleDeg,
  transformPoint,
  transpose3,
  yawOf,
  type Mat3,
  type Vec3,
} from '.';
import { expectMatClose, rng } from '../testUtils';

describe('Euler <-> matrix', () => {
  const rand = rng(42);
  it('round-trips random angles', () => {
    for (let i = 0; i < 200; i++) {
      const e = {
        yawDeg: rand() * 360 - 180,
        pitchDeg: rand() * 170 - 85,
        rollDeg: rand() * 360 - 180,
      };
      const back = eulerFromMat3(mat3FromEuler(e));
      expect(back.yawDeg).toBeCloseTo(e.yawDeg, 6);
      expect(back.pitchDeg).toBeCloseTo(e.pitchDeg, 6);
      expect(back.rollDeg).toBeCloseTo(e.rollDeg, 6);
    }
  });

  it('identity is zero angles', () => {
    expect(eulerFromMat3(IDENTITY3)).toEqual({ yawDeg: 0, pitchDeg: -0, rollDeg: 0 });
  });

  it('handles gimbal lock by folding roll into yaw', () => {
    const m = mat3FromEuler({ yawDeg: 30, pitchDeg: 90, rollDeg: 0 });
    const e = eulerFromMat3(m);
    expect(e.pitchDeg).toBeCloseTo(90, 6);
    expect(e.rollDeg).toBe(0);
    expectMatClose(mat3FromEuler(e), m, 1e-6);
  });

  it('yaw rotates +X toward +Y', () => {
    const v = apply3(mat3FromEuler({ yawDeg: 90, pitchDeg: 0, rollDeg: 0 }), [1, 0, 0]);
    expectMatClose(v, [0, 1, 0]);
  });
});

describe('quaternions', () => {
  const rand = rng(7);
  it('round-trips through matrices, including every Shepperd branch', () => {
    const cases: Mat3[] = [
      IDENTITY3,
      mat3FromEuler({ yawDeg: 180, pitchDeg: 0, rollDeg: 0 }),
      mat3FromEuler({ yawDeg: 0, pitchDeg: 0, rollDeg: 180 }),
      mat3FromEuler({ yawDeg: 0, pitchDeg: 180, rollDeg: 0 }),
      [1, 0, 0, 0, -1, 0, 0, 0, -1],
      [-1, 0, 0, 0, 1, 0, 0, 0, -1],
      [-1, 0, 0, 0, -1, 0, 0, 0, 1],
    ];
    for (let i = 0; i < 100; i++) {
      cases.push(
        mat3FromEuler({
          yawDeg: rand() * 360,
          pitchDeg: rand() * 180 - 90,
          rollDeg: rand() * 360,
        }),
      );
    }
    for (const m of cases) expectMatClose(mat3FromQuat(quatFromMat3(m)), m, 1e-9);
  });

  it('normalizes a zero quaternion to identity', () => {
    expectMatClose(mat3FromQuat([0, 0, 0, 0]), IDENTITY3);
  });
});

describe('rotation helpers', () => {
  it('orthonormalize fixes small numeric drift', () => {
    const m = mat3FromEuler({ yawDeg: 20, pitchDeg: 10, rollDeg: -5 });
    const noisy = m.map((v, i) => v + (i % 2 ? 1e-4 : -1e-4));
    expect(orthonormalityError(noisy)).toBeGreaterThan(1e-5);
    const fixed = orthonormalize(noisy);
    expect(orthonormalityError(fixed)).toBeLessThan(1e-12);
    expect(det3(fixed)).toBeCloseTo(1, 12);
    expect(rotationAngleDeg(m, fixed)).toBeLessThan(0.05);
  });

  it('measures the geodesic angle between rotations', () => {
    expect(rotationAngleDeg(IDENTITY3, rotZ(Math.PI / 6))).toBeCloseTo(30, 9);
    expect(rotationAngleDeg(rotZ(1), rotZ(1))).toBeCloseTo(0, 6);
  });

  it('extracts yaw', () => {
    expect(yawOf(rotZ(0.7))).toBeCloseTo(0.7, 12);
    expect(yawOf(rotZ(-2.5))).toBeCloseTo(-2.5, 12);
  });

  it('transpose is the inverse of a rotation', () => {
    const m = mat3FromEuler({ yawDeg: 40, pitchDeg: -20, rollDeg: 70 });
    expectMatClose(mul3(m, transpose3(m)), IDENTITY3);
  });
});

describe('rigid transforms', () => {
  it('composes and inverts', () => {
    const a = mat4FromRT(mat3FromEuler({ yawDeg: 30, pitchDeg: 5, rollDeg: 10 }), [1, 2, 3]);
    const b = mat4FromRT(mat3FromEuler({ yawDeg: -60, pitchDeg: 0, rollDeg: 45 }), [-4, 0.5, 2]);
    const p: Vec3 = [0.3, -0.7, 1.1];
    expectMatClose(transformPoint(mul4(a, b), p), transformPoint(a, transformPoint(b, p)));
    expectMatClose(transformPoint(invert4(a), transformPoint(a, p)), p);
    expect(norm(transformPoint(mul4(a, invert4(a)), [0, 0, 0]))).toBeLessThan(1e-12);
  });
});
