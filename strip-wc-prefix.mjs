import { initializeApp, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const SERVICE_ACCOUNT = "c:\\Users\\user\\Downloads\\sterling-delivery-firebase-adminsdk-fbsvc-7bfe69467c.json"

const app = initializeApp({ credential: cert(SERVICE_ACCOUNT) })
const db = getFirestore(app)

async function stripWcPrefix() {
  const snap = await db.collection("orders").get()
  let updated = 0
  let skipped = 0

  for (const d of snap.docs) {
    const orderNumber = d.data().orderNumber
    if (typeof orderNumber === "string" && orderNumber.startsWith("WC-")) {
      const newNumber = orderNumber.replace(/^WC-/, "")
      await db.collection("orders").doc(d.id).update({ orderNumber: newNumber })
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
