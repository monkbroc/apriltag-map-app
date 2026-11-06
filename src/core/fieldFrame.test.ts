import { fieldOf, fromWpiBlue, poseFromWpiBlue, poseToWpiBlue, toWpiBlue } from './fieldFrame';
import { mat3FromEuler, mat4FromRT, rotationOf, translationOf } from './math';
import { expectMatClose } from './testUtils';

const field = { lengthM: 16.541, widthM: 8.069 };

describe('WPIBlue conversion', () => {
  it('moves the origin to the blue-alliance corner and keeps rotation', () => {
    // FRC 2026 tag 1: field-centered (3.60748, 3.390276) is WPIBlue (11.8779798, 7.4247756).
    const r = mat3FromEuler({ yawDeg: 180, pitchDeg: 0, rollDeg: 0 });
    const centered = mat4FromRT(r, [3.60748, 3.390276, 0.889]);
    const blue = toWpiBlue(centered, field);
    expectMatClose(translationOf(blue), [11.87798, 7.424776, 0.889], 1e-6);
    expectMatClose(rotationOf(blue), r);
    expectMatClose(fromWpiBlue(blue, field), centered, 1e-12);
  });

  it('converts editable pose fields both ways', () => {
    const p = { x: 1, y: 2, z: 0.5, yawDeg: 90, pitchDeg: 0, rollDeg: 0 };
    expect(poseToWpiBlue(poseFromWpiBlue(p, field), field)).toEqual(p);
    expect(poseFromWpiBlue(p, field).x).toBeCloseTo(1 - 8.2705, 9);
  });

  it('falls back to the default field', () => {
    expect(fieldOf({})).toEqual(field);
    expect(fieldOf({ field: { lengthM: 1, widthM: 2 } })).toEqual({ lengthM: 1, widthM: 2 });
  });
});
