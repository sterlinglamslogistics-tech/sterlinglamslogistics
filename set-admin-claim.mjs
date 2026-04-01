import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { initializeApp, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

const SERVICE_ACCOUNT = "c:\\Users\\user\\Downloads\\sterling-delivery-firebase-adminsdk-fbsvc-7bfe69467c.json"

// Load .env.local to get admin email
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

const app = initializeApp({ credential: cert(SERVICE_ACCOUNT) })
const auth = getAuth(app)

async function setAdminClaim() {
  // List all users and set admin on all of them (small project)
  const listResult = await auth.listUsers(100)
  if (listResult.users.length === 0) {
    console.log("No users found in Firebase Auth")
    process.exit(1)
  }

  console.log(`Found ${listResult.users.length} user(s):`)
  for (const user of listResult.users) {
    console.log(`  ${user.email ?? user.uid} — claims: ${JSON.stringify(user.customClaims)}`)
  }

  // Set admin on all users (for a small admin-only project this is fine)
  for (const user of listResult.users) {
    await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true })
    console.log(`✓ Set admin: true on ${user.email ?? user.uid}`)
  }
}

setAdminClaim().then(() => process.exit(0)).catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
