import { NextResponse } from "next/server"
import { cleanOrderNumbersWC, removeDuplicateOrders, backfillOrderCoords } from "@/lib/firestore"

export async function POST() {
  try {
    const prefixesCleaned = await cleanOrderNumbersWC()
    const duplicatesRemoved = await removeDuplicateOrders()
    const coordsBackfilled = await backfillOrderCoords()
    return NextResponse.json({ ok: true, prefixesCleaned, duplicatesRemoved, coordsBackfilled })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
