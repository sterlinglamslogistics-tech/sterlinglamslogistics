
"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Package, Truck, MapPin, Clock, Shield, Search, ArrowRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function LandingPage() {
  const [trackingId, setTrackingId] = useState("")
  const router = useRouter()

  function handleTrack(e: React.FormEvent) {
    e.preventDefault()
    if (trackingId.trim()) {
      router.push(`/track/${encodeURIComponent(trackingId.trim())}`)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 lg:px-8">
          <Link href="/">
            <Image
              src="/placeholder-logo.png"
              alt="Sterlinglams"
              width={80}
              height={80}
              className="rounded-lg"
            />
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="https://sterlinglams.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              Shop Sterlinglams
              <ExternalLink className="size-3.5" />
            </a>
            <Link href="/login">
              <Button size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
              Official Delivery Partner of{" "}
              <a
                href="https://sterlinglams.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-primary/80"
              >
                Sterlinglams.com
              </a>
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Your Order,{" "}
              <span className="text-primary">Delivered with Care</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              We handle every Sterlinglams order — from jewellery to accessories —
              with real-time tracking, same-day dispatch, and secure packaging so
              your items arrive safely and on time.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/login">
                <Button size="lg" className="gap-2 px-8">
                  <Package className="size-5" />
                  Manage Deliveries
                </Button>
              </Link>
              <a
                href="https://sterlinglams.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="lg" className="gap-2 px-8">
                  Visit Sterlinglams Store
                  <ExternalLink className="size-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Track Section */}
      <section className="border-t border-border bg-secondary/30 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight">Track Your Order</h2>
          <p className="mt-2 text-muted-foreground">
            Enter your tracking number to see live delivery status
          </p>
          <form
            onSubmit={handleTrack}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter tracking ID"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm outline-none ring-ring transition-shadow focus:ring-2"
              />
            </div>
            <Button type="submit" size="lg" className="gap-2">
              Track
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
            <p className="mt-3 text-muted-foreground">
              From checkout on Sterlinglams to your doorstep
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Order Placed",
                description:
                  "You shop on sterlinglams.com and complete your purchase. We receive your order automatically.",
              },
              {
                step: "02",
                title: "Dispatched & Tracked",
                description:
                  "Our team picks, packs, and dispatches your item. You get a tracking link with live GPS updates.",
              },
              {
                step: "03",
                title: "Safe Delivery",
                description:
                  "Your jewellery or accessories arrive securely packaged at your door — on time, every time.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-secondary/30 py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Why We&apos;re Trusted</h2>
            <p className="mt-3 text-muted-foreground">
              Built exclusively for Sterlinglams customers
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Clock,
                title: "Same-Day Dispatch",
                description: "Orders placed before 2 PM are dispatched the same day.",
              },
              {
                icon: MapPin,
                title: "Live GPS Tracking",
                description: "Follow your package in real-time from warehouse to doorstep.",
              },
              {
                icon: Shield,
                title: "Secure Packaging",
                description: "Jewellery and accessories are wrapped and insured for protection.",
              },
              {
                icon: Truck,
                title: "Dedicated Fleet",
                description: "Our riders handle only Sterlinglams orders — no third parties.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-background p-6 text-center transition-shadow hover:shadow-md"
              >
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="size-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground">
            <h2 className="text-3xl font-bold">Shop Sterlinglams Today</h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
              Browse the full collection of jewellery, watches, and accessories.
              We&apos;ll take care of the delivery.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="https://sterlinglams.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="secondary" className="gap-2 px-8">
                  Visit Sterlinglams.com
                  <ExternalLink className="size-4" />
                </Button>
              </a>
              <Link href="/login">
                <Button size="lg" variant="outline" className="gap-2 border-primary-foreground/30 px-8 text-primary-foreground hover:bg-primary-foreground/10">
                  Admin Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/30 py-12">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <Image
                src="/placeholder-logo.png"
                alt="Sterlinglams"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Delivery by Sterlinglams</span>
                <a
                  href="https://sterlinglams.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  sterlinglams.com
                </a>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Sterlinglams. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

