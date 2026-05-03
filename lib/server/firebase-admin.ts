import { initializeApp, getApps, cert, type App } from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

let app: App
let auth: Auth
let firestore: Firestore

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
firestore = getFirestore(app)

export { auth as adminAuth }
export { firestore as adminDb }
