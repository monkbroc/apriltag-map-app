# Device test checklist

The shared C detector bridge is tested automatically (`npm run test:native`, also in CI). The
Swift and Kotlin code has no automated tests (REQUIREMENTS R-7.4). Run this checklist on a real
iPhone and a real Android phone after changing anything under `modules/apriltag-ar/`.

Print a few tag36h11 tags at a known size (for example IDs 1, 2 and 3 at 165.1 mm black-border
edge). Generators: <https://github.com/AprilRobotics/apriltag-imgs> (`tag36h11/`), scaled up so
the black border measures exactly 165.1 mm.

Host-side check of the C bridge (no phone needed):

```bash
cd modules/apriltag-ar/cpp/test
gcc -O2 -w -I.. -I../apriltag -o atag_test atag_bridge_test.c ../atag_bridge.c ../apriltag/*.c ../apriltag/common/*.c -lm -lpthread
./atag_test
```

## 1. Startup

- [ ] The app opens a scan without crashing; the camera feed fills the screen.
- [ ] Denying camera permission shows the "enable it in settings" message.
- [ ] (Android) On a phone without Google Play Services for AR, the install prompt appears.
- [ ] Tracking shows "limited (initializing)" briefly, then "normal" after moving the phone.

## 2. Detection

- [ ] Each printed tag gets an outline drawn over it in the right place, with the correct ID.
- [ ] Outlines follow the tags in portrait and landscape.
- [ ] Observation counts on the chips go up only while tracking is "normal".

## 3. Frame conventions

- [ ] Hold the phone in portrait, 1.0 m straight in front of a tag on a wall, and finish a fresh
      scan with that tag as the only reference at the default pose. Then:
  - a second tag 1.0 m to the **right** of the first (on the same wall) appears at
    y ≈ −1.0 m in the table. (The reference tag faces +X, so from the viewer's side,
    right is −Y.) **TODO on first run:** confirm the sign and update this line.
  - a tag 0.5 m **above** the first appears at z ≈ +0.5 m.
- [ ] The map arrows of both tags point the same way (out of the wall).

## 4. Distances

- [ ] Put two tags 3.00 m apart (tape measure). Scan both from several angles. In the table,
      the distance between them is within 3 cm.
- [ ] Rotate one tag by 90° on the wall (or use a tag on a perpendicular wall): its yaw in the
      table differs by about 90° from the other.

## 5. Refine round trip

- [ ] Refine the set from step 4 without moving anything: every row is green and the RMS is
      under 3 cm.
- [ ] Move one tag 10 cm and refine again: that row is red with ≈ 10 cm position delta, the
      others stay green. Excluding the moved tag from the fit lowers the RMS.

## 6. Export

- [ ] Export the set, upload it to a Limelight, and check that MegaTag reports a sensible robot
      pose.
