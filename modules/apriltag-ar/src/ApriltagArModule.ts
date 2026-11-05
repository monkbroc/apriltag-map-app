import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class ApriltagArNativeModule extends NativeModule {
  /** Whether this device supports ARKit world tracking / ARCore. */
  isSupportedAsync(): Promise<boolean>;
  /** Ask for camera access. Resolves true when granted. */
  requestCameraPermissionAsync(): Promise<boolean>;
}

/** Null when the native module is not in this build (for example Expo Go or tests). */
export default requireOptionalNativeModule<ApriltagArNativeModule>('ApriltagAr');
