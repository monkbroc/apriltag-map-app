package expo.modules.apriltagar

import java.nio.ByteBuffer

/** JNI bindings to atag_bridge.c (see src/main/cpp/atag_jni.c). */
internal object AtagNative {
  /** Doubles per detection in [detect]'s output array. */
  const val STRIDE = 26

  init {
    System.loadLibrary("apriltag_ar")
  }

  @JvmStatic external fun create(decimate: Float, nthreads: Int): Long

  @JvmStatic external fun destroy(handle: Long)

  /**
   * Detects tags in a grayscale image held in a direct [ByteBuffer]. Writes [STRIDE] doubles per
   * detection to [out]: id, hamming, margin, corners(8), rotation(9, row-major), translation(3),
   * poseError, pixelSize, viewAngleDeg. Returns the number of detections.
   */
  @JvmStatic
  external fun detect(
    handle: Long,
    gray: ByteBuffer,
    width: Int,
    height: Int,
    stride: Int,
    fx: Double,
    fy: Double,
    cx: Double,
    cy: Double,
    tagSizeM: Double,
    out: DoubleArray,
  ): Int
}
