#!/usr/bin/env node
// Builds a release APK locally (Windows, macOS or Linux).
//
// Requires the Android SDK (ANDROID_HOME) and JDK 17. Signing:
//   set ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and
//   ANDROID_KEY_PASSWORD to sign with your own key. Without them the build is
//   signed with the debug keystore, which is fine for sideloading during development.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const isWindows = process.platform === 'win32';

function run(cmd, args, cwd) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], root);

const gradleArgs = ['assembleRelease'];
const ks = process.env.ANDROID_KEYSTORE_PATH;
if (ks) {
  gradleArgs.push(
    `-Pandroid.injected.signing.store.file=${path.resolve(ks)}`,
    `-Pandroid.injected.signing.store.password=${process.env.ANDROID_KEYSTORE_PASSWORD ?? ''}`,
    `-Pandroid.injected.signing.key.alias=${process.env.ANDROID_KEY_ALIAS ?? ''}`,
    `-Pandroid.injected.signing.key.password=${process.env.ANDROID_KEY_PASSWORD ?? ''}`,
  );
}
run(isWindows ? 'gradlew.bat' : './gradlew', gradleArgs, path.join(root, 'android'));

const apk = path.join(
  root,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
);
if (!existsSync(apk)) {
  console.error(`Build finished but no APK found at ${apk}`);
  process.exit(1);
}
console.log(`\nAPK: ${apk}\nInstall with: adb install -r "${apk}"`);
