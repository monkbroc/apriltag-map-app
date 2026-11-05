#!/usr/bin/env node
// Fails fast when the Android build environment is not set up (see README).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const errors = [];
const { ANDROID_HOME, JAVA_HOME } = process.env;

if (!ANDROID_HOME || !existsSync(path.join(ANDROID_HOME, 'platform-tools'))) {
  errors.push(
    'ANDROID_HOME must point to the Android SDK (on Windows usually %LOCALAPPDATA%\\Android\\Sdk).',
  );
}
const release = JAVA_HOME && path.join(JAVA_HOME, 'release');
const major =
  release && existsSync(release) && /JAVA_VERSION="(\d+)/.exec(readFileSync(release, 'utf8'))?.[1];
if (!['17', '21'].includes(major)) {
  errors.push(
    `JAVA_HOME must point to JDK 17 or 21 (found: ${JAVA_HOME ? `JDK ${major || '?'} at ${JAVA_HOME}` : 'not set'}).`,
  );
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
