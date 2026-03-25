import { NextResponse } from "next/server"
import { fetchOrderByTracking, updateOrder } from "@/lib/firestore"

function getRedirectUrl(request: Request, tracking: string, rating: number) {
  const url = new URL(request.url)
  return new URL(`/track/${encodeURIComponent(tracking)}?rating=${rating}&submitted=1`, url.origin)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tracking: string }> }
) {
  const { tracking } = await params
  const ratingValue = new URL(request.url).searchParams.get("rating")
  const rating = Number(ratingValue)

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.redirect(getRedirectUrl(request, tracking, 0))
  }

  try {
    const order = await fetchOrderByTracking(tracking)
    if (order) {
      await updateOrder(order.id, {
        customerRating: rating,
        customerRatedAt: new Date(),
      })
    }
  } catch (error) {
    console.error("Failed to save rating:", error)
  }

  return NextResponse.redirect(getRedirectUrl(request, tracking, rating))
}