import { initializeApp, getApps, cert, type App } from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { getStorage, type Storage } from "firebase-admin/storage"
import { createLogger } from "@/lib/logger"

const log = createLogger("firebase-admin")

let app: App
let auth: Auth
let firestore: Firestore
let storage: Storage

try {
  if (getApps().length === 0) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

    let serviceAccount: Parameters<typeof cert>[0] | undefined

    if (raw) {
      // 1. Strip leading garbage before the first { (e.g. \{ → {)
      const start = raw.indexOf("{")
      let cleaned = start >= 0 ? raw.slice(start) : raw

      // 2. Remove carriage returns from Windows line-endings
      cleaned = cleaned.replace(/\r/g, "")

      // 3. Remove stray backslashes not part of a valid JSON escape sequence
      //    (valid: \" \\ \/ \b \f \n \r \t \uXXXX) — fixes "Bad escaped character"
      cleaned = cleaned.replace(/\\(?!["\\/bfnrtu])/g, "")

      try {
        const parsed = JSON.parse(cleaned) as Record<string, unknown>

        // 4. Vercel stores private_key \n as literal \\n — convert to real newlines
        if (typeof parsed.private_key === "string") {
          parsed.private_key = (parsed.private_key as string).replace(/\\n/g, "\n")
        }

        serviceAccount = parsed as Parameters<typeof cert>[0]
      } catch (err) {
        log.error(
          { err, raw_start: raw.slice(0, 20) },
          "FIREBASE_SERVICE_ACCOUNT_KEY could not be parsed — falling back to ADC"
        )
      }
    } else {
      if (process.env.NODE_ENV === "production") {
        log.error("FIREBASE_SERVICE_ACCOUNT_KEY is not set — admin SDK routes will fail")
      }
    }

    // Wrap cert() separately so a bad private key doesn't crash the entire module
    let credential: ReturnType<typeof cert> | undefined
    if (serviceAccount) {
      try {
        credential = cert(serviceAccount)
      } catch (err) {
        log.error({ err }, "cert() failed — admin SDK will use Application Default Credentials")
      }
    }

    app = initializeApp(credential ? { credential, projectId } : { projectId })
  } else {
    app = getApps()[0]
  }

  auth = getAuth(app)
  firestore = getFirestore(app)
  storage = getStorage(app)
} catch (err) {
  // Last-resort: if anything above threw, initialise without credentials so
  // the module still exports valid (but unauthenticated) instances rather than
  // crashing the entire serverless function and returning 500/503 to users.
  log.error({ err }, "Firebase Admin SDK failed to initialise — all admin operations will fail")
  if (getApps().length === 0) {
    app = initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID })
  } else {
    app = getApps()[0]
  }
  auth = getAuth(app)
  firestore = getFirestore(app)
  storage = getStorage(app)
}

export { auth as adminAuth }
export { firestore as adminDb }
export { storage as adminStorage }
