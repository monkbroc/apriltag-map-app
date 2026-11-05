#include "atag_bridge.h"

#include <math.h>
#include <stdlib.h>

#include "apriltag/apriltag.h"
#include "apriltag/apriltag_pose.h"
#include "apriltag/common/matd.h"
#include "apriltag/tag36h11.h"

struct atag_detector {
  apriltag_detector_t *td;
  apriltag_family_t *family;
};

atag_detector *atag_create(float decimate, int nthreads) {
  atag_detector *d = calloc(1, sizeof(*d));
  if (!d) return NULL;
  d->family = tag36h11_create();
  d->td = apriltag_detector_create();
  apriltag_detector_add_family_bits(d->td, d->family, 1);
  d->td->quad_decimate = decimate;
  d->td->nthreads = nthreads;
  d->td->quad_sigma = 0.0f;
  d->td->refine_edges = true;
  d->td->decode_sharpening = 0.25;
  return d;
}

void atag_destroy(atag_detector *d) {
  if (!d) return;
  apriltag_detector_destroy(d->td);
  tag36h11_destroy(d->family);
  free(d);
}

static double side(const double p[4][2], int a, int b) {
  return hypot(p[a][0] - p[b][0], p[a][1] - p[b][1]);
}

int atag_detect(atag_detector *d, const uint8_t *gray, int width, int height, int stride,
                double fx, double fy, double cx, double cy, double tag_size_m,
                atag_detection *out, int max_out) {
  if (!d || !gray || !out || max_out <= 0) return 0;
  image_u8_t im = {.width = width, .height = height, .stride = stride, .buf = (uint8_t *)gray};
  zarray_t *detections = apriltag_detector_detect(d->td, &im);
  int n = 0;
  for (int i = 0; i < zarray_size(detections) && n < max_out; i++) {
    apriltag_detection_t *det;
    zarray_get(detections, i, &det);

    apriltag_detection_info_t info = {
        .det = det, .tagsize = tag_size_m, .fx = fx, .fy = fy, .cx = cx, .cy = cy};
    apriltag_pose_t pose;
    double err = estimate_tag_pose(&info, &pose);
    if (!pose.R || !pose.t) continue;

    atag_detection *o = &out[n++];
    o->id = det->id;
    o->hamming = det->hamming;
    o->decision_margin = det->decision_margin;
    o->pose_error = err;
    for (int c = 0; c < 4; c++) {
      o->corners[2 * c] = det->p[c][0];
      o->corners[2 * c + 1] = det->p[c][1];
    }
    for (int r = 0; r < 3; r++) {
      for (int c = 0; c < 3; c++) o->rotation[3 * r + c] = MATD_EL(pose.R, r, c);
      o->translation[r] = MATD_EL(pose.t, r, 0);
    }
    double s = side(det->p, 0, 1);
    for (int c = 1; c < 4; c++) {
      double sc = side(det->p, c, (c + 1) % 4);
      if (sc < s) s = sc;
    }
    o->pixel_size = s;

    // Tag z axis (into the tag) is column 2 of R; the ray to the tag is t.
    double tn = sqrt(o->translation[0] * o->translation[0] + o->translation[1] * o->translation[1] +
                     o->translation[2] * o->translation[2]);
    double cosang = tn > 0 ? (o->rotation[2] * o->translation[0] + o->rotation[5] * o->translation[1] +
                              o->rotation[8] * o->translation[2]) / tn
                           : 1;
    if (cosang > 1) cosang = 1;
    if (cosang < -1) cosang = -1;
    o->view_angle_deg = acos(cosang) * 180.0 / M_PI;

    matd_destroy(pose.R);
    matd_destroy(pose.t);
  }
  apriltag_detections_destroy(detections);
  return n;
}
