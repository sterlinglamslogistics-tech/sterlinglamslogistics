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
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>

      // Vercel (and many CI systems) store newlines in env vars as the literal
      // two-character sequence \n instead of a real newline. Firebase's RSA private
      // key requires real newlines or cert() will fail with a cryptic PEM error.
      if (typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n")
      }

      serviceAccount = parsed as Parameters<typeof cert>[0]
    } catch (err) {
      log.error(
        { err },
        "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON — admin SDK will use Application Default Credentials"
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
