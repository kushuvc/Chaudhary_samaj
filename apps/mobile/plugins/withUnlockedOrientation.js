const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Lifts the portrait lock that libraries put on their own activities.
 *
 * Play's large-screen check flags any activity that fixes its orientation, and
 * Android 16 ignores such locks on tablets anyway. expo-camera brings in Google's
 * ML Kit code scanner, whose GmsBarcodeScanningDelegateActivity is declared
 * portrait-only; the app never opens it (scanning uses the in-app camera view),
 * but its manifest entry is enough to be flagged. This overrides it at merge
 * time. Phones stay portrait through the runtime lock in App.tsx.
 */
const UNLOCKED_ACTIVITIES = [
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity',
];

module.exports = function withUnlockedOrientation(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

    const application = manifest.application[0];
    application.activity = application.activity || [];

    for (const name of UNLOCKED_ACTIVITIES) {
      const existing = application.activity.find((activity) => activity.$['android:name'] === name);
      const entry = existing || { $: { 'android:name': name } };
      entry.$['android:screenOrientation'] = 'unspecified';
      entry.$['tools:replace'] = 'android:screenOrientation';
      if (!existing) application.activity.push(entry);
    }
    return mod;
  });
};
