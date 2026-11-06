/**
 * Field frames. The .fmap file uses a field-centered origin (what Limelight's map files use),
 * while the app shows and edits poses in WPIBlue: origin at the blue-alliance corner, same axes,
 * all coordinates positive on the field (Limelight "Field Space (FRC WPIBlue)", WPILib).
 */
import { DEFAULT_FIELD } from './config';
import { mat4FromRT, rotationOf, translationOf, type Mat4 } from './math';
import type { PoseFields } from './pose';
import type { FieldDimensions } from './types';

/** Field size for a set, falling back to the default FRC field. */
export function fieldOf(set: { field?: FieldDimensions }): FieldDimensions {
  return set.field ?? DEFAULT_FIELD;
}

function shift(t: Mat4, dx: number, dy: number): Mat4 {
  const [x, y, z] = translationOf(t);
  return mat4FromRT(rotationOf(t), [x + dx, y + dy, z]);
}

/** Field-centered (.fmap) → WPIBlue. */
export function toWpiBlue(t: Mat4, field: FieldDimensions): Mat4 {
  return shift(t, field.lengthM / 2, field.widthM / 2);
}

/** WPIBlue → field-centered (.fmap). */
export function fromWpiBlue(t: Mat4, field: FieldDimensions): Mat4 {
  return shift(t, -field.lengthM / 2, -field.widthM / 2);
}

/** Same as `fromWpiBlue` for editable pose fields (rotation is unchanged between the frames). */
export function poseFromWpiBlue(p: PoseFields, field: FieldDimensions): PoseFields {
  return { ...p, x: p.x - field.lengthM / 2, y: p.y - field.widthM / 2 };
}

export function poseToWpiBlue(p: PoseFields, field: FieldDimensions): PoseFields {
  return { ...p, x: p.x + field.lengthM / 2, y: p.y + field.widthM / 2 };
}
