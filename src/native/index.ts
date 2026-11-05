import ApriltagAr from 'apriltag-ar';

export { ApriltagArView } from 'apriltag-ar';
export type { FrameEvent, TrackingState } from 'apriltag-ar';

/** False when the native module is missing (Expo Go, tests) or the device has no ARKit/ARCore. */
export async function isArSupported(): Promise<boolean> {
  if (!ApriltagAr) return false;
  try {
    return await ApriltagAr.isSupportedAsync();
  } catch {
    return false;
  }
}

export async function requestCameraPermission(): Promise<boolean> {
  if (!ApriltagAr) return false;
  return ApriltagAr.requestCameraPermissionAsync();
}
