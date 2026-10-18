const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

/**
 * Turns on R8's optimization passes, not just shrinking and obfuscation.
 *
 * Play Console (v44) flagged "Optimization isn't enabled" and "Optimized
 * resource shrinking isn't enabled" even with minify on: the React Native
 * template uses proguard-android.txt, which contains -dontoptimize. The
 * -optimize variant is the one Google recommends (and the only one AGP 9 keeps).
 * Libraries ship their own consumer keep rules, so this is safe in principle,
 * but it changes more code than plain minify — smoke-test every release build.
 */
module.exports = function withR8Optimization(config) {
  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = mod.modResults.contents.replace(
      'getDefaultProguardFile("proguard-android.txt")',
      'getDefaultProguardFile("proguard-android-optimize.txt")'
    );
    return mod;
  });

  return withGradleProperties(config, (mod) => {
    const key = 'android.r8.optimizedResourceShrinking';
    mod.modResults = mod.modResults.filter((item) => !(item.type === 'property' && item.key === key));
    mod.modResults.push({ type: 'property', key, value: 'true' });
    return mod;
  });
};
