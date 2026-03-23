import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
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

export default nextConfig
