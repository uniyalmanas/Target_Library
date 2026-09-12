"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setStoredSession, UserRole } from "@/lib/auth";
import { Library } from "@/lib/types";
import { FALLBACK_TARGET_LIBRARY } from "@/lib/tenant";

interface AuthModalState {
  role: "staff" | "owner" | "superadmin";
  title: string;
  subtitle: string;
  icon: string;
  defaultHint: string;
  destination: string;
}

export default function UniversalLoginPage() {
  const router = useRouter();
  const [libraries, setLibraries] = useState<Library[]>([FALLBACK_TARGET_LIBRARY]);
  const [selectedSlug, setSelectedSlug] = useState<string>("target-library");

  // Modal Auth State
  const [activeModal, setActiveModal] = useState<AuthModalState | null>(null);
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const openAuthModal = (modalInfo: AuthModalState) => {
    setPassword("");
    setAuthError(null);
    setActiveModal(modalInfo);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal) return;
    if (!password.trim()) {
      setAuthError("Please enter your password.");
      return;
    }

    setLoggingIn(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: activeModal.role === "superadmin" ? "target-library" : selectedSlug,
          role: activeModal.role,
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Save real user session
      setStoredSession({
        role: data.user.role,
        libraryId: data.user.libraryId || selectedLib.id,
        librarySlug: data.user.slug || selectedLib.slug,
        username: data.user.username,
        fullName: data.user.fullName,
      });

      sessionStorage.setItem("target_lib_auth", "true");
      setActiveModal(null);
      router.push(activeModal.destination);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoggingIn(false);
    }
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
            Choose your login portal below. Real credential authentication with instant demo bypass is enabled.
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
            onClick={() =>
              openAuthModal({
                role: "staff",
                title: "Front Desk Staff Login",
                subtitle: `Librarian Desk for ${selectedLib.name}`,
                icon: "💻",
                defaultHint: "Target2026",
                destination: `/l/${selectedSlug}`,
              })
            }
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

          {/* Card 2: Student Entrance QR & Pass Portal */}
          <button
            onClick={() => router.push(`/l/${selectedSlug}/student`)}
            className="text-left bg-card-bg border border-panel-border hover:border-emerald-500/40 rounded-2xl p-4.5 shadow-sm transition-all hover:scale-[1.01] group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                📱
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Student Portal
              </span>
            </div>
            <h3 className="font-extrabold text-sm text-text-main group-hover:text-emerald-600 transition">
              Digital Pass & Admission
            </h3>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
              View digital ID card, assigned seat, shift timing, and past fee receipts.
            </p>
          </button>

          {/* Card 3: Library Owner Settings */}
          <button
            onClick={() =>
              openAuthModal({
                role: "owner",
                title: "Library Owner Login",
                subtitle: `Admin configuration for ${selectedLib.name}`,
                icon: "👑",
                defaultHint: "TargetOwner2026",
                destination: `/l/${selectedSlug}/settings`,
              })
            }
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
            onClick={() =>
              openAuthModal({
                role: "superadmin",
                title: "SaaS Founder Login",
                subtitle: "Platform-wide SaaS Super-Admin & MRR metrics",
                icon: "🛡️",
                defaultHint: "Founder2026",
                destination: `/superadmin`,
              })
            }
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

      {/* Password Authentication Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-card-bg border border-panel-border rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main p-1.5 rounded-xl hover:bg-neutral-500/10 transition cursor-pointer text-sm font-bold"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                {activeModal.icon}
              </span>
              <div>
                <h2 className="text-base font-extrabold text-text-main">
                  {activeModal.title}
                </h2>
                <p className="text-xs text-text-muted">{activeModal.subtitle}</p>
              </div>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                <span>⚠️</span> {authError}
              </div>
            )}

            {/* Password Form */}
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                  Enter Password
                </label>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password..."
                  required
                  className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                />
                <div className="text-[11px] text-text-muted mt-1.5 flex items-center justify-between">
                  <span>Default Passcode: <span className="font-mono font-semibold">{activeModal.defaultHint}</span></span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn || !password.trim()}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loggingIn ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Verifying...
                  </>
                ) : (
                  <>🔒 Login to Portal</>
                )}
              </button>
            </form>

            {/* Instant Demo Bypass Option */}
            <div className="mt-5 pt-4 border-t border-panel-border text-center">
              <button
                type="button"
                onClick={() => handleQuickLogin(activeModal.role, activeModal.destination)}
                className="text-xs text-text-muted hover:text-amber-500 dark:hover:text-amber-400 font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>⚡</span>
                <span>Demo Mode: Bypass Password & Enter Directly</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
