"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Star, MessageSquare, ChevronDown } from "lucide-react"
import { fetchOrders, fetchDrivers } from "@/lib/firestore"
import type { Order, Driver } from "@/lib/data"

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`size-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  )
}

function RatingDistribution({
  label,
  average,
  distribution,
}: {
  label: string
  average: number
  distribution: number[]
}) {
  const total = distribution.reduce((a, b) => a + b, 0)
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold">{average.toFixed(2)}</span>
          <StarRow rating={Math.round(average)} />
        </div>
        <div className="mt-4 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star, idx) => {
            const count = distribution[idx]
            const pct = total ? (count / total) * 100 : 0
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right font-medium">{star}</span>
                <Star className="size-3 fill-yellow-400 text-yellow-400" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-right text-muted-foreground">{count}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

type DateFilter = "all" | "today" | "week" | "month"
type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1"
type SortBy = "newest" | "oldest" | "highest" | "lowest"
type Tab = "all" | "escalation"

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none rounded-lg border border-border bg-card px-3 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export default function ReviewsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("all")
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [orderRatingFilter, setOrderRatingFilter] = useState<RatingFilter>("all")
  const [driverRatingFilter, setDriverRatingFilter] = useState<RatingFilter>("all")
  const [sortBy, setSortBy] = useState<SortBy>("newest")

  useEffect(() => {
    async function load() {
      try {
        const [o, d] = await Promise.all([fetchOrders(), fetchDrivers()])
        setOrders(o)
        setDrivers(d)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const driverMap = useMemo(() => {
    const m = new Map<string, Driver>()
    drivers.forEach((d) => m.set(d.id, d))
    return m
  }, [drivers])

  const reviewedOrders = useMemo(() => {
    return orders.filter(
      (o) => o.customerRating != null && o.customerRating > 0
    )
  }, [orders])

  // Distribution helpers
  function calcDistribution(
    list: Order[],
    field: "customerRating" | "driverRating"
  ) {
    const dist = [0, 0, 0, 0, 0] // index 0 = 5-star count, index 4 = 1-star count
    list.forEach((o) => {
      const r = o[field]
      if (r && r >= 1 && r <= 5) dist[5 - r]++
    })
    return dist
  }

  function calcAvg(list: Order[], field: "customerRating" | "driverRating") {
    const rated = list.filter((o) => o[field] && o[field]! > 0)
    if (!rated.length) return 0
    return rated.reduce((s, o) => s + (o[field] ?? 0), 0) / rated.length
  }

  const orderDist = calcDistribution(reviewedOrders, "customerRating")
  const driverDist = calcDistribution(reviewedOrders, "driverRating")
  const orderAvg = calcAvg(reviewedOrders, "customerRating")
  const driverAvg = calcAvg(reviewedOrders, "driverRating")

  // Filter & sort
  const filtered = useMemo(() => {
    let list = [...reviewedOrders]

    // tab escalation = ratings <= 2
    if (tab === "escalation") {
      list = list.filter(
        (o) => (o.customerRating ?? 5) <= 2 || (o.driverRating ?? 5) <= 2
      )
    }

    // date filter
    if (dateFilter !== "all") {
      const now = Date.now()
      const msMap: Record<string, number> = {
        today: 86_400_000,
        week: 604_800_000,
        month: 2_592_000_000,
      }
      const cutoff = now - msMap[dateFilter]
      list = list.filter((o) => {
        const ts = o.customerRatedAt
        if (!ts) return false
        const ms =
          typeof ts === "number"
            ? ts
            : ts && typeof ts === "object" && "toMillis" in ts
              ? (ts as { toMillis: () => number }).toMillis()
              : 0
        return ms >= cutoff
      })
    }

    // rating filters
    if (orderRatingFilter !== "all") {
      const r = Number(orderRatingFilter)
      list = list.filter((o) => o.customerRating === r)
    }
    if (driverRatingFilter !== "all") {
      const r = Number(driverRatingFilter)
      list = list.filter((o) => o.driverRating === r)
    }

    // sort
    list.sort((a, b) => {
      if (sortBy === "newest" || sortBy === "oldest") {
        const getMs = (o: Order) => {
          const ts = o.customerRatedAt
          if (!ts) return 0
          if (typeof ts === "number") return ts
          if (ts && typeof ts === "object" && "toMillis" in ts)
            return (ts as { toMillis: () => number }).toMillis()
          return 0
        }
        return sortBy === "newest"
          ? getMs(b) - getMs(a)
          : getMs(a) - getMs(b)
      }
      if (sortBy === "highest")
        return (b.customerRating ?? 0) - (a.customerRating ?? 0)
      return (a.customerRating ?? 0) - (b.customerRating ?? 0)
    })

    return list
  }, [reviewedOrders, tab, dateFilter, orderRatingFilter, driverRatingFilter, sortBy])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Reviews</h1>

      {/* Rating summaries */}
      <div className="grid gap-4 sm:grid-cols-2">
        <RatingDistribution
          label="Order rating average"
          average={orderAvg}
          distribution={orderDist}
        />
        <RatingDistribution
          label="Driver rating average"
          average={driverAvg}
          distribution={driverDist}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {(["all", "escalation"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "all" ? "All reviews" : "Escalation reviews"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterSelect
          value={dateFilter}
          onChange={setDateFilter}
          options={[
            { value: "all", label: "All Time" },
            { value: "today", label: "Today" },
            { value: "week", label: "This Week" },
            { value: "month", label: "This Month" },
          ]}
        />
        <FilterSelect
          value={orderRatingFilter}
          onChange={setOrderRatingFilter}
          options={[
            { value: "all", label: "Order rating" },
            { value: "5", label: "5 Stars" },
            { value: "4", label: "4 Stars" },
            { value: "3", label: "3 Stars" },
            { value: "2", label: "2 Stars" },
            { value: "1", label: "1 Star" },
          ]}
        />
        <FilterSelect
          value={driverRatingFilter}
          onChange={setDriverRatingFilter}
          options={[
            { value: "all", label: "Driver rating" },
            { value: "5", label: "5 Stars" },
            { value: "4", label: "4 Stars" },
            { value: "3", label: "3 Stars" },
            { value: "2", label: "2 Stars" },
            { value: "1", label: "1 Star" },
          ]}
        />
        <FilterSelect
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: "newest", label: "Sort by: Newest" },
            { value: "oldest", label: "Sort by: Oldest" },
            { value: "highest", label: "Sort by: Highest" },
            { value: "lowest", label: "Sort by: Lowest" },
          ]}
        />
      </div>

      {/* Review list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <MessageSquare className="size-10" />
            <p className="text-sm">No reviews yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const driver = order.assignedDriver
              ? driverMap.get(order.assignedDriver)
              : null
            const ratedDate = (() => {
              const ts = order.customerRatedAt
              if (!ts) return ""
              let d: Date | null = null
              if (typeof ts === "number") d = new Date(ts)
              else if (ts && typeof ts === "object" && "toDate" in ts)
                d = (ts as { toDate: () => Date }).toDate()
              if (!d) return ""
              return d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            })()

            return (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left side */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {order.customerName?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {order.customerName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ratedDate}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Order:{" "}
                          <span className="font-medium text-foreground">
                            #{order.orderNumber}
                          </span>
                        </span>
                        {driver && (
                          <span>
                            Driver:{" "}
                            <span className="font-medium text-foreground">
                              {driver.name}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className="flex items-center gap-1">
                          Order rating{" "}
                          <StarRow rating={order.customerRating ?? 0} />
                        </span>
                        {order.driverRating != null && order.driverRating > 0 && (
                          <span className="flex items-center gap-1">
                            Driver rating{" "}
                            <StarRow rating={order.driverRating} />
                          </span>
                        )}
                      </div>

                      {order.customerFeedback && (
                        <p className="text-sm text-muted-foreground">
                          &ldquo;{order.customerFeedback}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Right side – respond button */}
                    <button className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700">
                      Respond
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
