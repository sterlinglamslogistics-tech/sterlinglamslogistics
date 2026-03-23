"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Truck,
  Package,
  MapPin,
  Clock,
  Shield,
  ChevronRight,
  Search,
  Phone,
  Mail,
  ArrowRight,
} from "lucide-react"

export default function LandingPage() {
  const [trackingId, setTrackingId] = useState("")
  const router = useRouter()

  function handleTrack(e: React.FormEvent) {
    e.preventDefault()
    const id = trackingId.trim()
    if (id) {
      router.push(`/track/${encodeURIComponent(id)}`)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <span className="text-base font-bold tracking-tight">Sterling Lams</span>
              <span className="block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Logistics
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#services" className="transition hover:text-foreground">Services</a>
            <a href="#tracking" className="transition hover:text-foreground">Track</a>
            <a href="#about" className="transition hover:text-foreground">About</a>
            <a href="#contact" className="transition hover:text-foreground">Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Shield className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.04] to-transparent" />
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-24 sm:px-6 sm:pt-32 lg:pt-40">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Now delivering across Lagos &amp; beyond
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Fast, Reliable
              <br />
              <span className="text-primary">Delivery Service</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              The official logistics arm of{" "}
              <a
                href="https://www.sterlinglams.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              >
                Sterling Lams
              </a>
              . We pick up, ship, and deliver your packages with
              real-time tracking&nbsp;and&nbsp;care.
            </p>

            {/* Tracking bar */}
            <form
              onSubmit={handleTrack}
              className="mx-auto mt-10 flex max-w-md items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Enter tracking ID"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  className="h-11 pl-9"
                />
              </div>
              <Button type="submit" className="h-11 px-5">
                Track <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="border-t border-border/50 bg-secondary/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">What We Offer</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            End-to-end logistics solutions tailored for your business
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Package,
                title: "Parcel Delivery",
                desc: "Same-day and next-day parcel pick-up and delivery anywhere in the city.",
              },
              {
                icon: Truck,
                title: "Dispatch Rider",
                desc: "Dedicated riders for urgent documents, food, and time-sensitive goods.",
              },
              {
                icon: MapPin,
                title: "Real-Time Tracking",
                desc: "Follow your package every step of the way with live GPS tracking.",
              },
              {
                icon: Clock,
                title: "Scheduled Pickup",
                desc: "Book pickups in advance and manage recurring deliveries effortlessly.",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/60 bg-card p-6 transition hover:shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRACKING CTA ── */}
      <section id="tracking" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl bg-primary p-8 text-primary-foreground sm:p-12">
            <div className="flex flex-col items-center gap-8 lg:flex-row lg:justify-between">
              <div className="max-w-md text-center lg:text-left">
                <h2 className="text-2xl font-bold sm:text-3xl">Track Your Package</h2>
                <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
                  Enter your tracking number to see live location, estimated arrival time,
                  and delivery status — updated in real time.
                </p>
              </div>
              <form
                onSubmit={handleTrack}
                className="flex w-full max-w-sm items-center gap-2"
              >
                <Input
                  placeholder="Tracking ID"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  className="h-11 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/50"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="h-11 shrink-0 gap-1"
                >
                  Track <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="border-t border-border/50 bg-secondary/30 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">About Sterling Lams Logistics</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Sterling Lams Logistics is the official delivery division of{" "}
            <a
              href="https://www.sterlinglams.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              Sterling Lams
            </a>
            . We provide fast, secure, and affordable courier services powered by
            technology — from smart route optimisation to real-time GPS tracking.
            Our mission is to make every delivery seamless and every customer confident
            their package will arrive safely and on time.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              { value: "5K+", label: "Deliveries" },
              { value: "99%", label: "On-Time Rate" },
              { value: "24/7", label: "Support" },
            ].map((stat, i) => (
              <div key={i}>
                <p className="text-2xl font-bold text-primary sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Get In Touch</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Have a question or need a quote? Reach out to us.
          </p>

          <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4">
            <a
              href="mailto:logistics@sterlinglams.com"
              className="flex items-center gap-3 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <Mail className="h-4 w-4 text-primary" />
              logistics@sterlinglams.com
            </a>
            <a
              href="tel:+2340000000000"
              className="flex items-center gap-3 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <Phone className="h-4 w-4 text-primary" />
              +234 000 000 0000
            </a>
            <a
              href="https://www.sterlinglams.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-sm font-medium text-primary underline underline-offset-2"
            >
              www.sterlinglams.com
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/50 bg-secondary/30 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <Truck className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold">Sterling Lams Logistics</span>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} sterlinglamslogistics.com &mdash; All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
