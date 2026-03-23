import type { CapacitorConfig } from "@capacitor/cli"

const rawBaseUrl = process.env.DRIVER_APP_URL || "http://192.168.1.222:3000"
const baseUrl = `${rawBaseUrl.replace(/\/$/, "")}/driver?driverApp=1`

const allowHost = (() => {
  try {
    return [new URL(baseUrl).host]
  } catch {
    return []
  }
})()

const config: CapacitorConfig = {
  appId: "com.sterlinglams.driver",
  appName: "Sterlin Driver",
  webDir: "www",
  server: {
    url: baseUrl,
    cleartext: baseUrl.startsWith("http://"),
    allowNavigation: allowHost
  }
}

export default config
