import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore"

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
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
]

const missingKeys = requiredKeys.filter((key) => !process.env[key])
if (missingKeys.length > 0) {
  console.error("Missing Firebase environment variables:")
  for (const key of missingKeys) console.error(`- ${key}`)
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// Sample orders data
const orders = [
  {
    orderNumber: "SG-2026-001",
    customerName: "Mrs. Olumide Johnson",
    phone: "+234 812 111 2222",
    address: "12 Admiralty Way, Lekki Phase 1, Lagos",
    amount: 45000,
    status: "delivered",
    assignedDriver: null,
  },
  {
    orderNumber: "SG-2026-002",
    customerName: "Mr. Kenneth Eze",
    phone: "+234 813 222 3333",
    address: "5 Adeola Odeku St, Victoria Island, Lagos",
    amount: 32500,
    status: "in-transit",
    assignedDriver: null,
  },
  {
    orderNumber: "SG-2026-003",
    customerName: "Miss Ngozi Okafor",
    phone: "+234 814 333 4444",
    address: "24 Allen Avenue, Ikeja, Lagos",
    amount: 67800,
    status: "pending",
    assignedDriver: null,
  },
  {
    orderNumber: "SG-2026-004",
    customerName: "Dr. Yusuf Bello",
    phone: "+234 815 444 5555",
    address: "8 Sanusi Fafunwa St, Victoria Island, Lagos",
    amount: 125000,
    status: "assigned",
    assignedDriver: null,
  },
  {
    orderNumber: "SG-2026-005",
    customerName: "Chief Amaka Uche",
    phone: "+234 816 555 6666",
    address: "17 Awolowo Road, Ikoyi, Lagos",
    amount: 89500,
    status: "pending",
    assignedDriver: null,
  },
  {
    orderNumber: "SG-2026-006",
    customerName: "Engr. Tunde Balogun",
    phone: "+234 817 666 7777",
    address: "3 Ozumba Mbadiwe Ave, Victoria Island, Lagos",
    amount: 55000,
    status: "in-transit",
    assignedDriver: null,
  },
  {
    orderNumber: "SG-2026-007",
    customerName: "Mrs. Halima Suleiman",
    phone: "+234 818 777 8888",
    address: "10 Bourdillon Rd, Ikoyi, Lagos",
    amount: 73200,
    status: "delivered",
    assignedDriver: null,
  },
  {
    orderNumber: "SG-2026-008",
    customerName: "Mr. David Obi",
    phone: "+234 819 888 9999",
    address: "22 Akin Adesola St, Victoria Island, Lagos",
    amount: 41000,
    status: "cancelled",
    assignedDriver: null,
  },
  {
    orderNumber: "SG-2026-009",
    customerName: "Ms. Blessing Adekunle",
    phone: "+234 820 999 0000",
    address: "6 Gerrard Rd, Ikoyi, Lagos",
    amount: 98500,
    status: "pending",
    assignedDriver: null,
  },
  {
    orderNumber: "SG-2026-010",
    customerName: "Barr. Samuel Okoye",
    phone: "+234 821 000 1111",
    address: "14 Oba Akran Ave, Ikeja, Lagos",
    amount: 62000,
    status: "assigned",
    assignedDriver: null,
  },
]

async function seedDatabase() {
  try {
    console.log("🚀 Starting database seeding...")

    // Add orders
    console.log("\n📦 Adding orders...")
    const ordersRef = collection(db, "orders")
    for (const order of orders) {
      const docRef = await addDoc(ordersRef, {
        ...order,
        createdAt: serverTimestamp(),
      })
      console.log(`✓ Added order: ${order.orderNumber} (ID: ${docRef.id})`)
    }

    console.log("\n✅ Database seeding completed successfully!")
    console.log(`\n📊 Summary:`)
    console.log(`   - Orders added: ${orders.length}`)
    console.log(
      `\n🎉 Your app is ready! Refresh http://localhost:3000 to see the data.`
    )

    process.exit(0)
  } catch (error) {
    console.error("❌ Error seeding database:", error)
    process.exit(1)
  }
}

seedDatabase()
