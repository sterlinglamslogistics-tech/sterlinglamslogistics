import { NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/server/auth"
import { saveOptimizedRouteOrder } from "@/lib/firestore"
import { createLogger } from "@/lib/logger"

const log = createLogger("api:admin:dispatch:reorder")

export async function POST(req: Request) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await req.json()) as { orderedIds?: string[] }
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : []
    if (orderedIds.length === 0) {
      return NextResponse.json({ ok: false, error: "orderedIds is required" }, { status: 400 })
    }

    await saveOptimizedRouteOrder(orderedIds)
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error }, "Dispatch reorder failed")
    return NextResponse.json({ ok: false, error: "Failed to reorder route" }, { status: 500 })
  }
}
