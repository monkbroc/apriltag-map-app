// Thin C API over the AprilTag 3 library, shared by the iOS (Swift) and Android (JNI) code.
#ifndef ATAG_BRIDGE_H
#define ATAG_BRIDGE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
  int id;
  int hamming;
  float decision_margin;
  /** Quad corners in image pixels: x0,y0, x1,y1, x2,y2, x3,y3. */
  double corners[8];
  /** Tag pose in the camera frame (x right, y down, z forward), AprilTag tag axes. */
  double rotation[9]; /* row-major */
  double translation[3]; /* meters */
  /** Reprojection error reported by estimate_tag_pose. */
  double pose_error;
  /** Shortest side of the quad, in pixels. */
  double pixel_size;
  /** Angle between the camera ray and the tag normal, in degrees. */
  double view_angle_deg;
} atag_detection;

typedef struct atag_detector atag_detector;

/** Create a tag36h11 detector. `decimate` is quad_decimate (e.g. 2), `nthreads` worker threads. */
atag_detector *atag_create(float decimate, int nthreads);
void atag_destroy(atag_detector *detector);

/**
 * Detect tags in an 8-bit grayscale image (for example the Y plane of a YUV frame) and estimate
 * each tag's pose. Returns the number of detections written to `out` (at most `max_out`).
 */
int atag_detect(atag_detector *detector, const uint8_t *gray, int width, int height, int stride,
                double fx, double fy, double cx, double cy, double tag_size_m,
                atag_detection *out, int max_out);

#ifdef __cplusplus
}
#endif

#endif
