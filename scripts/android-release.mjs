// Builds the Android app for release with Gradle, then says where the file is.
// Run through `npm run android:bundle` (for Google Play) or `npm run android:apk`.
// Usage: node scripts/android-release.mjs bundleRelease | assembleRelease
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
const task = process.argv[2] === 'assembleRelease' ? 'assembleRelease' : 'bundleRelease';
const windows = process.platform === 'win32';

const signed = existsSync(join(android, 'keystore.properties'));
if (!signed) {
  console.warn(
    '\nNo android/keystore.properties found, so this build will NOT be signed.\n' +
      'Google Play only accepts signed builds. See "Make your upload key" in docs/PUBLISHING.md.\n',
  );
}

const result = spawnSync(windows ? 'gradlew.bat' : './gradlew', [task], { cwd: android, stdio: 'inherit', shell: windows });
if (result.status !== 0) {
  console.error(
    '\nThe Android build did not finish. If it says Java or JAVA_HOME is missing, see\n' +
      '"If the build fails" in docs/PUBLISHING.md.',
  );
  process.exit(result.status ?? 1);
}

const out =
  task === 'bundleRelease'
    ? join('android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
    : join('android', 'app', 'build', 'outputs', 'apk', 'release', signed ? 'app-release.apk' : 'app-release-unsigned.apk');
console.log(`\nDone${signed ? '' : ' (not signed)'}: ${out}`);
