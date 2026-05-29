/**
 * Static export config for the driver-mobile-2 APK build.
 *
 * output: "export" tells Next.js to produce a folder of pure HTML/CSS/JS
 * (no Node server needed). That output goes into out/, which the parent
 * build script then copies into ../www/ for Capacitor to bundle.
 *
 * Notes:
 * - No basePath: the WebView loads from local files at the root of the
 *   APK's assets/public/ directory, so the bundled URLs match.
 * - trailingSlash: true generates dashboard/index.html instead of
 *   dashboard.html, which the WebView resolves more reliably from a
 *   file:// origin.
 * - images.unoptimized: required when exporting (no image optimizer
 *   server to call out to). The driver UI uses next/image only for
 *   the login logo, so this is a trivial loss.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Skip lint/type errors during the APK build — the main project's CI
  // is the source of truth for code quality; here we just want a build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
