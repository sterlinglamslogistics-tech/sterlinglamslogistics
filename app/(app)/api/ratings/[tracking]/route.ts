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

  try {
    const order = await fetchOrderByTracking(tracking)
    if (!order) {
      return NextResponse.redirect(getRedirectUrl(request, tracking, rating, false))
    }

    // Only accept ratings for delivered orders
    if (order.status !== "delivered") {
      return NextResponse.redirect(getRedirectUrl(request, tracking, 0, false))
    }

    // Allow re-rating (customer can change their mind)
    await updateOrder(order.id, {
      customerRating: rating,
      customerRatedAt: new Date(),
    })

    // Recalculate driver's aggregate rating in background
    if (order.assignedDriver) {
      recalculateDriverRating(order.assignedDriver).catch(() => {})
    }

    return NextResponse.redirect(getRedirectUrl(request, tracking, rating, true))
  } catch (error) {
    log.error({ error, tracking }, "Failed to save rating")
    return NextResponse.redirect(getRedirectUrl(request, tracking, rating, false))
  }
}