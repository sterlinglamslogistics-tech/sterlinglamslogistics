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
    // 1. Strip any leading garbage before the first { (e.g. a leading backslash from
    //    copy-paste corruption turns \{ into { which is valid JSON).
    const start = raw.indexOf("{")
    let cleaned = start >= 0 ? raw.slice(start) : raw

    // 2. Remove carriage returns that Windows line-endings may have introduced.
    cleaned = cleaned.replace(/\r/g, "")

    // 3. Remove any stray backslashes that are not part of a valid JSON escape
    //    sequence (valid: \" \\ \/ \b \f \n \r \t \uXXXX).
    //    This fixes "Bad escaped character" errors caused by paste corruption.
    cleaned = cleaned.replace(/\\(?!["\\/bfnrtu])/g, "")

    try {
      const parsed = JSON.parse(cleaned) as Record<string, unknown>

      // 4. Vercel sometimes stores \n as the two-char literal sequence \\n instead
      //    of a real newline. The RSA private_key requires actual newline chars.
      if (typeof parsed.private_key === "string") {
        parsed.private_key = (parsed.private_key as string).replace(/\\n/g, "\n")
      }

      serviceAccount = parsed as Parameters<typeof cert>[0]
    } catch (err) {
      log.error(
        { err, raw_start: raw.slice(0, 20) },
        "FIREBASE_SERVICE_ACCOUNT_KEY could not be parsed after sanitisation — admin SDK will use ADC"
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
