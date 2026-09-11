"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setStoredSession, UserRole } from "@/lib/auth";
import { Library } from "@/lib/types";
import { FALLBACK_TARGET_LIBRARY } from "@/lib/tenant";

export default function UniversalLoginPage() {
  const router = useRouter();
  const [libraries, setLibraries] = useState<Library[]>([FALLBACK_TARGET_LIBRARY]);
  const [selectedSlug, setSelectedSlug] = useState<string>("target-library");

  useEffect(() => {
    async function loadLibraries() {
      try {
        const res = await fetch("/api/libraries?all=true");
        if (res.ok) {
          const data = await res.json();
          if (data.libraries && data.libraries.length > 0) {
            setLibraries(data.libraries);
            setSelectedSlug(data.libraries[0].slug);
          }
        }
      } catch {
        // Safe fallback
      }
    }
    loadLibraries();
  }, []);

  const selectedLib = libraries.find((l) => l.slug === selectedSlug) || libraries[0];

  const handleQuickLogin = (role: UserRole, destination: string) => {
    // Save active session for client components
    setStoredSession({
      role,
      libraryId: selectedLib.id,
      librarySlug: selectedLib.slug,
      username: role === "superadmin" ? "founder" : role === "owner" ? "owner" : "staff",
      fullName:
        role === "superadmin"
          ? "SaaS Founder"
          : role === "owner"
          ? `${selectedLib.name} Owner`
          : `${selectedLib.name} Desk Staff`,
    });

    sessionStorage.setItem("target_lib_auth", "true");
    router.push(destination);
  };

  return (
    <main className="min-h-screen bg-background text-text-main flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-xl">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-3xl mb-3 shadow-inner">
            📚
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Library Operating System
          </h1>
          <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
            Select your portal below. Zero password friction enabled for rapid development and live client demos.
          </p>
        </div>

        {/* Tenant Selector Bar */}
        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                Active Library Workspace
              </label>
              <div className="text-xs text-text-muted mt-0.5">
                Switch between different libraries in Dehradun
              </div>
            </div>

            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="bg-background border border-panel-border text-sm font-semibold rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
            >
              {libraries.map((lib) => (
                <option key={lib.id} value={lib.slug}>
                  {lib.name} ({lib.city || "Dehradun"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Role Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: Desk Librarian */}
          <button
            onClick={() => handleQuickLogin("staff", `/l/${selectedSlug}`)}
            className="text-left bg-card-bg border border-panel-border hover:border-rose-500/40 rounded-2xl p-4.5 shadow-sm transition-all hover:scale-[1.01] group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                💻
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                Front Desk
              </span>
            </div>
            <h3 className="font-extrabold text-sm text-text-main group-hover:text-rose-600 transition">
              Librarian Desk Portal
            </h3>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
              Seat matrix, double-shift grid, walk-in receipts, and daily fee register.
            </p>
          </button>

          {/* Card 2: Student Entrance QR Portal */}
          <button
            onClick={() => handleQuickLogin("student", `/l/${selectedSlug}/join`)}
            className="text-left bg-card-bg border border-panel-border hover:border-emerald-500/40 rounded-2xl p-4.5 shadow-sm transition-all hover:scale-[1.01] group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                📱
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Student View
              </span>
            </div>
            <h3 className="font-extrabold text-sm text-text-main group-hover:text-emerald-600 transition">
              Entrance QR Self-Admission
            </h3>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
              What students see when scanning the front door QR code: pick plan & pay via UPI.
            </p>
          </button>

          {/* Card 3: Library Owner Settings */}
          <button
            onClick={() => handleQuickLogin("owner", `/l/${selectedSlug}/settings`)}
            className="text-left bg-card-bg border border-panel-border hover:border-sky-500/40 rounded-2xl p-4.5 shadow-sm transition-all hover:scale-[1.01] group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                👑
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                Owner Only
              </span>
            </div>
            <h3 className="font-extrabold text-sm text-text-main group-hover:text-sky-600 transition">
              Library Owner Settings
            </h3>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
              Configure total seats, shift timings, prices, and desk soundbox UPI ID.
            </p>
          </button>

          {/* Card 4: SaaS Founder Super-Admin */}
          <button
            onClick={() => handleQuickLogin("superadmin", `/superadmin`)}
            className="text-left bg-card-bg border border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5 rounded-2xl p-4.5 shadow-sm transition-all hover:scale-[1.01] group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl p-2 rounded-xl bg-amber-500/15 border border-amber-500/30">
                🛡️
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
                Founder Portal
              </span>
            </div>
            <h3 className="font-extrabold text-sm text-text-main group-hover:text-amber-600 transition">
              SaaS Super-Admin
            </h3>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
              Track MRR revenue, onboard new libraries, and manage monthly ₹ subscriptions.
            </p>
          </button>
        </div>

        {/* Direct Link to Target Library Legacy Root */}
        <div className="text-center mt-6">
          <Link
            href="/dashboard"
            className="text-xs text-text-muted hover:text-text-main underline decoration-dotted transition"
          >
            ← Open Default Target Library Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
