import { NextResponse } from "next/server"
import { fetchOrderByTracking, updateOrder, recalculateDriverRating } from "@/lib/firestore"
import { ratingParamsSchema } from "@/lib/validations"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { createLogger } from "@/lib/logger"

const log = createLogger("api:ratings")

function getRedirectUrl(request: Request, tracking: string, rating: number, submitted: boolean) {
  const url = new URL(request.url)
  const dest = new URL(`/track/${encodeURIComponent(tracking)}`, url.origin)
  if (rating >= 1 && rating <= 5) dest.searchParams.set("rating", String(rating))
  if (submitted) dest.searchParams.set("submitted", "1")
  return dest
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tracking: string }> }
) {
  // Rate limiting
  const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(request))
  if (rateLimitResponse) return rateLimitResponse

  const { tracking } = await params
  const ratingValue = new URL(request.url).searchParams.get("rating")

  // Validate with Zod
  const parsed = ratingParamsSchema.safeParse({ rating: ratingValue })
  if (!parsed.success) {
    return NextResponse.redirect(getRedirectUrl(request, tracking, 0, false))
  }
  const rating = parsed.data.rating

  // GET should remain side-effect free. We redirect to the tracking page,
  // where rating can be submitted via POST.
  return NextResponse.redirect(getRedirectUrl(request, tracking, rating, false))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tracking: string }> }
) {
  const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(request))
  if (rateLimitResponse) return rateLimitResponse

  const { tracking } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as {
    rating?: unknown
    customerRating?: unknown
    driverRating?: unknown
    customerFeedback?: unknown
  }
  const customerRatingRaw = payload.customerRating ?? payload.rating
  const parsed = ratingParamsSchema.safeParse({ rating: String(customerRatingRaw ?? "") })
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid rating" }, { status: 400 })
  }

  const customerRating = parsed.data.rating
  const driverRating =
    typeof payload.driverRating === "number" &&
    Number.isInteger(payload.driverRating) &&
    payload.driverRating >= 1 &&
    payload.driverRating <= 5
      ? payload.driverRating
      : undefined
  const customerFeedback =
    typeof payload.customerFeedback === "string" && payload.customerFeedback.trim()
      ? payload.customerFeedback.trim().slice(0, 500)
      : undefined

  try {
    const order = await fetchOrderByTracking(tracking)
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
    }
    if (order.status !== "delivered") {
      return NextResponse.json({ ok: false, error: "Order is not delivered yet" }, { status: 409 })
    }

    await updateOrder(order.id, {
      customerRating,
      ...(typeof driverRating === "number" ? { driverRating } : {}),
      ...(customerFeedback ? { customerFeedback } : {}),
      customerRatedAt: new Date(),
    })

    if (order.assignedDriver) {
      recalculateDriverRating(order.assignedDriver).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error, tracking }, "Failed to save rating")
    return NextResponse.json({ ok: false, error: "Failed to save rating" }, { status: 500 })
  }
}