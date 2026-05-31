import type { CapacitorConfig } from "@capacitor/cli"

const baseUrl = (process.env.DRIVER_APP_URL || "https://sterlinglamslogistics.com/driver").replace(/\/$/, "")

const config: CapacitorConfig = {
  appId: "com.sterlinglams.driver",
  appName: "Sterlin Driver",
  webDir: "www",
  server: {
    url: baseUrl,
    cleartext: baseUrl.startsWith("http://"),
    allowNavigation: ["sterlinglamslogistics.com", "*.sterlinglamslogistics.com"],
    // When the WebView can't reach `url` (no signal at cold launch, server
    // down, etc.) Android shows its ugly net::ERR_FAILED page. errorPath
    // tells Capacitor to fall back to a local file shipped in webDir/www
    // instead — branded screen, auto-reconnect on network restore.
    errorPath: "offline.html"
  },
  android: {
    allowMixedContent: false,
    appendUserAgent: "SterlinDriverApp"
  },
  plugins: {
    Geolocation: {
      // Uses fine location for accurate driver tracking
    },
    Camera: {
      // Used for proof-of-delivery photos
    }
  }
}

export default config
