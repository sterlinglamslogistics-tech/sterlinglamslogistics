import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Static export config for the driver-mobile-2 APK build.
 *
 * output: "export" tells Next.js to produce a folder of pure HTML/CSS/JS
 * (no Node server needed). That output goes into out/, which the parent
 * build script then copies into ../www/ for Capacitor to bundle.
 *
 * turbopack.root pins the build's workspace root to THIS folder, so a
 * stray lockfile in the user's home directory (or elsewhere up the
 * filesystem) doesn't get auto-picked as the workspace root and break
 * module resolution.
 *
 * No basePath: the WebView loads from the root of the APK assets, so
 * the bundled URLs match. trailingSlash: true generates `dashboard/
 * index.html` instead of `dashboard.html` — file:// resolves the
 * former more reliably.
 *
 * images.unoptimized is required when exporting (no image optimizer
 * server to call out to). The driver UI uses next/image only for the
 * login logo, so this is a trivial loss.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
