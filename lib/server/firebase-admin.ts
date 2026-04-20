import { initializeApp, getApps, cert, type App } from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"

let app: App
let auth: Auth

if (getApps().length === 0) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  // Prefer service account JSON, fall back to Application Default Credentials
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined

  app = initializeApp(
    serviceAccount ? { credential: cert(serviceAccount), projectId } : { projectId }
  )
} else {
  app = getApps()[0]
}

auth = getAuth(app)

export { auth as adminAuth }
