"use client";

import { useState } from "react";
import Link from "next/link";

// Mini 24-seat interactive demo data for prospective library owners to test
interface DemoSeat {
  id: number;
  status: "free" | "full_day" | "half_day" | "double_shift" | "due";
  studentName?: string;
  shift?: string;
}

const INITIAL_DEMO_SEATS: DemoSeat[] = [
  { id: 1, status: "full_day", studentName: "Rahul S.", shift: "Full Day" },
  { id: 2, status: "double_shift", studentName: "Amit (M) & Priya (E)", shift: "2x Shift" },
  { id: 3, status: "free" },
  { id: 4, status: "half_day", studentName: "Sushil D.", shift: "Shift 1" },
  { id: 5, status: "due", studentName: "Neeraj R.", shift: "Overdue 2 Days" },
  { id: 6, status: "free" },
  { id: 7, status: "full_day", studentName: "Mansi M.", shift: "Full Day" },
  { id: 8, status: "double_shift", studentName: "Vikas & Ankit", shift: "2x Shift" },
  { id: 9, status: "free" },
  { id: 10, status: "free" },
  { id: 11, status: "half_day", studentName: "Rohan K.", shift: "Shift 2" },
  { id: 12, status: "full_day", studentName: "Kavita N.", shift: "Full Day" },
  { id: 13, status: "due", studentName: "Deepak S.", shift: "Overdue 4 Days" },
  { id: 14, status: "free" },
  { id: 15, status: "double_shift", studentName: "Mohit & Aarti", shift: "2x Shift" },
  { id: 16, status: "free" },
  { id: 17, status: "full_day", studentName: "Alok T.", shift: "Full Day" },
  { id: 18, status: "free" },
  { id: 19, status: "half_day", studentName: "Sonia G.", shift: "Shift 1" },
  { id: 20, status: "free" },
  { id: 21, status: "full_day", studentName: "Harish B.", shift: "Full Day" },
  { id: 22, status: "double_shift", studentName: "Pooja & Ritu", shift: "2x Shift" },
  { id: 23, status: "free" },
  { id: 24, status: "free" },
];

export default function SaaSMarketingLandingPage() {
  const [demoSeats, setDemoSeats] = useState<DemoSeat[]>(INITIAL_DEMO_SEATS);
  const [selectedSeat, setSelectedSeat] = useState<DemoSeat | null>(null);
  const [pricingMode, setPricingMode] = useState<"flat" | "per_seat">("flat");
  const [customSeatCount, setCustomSeatCount] = useState<number>(100);

  const toggleSeatStatus = (seat: DemoSeat) => {
    setSelectedSeat(seat);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-rose-500 selection:text-white">
      {/* 1. Global SaaS Navbar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-panel-border px-4 md:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-2xl p-2 rounded-2xl bg-rose-500/10 border border-rose-500/20 group-hover:scale-105 transition-transform">
              📚
            </span>
            <div>
              <span className="font-extrabold text-base tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-amber-500">
                LIBRARYOS
              </span>
              <span className="text-[10px] text-text-muted block -mt-1 font-mono">B2B SaaS</span>
            </div>
          </Link>

          {/* Center Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-text-muted">
            <a href="#features" className="hover:text-text-main transition">Features</a>
            <Link href="/l/demo-library" className="hover:text-text-main text-rose-600 dark:text-rose-400 font-bold transition flex items-center gap-1">
              <span>✨</span> Live Demo
            </Link>
            <a href="#interactive-demo" className="hover:text-text-main transition">Live Simulator</a>
            <a href="#how-it-works" className="hover:text-text-main transition">How It Works</a>
            <a href="#pricing" className="hover:text-text-main transition">Pricing</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-main hover:bg-neutral-500/5 transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-sm shadow-rose-600/20 transition active:scale-95"
            >
              Start Free Trial →
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-16 pb-20 px-4 md:px-8 max-w-7xl mx-auto text-center space-y-7 overflow-hidden">
        {/* Glow orb in center */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 blur-3xl rounded-full pointer-events-none -z-10" />

        {/* Micro badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-extrabold shadow-xs animate-in fade-in slide-in-from-top-2">
          <span>⚡</span> India&apos;s #1 Study Library Operating System
        </div>

        {/* Big Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight max-w-4xl mx-auto leading-[1.12]">
          Ditch the Paper Registers.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-amber-500 to-rose-500">
            Run Your Study Library
          </span>{" "}
          on Auto-Pilot.
        </h1>

        {/* Subtitle */}
        <p className="text-sm md:text-base text-text-muted max-w-2xl mx-auto leading-relaxed">
          The all-in-one platform built for Indian self-study rooms. Prevent double-shift seat clashes, collect fees instantly with <strong>0% UPI Soundbox billing</strong>, and issue verified Apple Wallet passes via WhatsApp.
        </p>

        {/* Primary Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm shadow-lg shadow-rose-600/25 transition-all active:scale-95 text-center"
          >
            Launch Your Library (7-Day Free Trial) 🚀
          </Link>

          <Link
            href="/l/demo-library"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition text-center flex items-center justify-center gap-2"
          >
            <span>👀</span> Explore Live Demo Desk ↗
          </Link>
        </div>

        {/* Trust metrics */}
        <div className="pt-6 border-t border-panel-border/60 max-w-3xl mx-auto flex items-center justify-center gap-6 sm:gap-12 flex-wrap text-text-muted text-xs">
          <div>
            <span className="font-extrabold text-text-main text-sm">50 to 500+</span>
            <span className="block text-[11px]">Seats Capacity</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-neutral-500/40"></div>
          <div>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">0% Gateway Fee</span>
            <span className="block text-[11px]">Direct Soundbox UPI</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-neutral-500/40"></div>
          <div>
            <span className="font-extrabold text-text-main text-sm">Instant</span>
            <span className="block text-[11px]">WhatsApp Passes</span>
          </div>
        </div>
      </section>

      {/* 3. Interactive Live Seat Matrix Simulator */}
      <section id="interactive-demo" className="py-16 px-4 md:px-8 max-w-6xl mx-auto">
        <div className="bg-card-bg border-2 border-panel-border rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-panel-border pb-5">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">
                <span>🎮</span> Interactive Live Simulator
              </div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight">
                Experience the Cinema Seat Matrix
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Click any seat below to test real-time occupancy, double shifts, and overdue fee alerts.
              </p>
            </div>

            {/* Quick Status Legend */}
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-950 font-bold border border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/40">
                🟢 Free
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-950 font-bold border border-rose-400 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/40">
                🔴 Full Day
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 font-bold border border-amber-400 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/40">
                🟡 Half Day
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-950 font-bold border border-purple-400 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/40">
                🟣 2x Shift Split
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-950 font-bold border border-blue-400 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/40">
                🔵 Due Fee
              </span>
            </div>
          </div>

          {/* 24-Seat Simulator Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
            {demoSeats.map((s) => {
              let color = "bg-emerald-100 text-emerald-950 border-2 border-emerald-400 hover:bg-emerald-200 hover:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/40 dark:hover:bg-emerald-900/60";
              let label = "Free";
              if (s.status === "full_day") {
                color = "bg-rose-100 text-rose-950 border-2 border-rose-400 hover:bg-rose-200 hover:border-rose-500 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/40 dark:hover:bg-rose-900/60";
                label = "Full";
              } else if (s.status === "half_day") {
                color = "bg-amber-100 text-amber-950 border-2 border-amber-400 hover:bg-amber-200 hover:border-amber-500 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/40 dark:hover:bg-amber-900/60";
                label = "1x Shift";
              } else if (s.status === "double_shift") {
                color = "bg-purple-100 text-purple-950 border-2 border-purple-400 hover:bg-purple-200 hover:border-purple-500 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/40 dark:hover:bg-purple-900/60";
                label = "2x Shift";
              } else if (s.status === "due") {
                color = "bg-blue-100 text-blue-950 border-2 border-blue-400 hover:bg-blue-200 hover:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/40 dark:hover:bg-blue-900/60";
                label = "Due";
              }

              return (
                <button
                  key={s.id}
                  onClick={() => toggleSeatStatus(s)}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 text-xs font-bold transition-all hover:scale-105 cursor-pointer shadow-xs ${color}`}
                >
                  <span className="font-mono text-sm font-black">#{s.id}</span>
                  <span className="text-[9px] font-extrabold uppercase mt-0.5 opacity-90">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Seat Inspector Detail Box */}
          {selectedSeat && (
            <div className="p-4 rounded-2xl bg-background border border-panel-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in">
              <div>
                <span className="font-extrabold text-sm text-text-main">
                  Seat #{selectedSeat.id} Inspection:
                </span>{" "}
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {selectedSeat.studentName || "Available to Allocate"}
                </span>{" "}
                {selectedSeat.shift && (
                  <span className="text-text-muted">({selectedSeat.shift})</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/signup"
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition"
                >
                  Create Your Own Matrix →
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. The 4 Big Pillars (Features) */}
      <section id="features" className="py-16 px-4 md:px-8 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Why Modern Libraries Switch
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
            Engineered Specifically for Indian Study Hubs
          </h2>
          <p className="text-xs md:text-sm text-text-muted">
            Generic hotel or gym software fails in libraries because study halls have unique shift overlaps and cash collection habits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Pillar 1 */}
          <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm space-y-3 hover:border-rose-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-2xl flex items-center justify-center">
              🪑
            </div>
            <h3 className="font-black text-base text-text-main">Zero Seat Clashes</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              2 students sharing 1 seat across Morning and Evening shifts? Our smart double-shift logic tracks both students seamlessly without collisions.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm space-y-3 hover:border-emerald-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-2xl flex items-center justify-center">
              🔊
            </div>
            <h3 className="font-black text-base text-text-main">0% Fee Soundbox UPI</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Never pay 2% to Razorpay. Money deposits directly into your Paytm/PhonePe soundbox bank account with instant 12-digit UTR verification.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm space-y-3 hover:border-sky-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-2xl flex items-center justify-center">
              🚪
            </div>
            <h3 className="font-black text-base text-text-main">Door QR Self-Admission</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Stick your printable QR poster on your glass door. Students scan, pick their shift, pay on phone, and desk staff clicks 1-click &quot;Approve&quot;.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm space-y-3 hover:border-amber-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-2xl flex items-center justify-center">
              📱
            </div>
            <h3 className="font-black text-base text-text-main">Apple Wallet Passes</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Glassmorphic digital wallet membership cards with live QR verification codes, sent straight to the student&apos;s WhatsApp.
            </p>
          </div>
        </div>
      </section>

      {/* 5. How It Works Section */}
      <section id="how-it-works" className="py-16 px-4 md:px-8 bg-neutral-500/5 border-y border-panel-border">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Effortless Setup
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              From Signup to Live Operations in 3 Minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card-bg border border-panel-border rounded-3xl p-6 text-center space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white font-black text-sm flex items-center justify-center mx-auto shadow-md">
                1
              </div>
              <h3 className="font-extrabold text-sm text-text-main">Register in 60s</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Choose your total seat count, your custom URL slug, and define your shift hours (Morning, Evening, Full Day).
              </p>
            </div>

            <div className="bg-card-bg border border-panel-border rounded-3xl p-6 text-center space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white font-black text-sm flex items-center justify-center mx-auto shadow-md">
                2
              </div>
              <h3 className="font-extrabold text-sm text-text-main">Print Door Poster</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Click 1 button in your Owner Dashboard to generate a high-res A4 poster and stick it on your front door.
              </p>
            </div>

            <div className="bg-card-bg border border-panel-border rounded-3xl p-6 text-center space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white font-black text-sm flex items-center justify-center mx-auto shadow-md">
                3
              </div>
              <h3 className="font-extrabold text-sm text-text-main">Watch Seats Fill Up</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Students scan, pay to your soundbox, and your receptionist gets instant alerts to allocate seats in 1 click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Transparent Pricing */}
      <section id="pricing" className="py-20 px-4 md:px-8 max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <div className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Simple, Honest Pricing
          </div>
          <h2 className="text-3xl font-black tracking-tight">
            Costs Less Than 1 Student Fee
          </h2>
          <p className="text-xs text-text-muted">
            If you charge students ₹900/month, our software pays for itself on day 1.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Card 1: Flat Unlimited */}
          <div className="bg-card-bg border-2 border-rose-500/50 rounded-3xl p-7 shadow-xl space-y-6 relative flex flex-col justify-between">
            <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
              Most Popular
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-black text-lg text-text-main">Flat Monthly Pro</h3>
                <p className="text-xs text-text-muted mt-0.5">For libraries with 50 to 500+ seats.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black font-mono">₹599</span>
                <span className="text-xs text-text-muted font-semibold">/ month flat</span>
              </div>

              <ul className="space-y-2.5 text-xs text-text-muted">
                <li className="flex items-center gap-2 text-text-main font-medium">
                  <span className="text-emerald-500 font-bold">✓</span> Unlimited Seats (up to 500)
                </li>
                <li className="flex items-center gap-2 text-text-main font-medium">
                  <span className="text-emerald-500 font-bold">✓</span> 0% Fee Soundbox UPI Gateway
                </li>
                <li className="flex items-center gap-2 text-text-main font-medium">
                  <span className="text-emerald-500 font-bold">✓</span> Door QR Self-Admission System
                </li>
                <li className="flex items-center gap-2 text-text-main font-medium">
                  <span className="text-emerald-500 font-bold">✓</span> Owner &amp; Staff Password Separation
                </li>
                <li className="flex items-center gap-2 text-text-main font-medium">
                  <span className="text-emerald-500 font-bold">✓</span> Real-Time Cash &amp; UPI Ledger
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md transition active:scale-95 text-center block"
            >
              Start 7-Day Free Trial →
            </Link>
          </div>

          {/* Card 2: Pay Per Seat */}
          <div className="bg-card-bg border border-panel-border rounded-3xl p-7 shadow-sm space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h3 className="font-black text-lg text-text-main">Pay-As-You-Grow</h3>
                <p className="text-xs text-text-muted mt-0.5">Ideal for boutique rooms with under 80 seats.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black font-mono">₹6</span>
                <span className="text-xs text-text-muted font-semibold">/ seat / month</span>
              </div>

              <ul className="space-y-2.5 text-xs text-text-muted">
                <li className="flex items-center gap-2 text-text-main font-medium">
                  <span className="text-emerald-500 font-bold">✓</span> Pay only for active seats
                </li>
                <li className="flex items-center gap-2 text-text-main font-medium">
                  <span className="text-emerald-500 font-bold">✓</span> 0% Fee Soundbox UPI Gateway
                </li>
                <li className="flex items-center gap-2 text-text-main font-medium">
                  <span className="text-emerald-500 font-bold">✓</span> Door QR Self-Admission System
                </li>
                <li className="flex items-center gap-2 text-text-main font-medium">
                  <span className="text-emerald-500 font-bold">✓</span> Digital Passes &amp; Tax Invoices
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className="w-full py-3.5 rounded-2xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition text-center block"
            >
              Start Free Trial →
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="border-t border-panel-border bg-background py-10 px-4 md:px-8 text-xs text-text-muted">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-text-main tracking-widest">LIBRARYOS</span>
            <span>• The Operating System for Indian Study Libraries</span>
          </div>

          <div className="flex items-center gap-5 font-semibold">
            <Link href="/login" className="hover:text-text-main transition">Client Login</Link>
            <Link href="/signup" className="hover:text-text-main transition">Sign Up</Link>
            <Link href="/l/demo-library" className="hover:text-text-main transition">Live Demo</Link>
            <Link href="/superadmin" className="hover:text-amber-600 transition">Founder Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
