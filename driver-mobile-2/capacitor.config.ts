import type { CapacitorConfig } from "@capacitor/cli"

/**
 * driver-mobile-2 — full offline-first variant.
 *
 * Differences from driver-mobile:
 *   - No `server.url`. The WebView loads www/ from local APK assets at
 *     cold start, so no network is required for the shell to render.
 *   - Different appId so this APK installs side-by-side with the
 *     original driver-mobile during A/B testing on the same device.
 *
 * The bundled app calls https://sterlinglamslogistics.com/api/* for
 * data — only the UI is local. allowNavigation keeps the WebView
 * permitted to talk to the real API origin.
 */
const config: CapacitorConfig = {
  appId: "com.sterlinglams.driver2",
  appName: "Sterlin Driver 2",
  webDir: "www",
  server: {
    androidScheme: "https",
    allowNavigation: ["sterlinglamslogistics.com", "*.sterlinglamslogistics.com"]
  },
  android: {
    allowMixedContent: false,
    appendUserAgent: "SterlinDriverApp2"
  },
  plugins: {
    Geolocation: {},
    Camera: {}
  }
}

export default config
