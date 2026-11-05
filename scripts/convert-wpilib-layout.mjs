#!/usr/bin/env node
// Converts a WPILib AprilTagFieldLayout JSON (origin at the blue-alliance corner,
// quaternion rotations) into a Limelight .fmap (origin at field center, row-major 4x4).
//
// Usage: node scripts/convert-wpilib-layout.mjs <wpilib.json> <out.fmap.json> [sizeMm]
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, output, sizeArg] = process.argv;
if (!input || !output) {
  console.error(
    'Usage: node scripts/convert-wpilib-layout.mjs <wpilib.json> <out.fmap.json> [sizeMm]',
  );
  process.exit(1);
}
const size = Number(sizeArg ?? 165.1);
const layout = JSON.parse(readFileSync(input, 'utf8'));
const { length, width } = layout.field;

const round = (v) => {
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
};

function matrix({ W: w, X: x, Y: y, Z: z }, t) {
  const n = Math.hypot(w, x, y, z);
  [w, x, y, z] = [w / n, x / n, y / n, z / n];
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - w * z),
    2 * (x * z + w * y),
    t.x - length / 2,
    2 * (x * y + w * z),
    1 - 2 * (x * x + z * z),
    2 * (y * z - w * x),
    t.y - width / 2,
    2 * (x * z - w * y),
    2 * (y * z + w * x),
    1 - 2 * (x * x + y * y),
    t.z,
    0,
    0,
    0,
    1,
  ].map(round);
}

const fmap = {
  type: 'frc',
  fiducials: layout.tags
    .map((tag) => ({
      family: 'apriltag3_36h11_classic',
      id: tag.ID,
      size,
      transform: matrix(tag.pose.rotation.quaternion, tag.pose.translation),
      unique: 1,
    }))
    .sort((a, b) => a.id - b.id),
};
writeFileSync(output, JSON.stringify(fmap, null, 2) + '\n');
console.log(`Wrote ${fmap.fiducials.length} tags to ${output} (field ${length} x ${width} m)`);
