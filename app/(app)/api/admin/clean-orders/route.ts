import { NextResponse } from "next/server"
import { cleanOrderNumbersWC, removeDuplicateOrders, backfillOrderCoords } from "@/lib/firestore"
import { createLogger } from "@/lib/logger"
import { audit } from "@/lib/audit"
import { verifyAdmin } from "@/lib/server/auth"

const log = createLogger("api:admin:clean-orders")

export async function POST(req: Request) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const prefixesCleaned = await cleanOrderNumbersWC()
    const duplicatesRemoved = await removeDuplicateOrders()
    const coordsBackfilled = await backfillOrderCoords()

    const details = { prefixesCleaned, duplicatesRemoved, coordsBackfilled }
    log.info(details, "Clean orders completed")
    await audit({ action: "admin.clean_orders", actor: admin.uid, details })

    return NextResponse.json({ ok: true, prefixesCleaned, duplicatesRemoved, coordsBackfilled })
  } catch (error) {
    log.error({ error }, "Clean orders failed")
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
