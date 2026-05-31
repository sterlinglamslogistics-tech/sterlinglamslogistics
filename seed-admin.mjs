import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { initializeApp } from "firebase/app"
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"
import { getFirestore, doc, setDoc } from "firebase/firestore"
import { initializeApp as initAdminApp, cert, applicationDefault } from "firebase-admin/app"
import { getAuth as getAdminAuth } from "firebase-admin/auth"

function loadEnvLocal() {
  const cwd = path.dirname(fileURLToPath(import.meta.url))
  const envPath = path.join(cwd, ".env.local")
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex < 0) continue

    const key = trimmed.slice(0, eqIndex).trim()
    if (!key || process.env[key] !== undefined) continue

    const rawValue = trimmed.slice(eqIndex + 1).trim()
    const value = rawValue.replace(/^['\"]|['\"]$/g, "")
    process.env[key] = value
  }
}

loadEnvLocal()

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const requiredKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "SEED_ADMIN_EMAIL",
  "SEED_ADMIN_PASSWORD",
]
// `!value` catches both undefined and empty string
const missingKeys = requiredKeys.filter((key) => !process.env[key])
if (missingKeys.length > 0) {
  console.error("Missing or empty environment variables:")
  for (const key of missingKeys) console.error(`- ${key}`)
  process.exit(1)
}

const ADMIN_EMAIL = /** @type {string} */ (process.env.SEED_ADMIN_EMAIL)
const ADMIN_PASSWORD = /** @type {string} */ (process.env.SEED_ADMIN_PASSWORD)

const app = initializeApp(firebaseConfig)
const authInstance = getAuth(app)
const db = getFirestore(app)

function initAdminSdk() {
  // Prefer FIREBASE_SERVICE_ACCOUNT_KEY (JSON string); fall back to ADC.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (raw) {
    try {
      return initAdminApp({ credential: cert(JSON.parse(raw)) }, "seed-admin")
    } catch (err) {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON:", err.message)
      process.exit(1)
    }
  }
  try {
    return initAdminApp({ credential: applicationDefault() }, "seed-admin")
  } catch {
    return null
  }
}

async function seedAdmin() {
  console.log(`\nCreating admin account: ${ADMIN_EMAIL}`)

  let uid

  try {
    const userCredential = await createUserWithEmailAndPassword(
      authInstance,
      ADMIN_EMAIL,
      ADMIN_PASSWORD
    )
    uid = userCredential.user.uid
    console.log("Admin user created in Firebase Auth.")
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      console.log("Admin user already exists in Firebase Auth, signing in...")
      const cred = await signInWithEmailAndPassword(authInstance, ADMIN_EMAIL, ADMIN_PASSWORD)
      uid = cred.user.uid
    } else {
      console.error("Error creating admin user:", err.message)
      process.exit(1)
    }
  }

  // Store admin record in Firestore admins collection
  await setDoc(doc(db, "admins", uid), {
    email: ADMIN_EMAIL,
    role: "admin",
    createdAt: new Date(),
  })
  console.log("Admin record saved to Firestore 'admins' collection.")

  // Set the admin custom claim — without it, every server route that calls
  // verifyAdmin() will reject the user even after a successful Firebase login.
  const adminApp = initAdminSdk()
  if (!adminApp) {
    console.warn(
      "\n⚠️  Could not initialize firebase-admin (FIREBASE_SERVICE_ACCOUNT_KEY missing and no Application Default Credentials).\n" +
        "    The admin custom claim was NOT set. Server-side admin routes will reject this user.\n" +
        "    Set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local and re-run, or run set-admin-claim.mjs separately."
    )
  } else {
    const adminAuth = getAdminAuth(adminApp)
    const existing = await adminAuth.getUser(uid)
    await adminAuth.setCustomUserClaims(uid, { ...existing.customClaims, admin: true })
    console.log("Admin custom claim set on user — server-side routes will now authorize this user.")
  }

  console.log("\n=== Admin Credentials ===")
  console.log(`Email:    ${ADMIN_EMAIL}`)
  console.log(`Password: ${ADMIN_PASSWORD}`)
  console.log("=========================\n")
  console.log("You can now sign in at /login with these credentials.")
  console.log("IMPORTANT: Change the password after first login for security.\n")

  process.exit(0)
}

seedAdmin().catch((err) => {
  console.error("seed-admin failed:", err)
  process.exit(1)
})
