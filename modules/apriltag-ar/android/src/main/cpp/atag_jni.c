// JNI glue between AtagNative.kt and atag_bridge.c.
#include <jni.h>

#include "atag_bridge.h"

/** Doubles written per detection; must match AtagNative.STRIDE. */
#define STRIDE 26
#define MAX_DETECTIONS 32

JNIEXPORT jlong JNICALL Java_expo_modules_apriltagar_AtagNative_create(JNIEnv *env, jclass cls,
                                                                        jfloat decimate,
                                                                        jint nthreads) {
  return (jlong)(intptr_t)atag_create(decimate, nthreads);
}

JNIEXPORT void JNICALL Java_expo_modules_apriltagar_AtagNative_destroy(JNIEnv *env, jclass cls,
                                                                        jlong handle) {
  atag_destroy((atag_detector *)(intptr_t)handle);
}

JNIEXPORT jint JNICALL Java_expo_modules_apriltagar_AtagNative_detect(
    JNIEnv *env, jclass cls, jlong handle, jobject gray, jint width, jint height, jint stride,
    jdouble fx, jdouble fy, jdouble cx, jdouble cy, jdouble tag_size_m, jdoubleArray out) {
  const uint8_t *pixels = (*env)->GetDirectBufferAddress(env, gray);
  if (!pixels) return 0;
  int capacity = (*env)->GetArrayLength(env, out) / STRIDE;
  if (capacity > MAX_DETECTIONS) capacity = MAX_DETECTIONS;

  atag_detection dets[MAX_DETECTIONS];
  int n = atag_detect((atag_detector *)(intptr_t)handle, pixels, width, height, stride, fx, fy, cx,
                      cy, tag_size_m, dets, capacity);

  jdouble buf[MAX_DETECTIONS * STRIDE];
  for (int i = 0; i < n; i++) {
    jdouble *o = &buf[i * STRIDE];
    const atag_detection *d = &dets[i];
    o[0] = d->id;
    o[1] = d->hamming;
    o[2] = d->decision_margin;
    for (int k = 0; k < 8; k++) o[3 + k] = d->corners[k];
    for (int k = 0; k < 9; k++) o[11 + k] = d->rotation[k];
    for (int k = 0; k < 3; k++) o[20 + k] = d->translation[k];
    o[23] = d->pose_error;
    o[24] = d->pixel_size;
    o[25] = d->view_angle_deg;
  }
  if (n > 0) (*env)->SetDoubleArrayRegion(env, out, 0, n * STRIDE, buf);
  return n;
}
