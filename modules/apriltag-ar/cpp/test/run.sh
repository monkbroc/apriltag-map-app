#!/usr/bin/env sh
# Builds and runs the host-side detector test (needs gcc or clang). Used by CI.
set -eu
cd "$(dirname "$0")"
OUT="${TMPDIR:-/tmp}/atag_test$( [ "${OS:-}" = "Windows_NT" ] && echo .exe )"
"${CC:-gcc}" -O2 -w -I.. -I../apriltag -o "$OUT" atag_bridge_test.c ../atag_bridge.c \
  ../apriltag/*.c ../apriltag/common/*.c -lm -lpthread
"$OUT"
