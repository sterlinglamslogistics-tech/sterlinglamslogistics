import * as Sentry from "@sentry/nextjs"

// Accept either name so operators can configure SENTRY_DSN (per docs) or
// NEXT_PUBLIC_SENTRY_DSN (per Sentry Next.js convention) without surprise.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
})
