// Host-side check of atag_bridge: render a synthetic tag36h11 tag with a pinhole camera at a
// known pose, detect it, and compare. Not part of the app build.
//
//   gcc -O2 -I.. -I../apriltag -o atag_test atag_bridge_test.c ../atag_bridge.c ../apriltag/*.c \
//       ../apriltag/common/*.c -lm -lpthread && ./atag_test
#include <math.h>
#include <stdio.h>
#include <stdlib.h>

#include "../apriltag/apriltag.h"
#include "../apriltag/tag36h11.h"
#include "../atag_bridge.h"

#define W 1280
#define H 720
static const double K_FX = 900, K_FY = 900, K_CX = 640, K_CY = 360, TAG_SIZE = 0.1651;

static void rot_y(double deg, double R[9]) {
  double a = deg * M_PI / 180, c = cos(a), s = sin(a);
  double m[9] = {c, 0, s, 0, 1, 0, -s, 0, c};
  for (int i = 0; i < 9; i++) R[i] = m[i];
}

/** Render tag `id` at camera-frame pose (R, t), AprilTag tag axes. */
static void render(uint8_t *img, int id, const double R[9], const double t[3]) {
  apriltag_family_t *tf = tag36h11_create();
  image_u8_t *tag = apriltag_to_image(tf, id);
  double cell = TAG_SIZE / tf->width_at_border;
  double half = cell * tag->width / 2.0;
  // Camera origin and rays expressed in the tag frame: o = -Rᵀt, dir = Rᵀd.
  double o[3];
  for (int i = 0; i < 3; i++) o[i] = -(R[i] * t[0] + R[3 + i] * t[1] + R[6 + i] * t[2]);
  for (int py = 0; py < H; py++) {
    for (int px = 0; px < W; px++) {
      int sum = 0;
      for (int sy = 0; sy < 2; sy++) {
        for (int sx = 0; sx < 2; sx++) {
          double d[3] = {(px + 0.25 + 0.5 * sx - K_CX) / K_FX, (py + 0.25 + 0.5 * sy - K_CY) / K_FY, 1};
          double dt[3];
          for (int i = 0; i < 3; i++) dt[i] = R[i] * d[0] + R[3 + i] * d[1] + R[6 + i] * d[2];
          double lambda = -o[2] / dt[2];
          double u = o[0] + lambda * dt[0], v = o[1] + lambda * dt[1];
          int col = (int)floor((u + half) / cell), row = (int)floor((v + half) / cell);
          int value = 255;
          if (lambda > 0 && col >= 0 && col < tag->width && row >= 0 && row < tag->height)
            value = tag->buf[row * tag->stride + col];
          sum += value;
        }
      }
      img[py * W + px] = (uint8_t)(sum / 4);
    }
  }
  image_u8_destroy(tag);
  tag36h11_destroy(tf);
}

static int check(int id, double yaw_deg, double tx, double ty, double tz) {
  static uint8_t img[W * H];
  double R[9], t[3] = {tx, ty, tz};
  rot_y(yaw_deg, R);
  render(img, id, R, t);

  atag_detector *d = atag_create(2.0f, 2);
  atag_detection out[4];
  int n = atag_detect(d, img, W, H, W, K_FX, K_FY, K_CX, K_CY, TAG_SIZE, out, 4);
  atag_destroy(d);

  if (n != 1 || out[0].id != id) {
    printf("FAIL id=%d yaw=%.0f: %d detections (first id %d)\n", id, yaw_deg, n, n ? out[0].id : -1);
    return 1;
  }
  double dt = 0, dr = 0;
  for (int i = 0; i < 3; i++) dt = fmax(dt, fabs(out[0].translation[i] - t[i]));
  for (int i = 0; i < 9; i++) dr = fmax(dr, fabs(out[0].rotation[i] - R[i]));
  // Expected view angle: between the camera ray t and the tag z axis (column 2 of R).
  double tn = sqrt(t[0] * t[0] + t[1] * t[1] + t[2] * t[2]);
  double view = acos((R[2] * t[0] + R[5] * t[1] + R[8] * t[2]) / tn) * 180 / M_PI;
  int ok = dt < 0.01 && dr < 0.03 && fabs(out[0].view_angle_deg - view) < 2 &&
           out[0].hamming == 0;
  printf("%s id=%d yaw=%.0f: |dt|=%.4f m |dR|=%.4f view=%.1f° margin=%.0f px=%.0f\n",
         ok ? "ok  " : "FAIL", id, yaw_deg, dt, dr, out[0].view_angle_deg,
         out[0].decision_margin, out[0].pixel_size);
  return !ok;
}

int main(void) {
  int failures = 0;
  failures += check(1, 0, 0.0, 0.0, 1.0);
  failures += check(7, 25, 0.1, -0.05, 1.5);
  failures += check(31, -40, -0.15, 0.08, 1.2);
  failures += check(586, 10, 0.0, 0.1, 2.5);
  printf(failures ? "%d FAILED\n" : "all passed\n", failures);
  return failures != 0;
}
