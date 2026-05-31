import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { initializeApp, cert, applicationDefault } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

// Load .env.local for FIREBASE_SERVICE_ACCOUNT_KEY (and optional ADMIN_EMAIL filter)
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

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (raw) {
    try {
      return initializeApp({ credential: cert(JSON.parse(raw)) })
    } catch (err) {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON:", err.message)
      process.exit(1)
    }
  }

  // Fallback: Application Default Credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS env or gcloud login)
  try {
    return initializeApp({ credential: applicationDefault() })
  } catch (err) {
    console.error(
      "Could not initialize firebase-admin. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local " +
        "(paste your service-account JSON as a single line), or set GOOGLE_APPLICATION_CREDENTIALS " +
        "to point at the JSON file. Original error: " + err.message
    )
    process.exit(1)
  }
}

const app = initAdmin()
const auth = getAuth(app)

async function setAdminClaim() {
  // Optional: pass --email=foo@bar.com (or set ADMIN_EMAIL) to grant the claim
  // to a single user instead of every user in the project.
  const arg = process.argv.find((a) => a.startsWith("--email="))
  const targetEmail = (arg ? arg.slice("--email=".length) : process.env.ADMIN_EMAIL)?.toLowerCase().trim()

  const listResult = await auth.listUsers(1000)
  if (listResult.users.length === 0) {
    console.log("No users found in Firebase Auth")
    process.exit(1)
  }

  const targets = targetEmail
    ? listResult.users.filter((u) => (u.email ?? "").toLowerCase() === targetEmail)
    : listResult.users

  if (targets.length === 0) {
    console.log(`No user matched email '${targetEmail}'.`)
    process.exit(1)
  }

  console.log(`Granting admin claim to ${targets.length} user(s)${targetEmail ? ` matching ${targetEmail}` : " (all users)"}:`)
  for (const user of targets) {
    console.log(`  ${user.email ?? user.uid} — current claims: ${JSON.stringify(user.customClaims)}`)
  }

  for (const user of targets) {
    await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true })
    console.log(`✓ Set admin: true on ${user.email ?? user.uid}`)
  }
}

setAdminClaim().then(() => process.exit(0)).catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
