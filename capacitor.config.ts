import type { CapacitorConfig } from '@capacitor/cli';

// The Android app wraps the same web build (dist/), so it plays fully offline.
const config: CapacitorConfig = {
  appId: 'io.github.jpashami.pixeltd',
  appName: 'Pixel Tower Defence',
  webDir: 'dist',
  backgroundColor: '#1a1c2c',
  android: {
    // Game files are served from inside the app; nothing is loaded over the network.
    allowMixedContent: false,
  },
};

export default config;
