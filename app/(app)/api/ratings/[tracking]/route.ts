import { NextResponse } from "next/server"
import { fetchOrderByTracking, updateOrder, recalculateDriverRating } from "@/lib/firestore"

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
  const { tracking } = await params
  const ratingValue = new URL(request.url).searchParams.get("rating")
  const rating = Number(ratingValue)

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.redirect(getRedirectUrl(request, tracking, 0, false))
  }

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
    console.error("Failed to save rating:", error)
    return NextResponse.redirect(getRedirectUrl(request, tracking, rating, false))
  }
}