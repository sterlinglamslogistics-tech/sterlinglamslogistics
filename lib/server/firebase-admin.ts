import { initializeApp, getApps, cert, type App } from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { createLogger } from "@/lib/logger"

const log = createLogger("firebase-admin")

let app: App
let auth: Auth
let firestore: Firestore

if (getApps().length === 0) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  let serviceAccount: Parameters<typeof cert>[0] | undefined

  if (raw) {
    // Strip any leading garbage characters that get prepended during copy-paste
    // (e.g. a leading backslash turns valid JSON into \{...} which fails to parse).
    // We find the first { and treat everything from there as the JSON string.
    const cleaned = raw.slice(raw.indexOf("{"))

    try {
      const parsed = JSON.parse(cleaned) as Record<string, unknown>

      // Vercel stores newlines in env vars as the literal two-character sequence \n
      // instead of a real newline. Firebase's RSA private key requires real newlines.
      if (typeof parsed.private_key === "string") {
        parsed.private_key = (parsed.private_key as string).replace(/\\n/g, "\n")
      }

      serviceAccount = parsed as Parameters<typeof cert>[0]
    } catch (err) {
      log.error(
        { err, raw_start: raw.slice(0, 30) },
        "FIREBASE_SERVICE_ACCOUNT_KEY could not be parsed — admin SDK will use Application Default Credentials"
      )
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      log.error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is not set — admin SDK routes (driver login, create driver, etc.) will fail. " +
          "Add it in Vercel → Settings → Environment Variables."
      )
    } else {
      log.warn("FIREBASE_SERVICE_ACCOUNT_KEY not set — using Application Default Credentials (dev only)")
    }
  }

  app = initializeApp(
    serviceAccount
      ? { credential: cert(serviceAccount), projectId }
      : { projectId }
  )
} else {
  app = getApps()[0]
}

auth = getAuth(app)
firestore = getFirestore(app)

export { auth as adminAuth }
export { firestore as adminDb }
