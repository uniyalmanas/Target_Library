"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setStoredSession, getStoredSession, clearStoredSession } from "@/lib/auth";
import { Library } from "@/lib/types";
import LibraryLogo from "@/lib/LibraryLogo";

interface AuthModalState {
  role: "staff" | "owner";
  title: string;
  subtitle: string;
  icon: string;
  destination: string;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySlug = searchParams.get("slug")?.trim() || "";

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [loadingLib, setLoadingLib] = useState(true);

  // Registered Libraries & Search State (Scenario 2)
  const [registeredLibraries, setRegisteredLibraries] = useState<Library[]>([]);
  const [loadingRegistered, setLoadingRegistered] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searchingSlug, setSearchingSlug] = useState(false);

  // Modal Auth State
  const [activeModal, setActiveModal] = useState<AuthModalState | null>(null);
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fetch registered libraries
  const fetchRegisteredLibraries = async () => {
    setLoadingRegistered(true);
    try {
      const res = await fetch("/api/libraries?all=true");
      if (res.ok) {
        const data = await res.json();
        setRegisteredLibraries(data.libraries || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRegistered(false);
    }
  };

  // Resolve active library slug ONLY if explicitly provided in query params (e.g. /login?slug=xyz)
  useEffect(() => {
    fetchRegisteredLibraries();

    if (querySlug) {
      loadLibrary(querySlug);
    } else {
      setActiveSlug(null);
      setLibrary(null);
      setLoadingLib(false);
    }
  }, [querySlug]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModal) {
        setActiveModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

  const loadLibrary = async (slugToLoad: string) => {
    setLoadingLib(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/libraries?slug=${encodeURIComponent(slugToLoad)}`);
      const data = await res.json();
      if (res.ok && data.library) {
        setLibrary(data.library);
        setActiveSlug(slugToLoad);
      } else {
        setLookupError(`Library "${slugToLoad}" is not registered on LibraryOS. Only registered libraries can sign in.`);
        setLibrary(null);
        setActiveSlug(null);
      }
    } catch {
      setLookupError("Unable to connect to library authentication service.");
      setLibrary(null);
      setActiveSlug(null);
    } finally {
      setLoadingLib(false);
    }
  };

  const handleSelectLibrary = (lib: Library) => {
    setLibrary(lib);
    setActiveSlug(lib.slug);
    setLookupError(null);
    setSearchQuery("");
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = slugInput
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    if (!clean) {
      setLookupError("Please enter your library workspace slug.");
      return;
    }

    setSearchingSlug(true);
    loadLibrary(clean).finally(() => setSearchingSlug(false));
  };

  const handleSwitchWorkspace = () => {
    setActiveSlug(null);
    setLibrary(null);
    setSlugInput("");
    setSearchQuery("");
    setLookupError(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("library_last_slug");
      sessionStorage.removeItem("target_lib_auth");
      sessionStorage.removeItem("target_lib_owner_auth");
      clearStoredSession();
      router.replace("/login");
    }
  };

  const openAuthModal = (modalInfo: AuthModalState) => {
    setPassword("");
    setAuthError(null);
    setActiveModal(modalInfo);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal || !activeSlug) return;
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
          slug: activeSlug,
          role: activeModal.role,
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setStoredSession({
        role: data.user.role,
        libraryId: data.user.libraryId || library?.id || "",
        librarySlug: data.user.slug || activeSlug,
        username: data.user.username,
        fullName: data.user.fullName,
      });

      sessionStorage.setItem("target_lib_auth", "true");
      if (data.user.role === "owner" || data.user.role === "superadmin") {
        sessionStorage.setItem("target_lib_owner_auth", "true");
      } else {
        sessionStorage.removeItem("target_lib_owner_auth");
      }

      setActiveModal(null);
      router.push(activeModal.destination);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoggingIn(false);
    }
  };

  if (loadingLib) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-text-muted">Loading library workspace...</p>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Dedicated Isolated Tenant Login (When Slug is active)
  // ---------------------------------------------------------------------------
  if (activeSlug && library) {
    return (
      <main className="min-h-screen bg-background text-text-main flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-lg space-y-6">
          {/* Back to Libraries & Register Top Bar */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleSwitchWorkspace}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-semibold text-text-muted hover:text-text-main transition cursor-pointer"
            >
              &larr; Choose Different Library
            </button>
            <Link
              href="/signup"
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
            >
              + Register New Library
            </Link>
          </div>

          {/* Header Branding */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-2">
              <LibraryLogo
                slug={activeSlug}
                logoUrl={library.logo_url}
                name={library.name}
                size="xl"
                className="shadow-md"
              />
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
              {library.name}
            </h1>
            <p className="text-xs text-text-muted">
              📍 {library.city || "Dehradun"} &bull; Official Staff &amp; Management Portal
            </p>
          </div>

          {/* 2 Dedicated Role Cards Only (Zero Leaks) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Front Desk Receptionist */}
            <button
              onClick={() =>
                openAuthModal({
                  role: "staff",
                  title: "Front Desk Staff Login",
                  subtitle: `Receptionist Desk for ${library.name}`,
                  icon: "💻",
                  destination: `/l/${activeSlug}`,
                })
              }
              className="text-left bg-card-bg border border-panel-border hover:border-rose-500/40 rounded-3xl p-5 shadow-sm transition-all hover:scale-[1.01] group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl p-2 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  💻
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full">
                  Reception
                </span>
              </div>
              <h3 className="font-extrabold text-sm text-text-main group-hover:text-rose-600 transition">
                Front Desk Portal
              </h3>
              <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                Seat grid, member check-ins, admission soundbox approval, and receipts.
              </p>
            </button>

            {/* Card 2: Library Owner / Admin */}
            <button
              onClick={() =>
                openAuthModal({
                  role: "owner",
                  title: "Library Owner Login",
                  subtitle: `Owner Access for ${library.name}`,
                  icon: "👑",
                  destination: `/l/${activeSlug}`,
                })
              }
              className="text-left bg-card-bg border border-panel-border hover:border-sky-500/40 rounded-3xl p-5 shadow-sm transition-all hover:scale-[1.01] group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl p-2 rounded-2xl bg-sky-500/10 border border-sky-500/20">
                  👑
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full">
                  Owner
                </span>
              </div>
              <h3 className="font-extrabold text-sm text-text-main group-hover:text-sky-600 transition">
                Owner Portal
              </h3>
              <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                Full owner privileges: live desk matrix, financial ledger, expenses, and settings.
              </p>
            </button>
          </div>

          {/* Student & Navigation Links */}
          <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border text-center space-y-2 text-xs">
            <div>
              <span className="text-text-muted">Are you a student member? </span>
              <Link
                href={`/l/${activeSlug}/student`}
                className="font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Open Student Digital Pass &rarr;
              </Link>
            </div>
            <div className="pt-2 border-t border-panel-border/60 flex items-center justify-between text-[11px] text-text-muted flex-wrap gap-2">
              <Link
                href={`/l/${activeSlug}/join`}
                className="hover:text-text-main hover:underline"
              >
                Door Admission QR Form
              </Link>
              <button
                onClick={handleSwitchWorkspace}
                className="hover:text-rose-500 hover:underline cursor-pointer"
              >
                &larr; Switch Library Workspace
              </button>
            </div>
          </div>
        </div>

        {/* Modal Auth Dialog */}
        {activeModal && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center animate-in fade-in duration-150"
            onClick={() => setActiveModal(null)}
          >
            <div
              className="my-auto bg-card-bg border border-panel-border rounded-3xl p-6 w-full max-w-md shadow-2xl relative max-h-[calc(100vh-2rem)] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 text-text-muted hover:text-text-main p-1.5 rounded-xl hover:bg-neutral-500/10 transition cursor-pointer text-sm font-bold"
              >
                &times;
              </button>

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

              {authError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                  <span>&warning;</span> {authError}
                </div>
              )}

              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Enter Passcode
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loggingIn || !password.trim()}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loggingIn ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Verifying...
                    </>
                  ) : (
                    <>Sign In &rarr;</>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Clean Workspace Entry (When user arrives at /login with no slug)
  // ---------------------------------------------------------------------------
  const filteredLibraries = registeredLibraries.filter((lib) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      lib.name.toLowerCase().includes(q) ||
      lib.slug.toLowerCase().includes(q) ||
      (lib.city && lib.city.toLowerCase().includes(q)) ||
      (lib.phone && lib.phone.includes(q))
    );
  });

  return (
    <main className="min-h-screen bg-background text-text-main flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-2xl shadow-inner">
            📚
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
            Sign In to Your Library
          </h1>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Select your registered study hall or reading room to access your private desk &amp; management portal.
          </p>
        </div>

        {/* Global Error Notice if lookup failed */}
        {lookupError && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">⚠️</span>
              <span>{lookupError}</span>
            </div>
            <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] font-normal text-rose-500">
                Want to register this library?
              </span>
              <Link
                href={`/signup?name=${encodeURIComponent(slugInput || searchQuery || "")}`}
                className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] transition shrink-0"
              >
                + Register as New Library &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Prominent "+ Register New Library" Callout Card */}
        <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-rose-500/5 border border-rose-500/25 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xl shrink-0">
              🚀
            </div>
            <div>
              <h3 className="text-xs font-black text-foreground">
                New to LibraryOS?
              </h3>
              <p className="text-[11px] text-text-muted">
                Register your library in 60s &bull; 7-Day Free Trial &bull; 0% UPI soundbox
              </p>
            </div>
          </div>
          <Link
            href="/signup"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-sm transition active:scale-95 text-center shrink-0 whitespace-nowrap"
          >
            + Register New Library &rarr;
          </Link>
        </div>

        {/* Registered Libraries Section */}
        <div className="bg-card-bg border border-panel-border rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold text-text-main flex items-center gap-1.5">
                <span>🏢</span> Registered Libraries
              </h2>
              <p className="text-[11px] text-text-muted">
                Only registered libraries can sign in.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-neutral-500/10 text-text-muted border border-panel-border">
              {registeredLibraries.length} Registered
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xs pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search registered libraries by name, city, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-panel-border rounded-xl pl-9 pr-9 py-2.5 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main text-xs p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Libraries List */}
          {loadingRegistered ? (
            <div className="space-y-2 py-2">
              <div className="h-16 rounded-2xl bg-neutral-500/10 animate-pulse" />
              <div className="h-16 rounded-2xl bg-neutral-500/10 animate-pulse" />
            </div>
          ) : filteredLibraries.length > 0 ? (
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {filteredLibraries.map((lib) => {
                const totalSeats =
                  (lib as any).library_settings?.total_seats ||
                  (lib.slug === "target-library" ? 297 : 50);
                return (
                  <button
                    key={lib.id || lib.slug}
                    onClick={() => handleSelectLibrary(lib)}
                    className="w-full text-left p-3.5 rounded-2xl border border-panel-border hover:border-rose-500/40 bg-background/50 hover:bg-rose-500/5 transition-all group flex items-center justify-between gap-3 cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <LibraryLogo
                        slug={lib.slug}
                        logoUrl={lib.logo_url}
                        name={lib.name}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-xs text-text-main group-hover:text-rose-600 transition truncate">
                            {lib.name}
                          </h4>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-500/10 text-text-muted shrink-0">
                            /l/{lib.slug}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted truncate mt-0.5">
                          📍 {lib.city || "Dehradun"} &bull; {totalSeats} Seats Capacity
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 shrink-0 group-hover:translate-x-0.5 transition-transform">
                      <span>Sign In</span>
                      <span>&rarr;</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Empty Search State: Only registered libraries can sign in */
            <div className="text-center py-6 px-4 rounded-2xl bg-neutral-500/5 border border-dashed border-panel-border space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center text-lg">
                ⚠️
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-text-main">
                  No registered library matching &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-[11px] text-text-muted max-w-xs mx-auto">
                  Only registered libraries can sign in. If your library is new, register it now to get started.
                </p>
              </div>
              <Link
                href={`/signup?name=${encodeURIComponent(searchQuery)}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-sm transition active:scale-95"
              >
                <span>+ Register &ldquo;{searchQuery}&rdquo; (7-Day Trial)</span>
                <span>&rarr;</span>
              </Link>
            </div>
          )}

          {/* Direct Workspace Code Form (Accordion / Input) */}
          <details className="pt-2 border-t border-panel-border/60 group text-xs">
            <summary className="text-[11px] font-bold text-text-muted hover:text-text-main cursor-pointer list-none flex items-center justify-between py-1">
              <span>Enter Workspace Code Manually</span>
              <span className="text-text-muted group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <form onSubmit={handleLookupSubmit} className="space-y-3 pt-3">
              <div className="flex items-center rounded-xl bg-background border border-panel-border overflow-hidden focus-within:ring-2 focus-within:ring-rose-500">
                <span className="px-3 py-2 text-xs font-mono text-text-muted bg-neutral-500/5 border-r border-panel-border select-none">
                  /l/
                </span>
                <input
                  type="text"
                  placeholder="e.g. testing-library-1"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  className="w-full bg-transparent px-3 py-2 text-xs font-mono text-text-main focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={searchingSlug || !slugInput.trim()}
                className="w-full py-2.5 rounded-xl bg-neutral-800 dark:bg-neutral-700 hover:bg-neutral-900 text-white font-bold text-xs transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {searchingSlug ? "Verifying..." : "Verify & Sign In \u2192"}
              </button>
            </form>
          </details>
        </div>

        {/* Discreet Footer for SaaS Founder */}
        <div className="text-center pt-2">
          <Link
            href="/superadmin"
            className="text-[11px] text-text-muted hover:text-text-main transition opacity-60 hover:opacity-100"
          >
            SaaS Platform Administration (Founder) &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function UniversalLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
