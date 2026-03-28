import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore"

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
    const value = rawValue.replace(/^['"]|['"]$/g, "")
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

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function stripWcPrefix() {
  const snap = await getDocs(collection(db, "orders"))
  let updated = 0
  let skipped = 0

  for (const d of snap.docs) {
    const orderNumber = d.data().orderNumber
    if (typeof orderNumber === "string" && orderNumber.startsWith("WC-")) {
      const newNumber = orderNumber.replace(/^WC-/, "")
      await updateDoc(doc(db, "orders", d.id), { orderNumber: newNumber })
      console.log(`  ✓ ${orderNumber} → ${newNumber}`)
      updated++
    } else {
      skipped++
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (no WC- prefix): ${skipped}`)
  process.exit(0)
}

stripWcPrefix().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
