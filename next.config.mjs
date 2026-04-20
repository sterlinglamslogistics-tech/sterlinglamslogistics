import path from "node:path"
import { fileURLToPath } from "node:url"
import { withSentryConfig } from "@sentry/nextjs"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: {
    root: rootDir,
    resolveAlias: {
      tailwindcss: path.resolve(rootDir, "node_modules/tailwindcss"),
      "tw-animate-css": path.resolve(rootDir, "node_modules/tw-animate-css"),
    },
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["192.168.1.222"],
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,
})
