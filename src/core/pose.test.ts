import { formatNumber, parseNumber, poseFromTransform, transformFromPose } from './pose';

describe('pose fields', () => {
  it('round-trips a pose', () => {
    const p = { x: 1.5, y: -2, z: 0.75, yawDeg: 120, pitchDeg: 10, rollDeg: -30 };
    const back = poseFromTransform(transformFromPose(p));
    for (const k of Object.keys(p) as (keyof typeof p)[]) expect(back[k]).toBeCloseTo(p[k], 9);
  });
});

describe('parseNumber', () => {
  it.each([
    ['1.5', 1.5],
    [' -2 ', -2],
    ['3,25', 3.25],
    ['.5', 0.5],
    ['1e-3', 0.001],
    ['', null],
    ['abc', null],
    ['1.2.3', null],
    ['-', null],
  ])('%p -> %p', (text, value) => expect(parseNumber(text)).toBe(value));
});

describe('formatNumber', () => {
  it.each([
    [1.5, '1.5'],
    [2, '2'],
    [1.23456, '1.235'],
    [-0.0001, '0'],
    [100, '100'],
  ])('%p -> %p', (v, s) => expect(formatNumber(v)).toBe(s));
});
