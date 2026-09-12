"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setStoredSession, getStoredSession } from "@/lib/auth";
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

  // Workspace Lookup Form State (when no slug is active)
  const [slugInput, setSlugInput] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searchingSlug, setSearchingSlug] = useState(false);

  // Modal Auth State
  const [activeModal, setActiveModal] = useState<AuthModalState | null>(null);
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Resolve active library slug
  useEffect(() => {
    let resolvedSlug = querySlug;

    if (!resolvedSlug && typeof window !== "undefined") {
      const stored = getStoredSession();
      if (stored?.librarySlug) {
        resolvedSlug = stored.librarySlug;
      } else {
        const lastVisited = localStorage.getItem("library_last_slug");
        if (lastVisited) resolvedSlug = lastVisited;
      }
    }

    if (resolvedSlug) {
      loadLibrary(resolvedSlug);
    } else {
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
        if (typeof window !== "undefined") {
          localStorage.setItem("library_last_slug", slugToLoad);
        }
      } else {
        setLookupError(data.error || "Library workspace not found.");
        setLibrary(null);
        setActiveSlug(null);
      }
    } catch {
      setLookupError("Unable to connect to library service.");
      setLibrary(null);
      setActiveSlug(null);
    } finally {
      setLoadingLib(false);
    }
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
    setLookupError(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("library_last_slug");
      sessionStorage.removeItem("target_lib_owner_auth");
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
  return (
    <main className="min-h-screen bg-background text-text-main flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-2xl shadow-inner">
            📚
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Sign in to Your Library
          </h1>
          <p className="text-xs text-text-muted">
            Enter your library&apos;s workspace name to access your private desk portal.
          </p>
        </div>

        {/* Workspace Code Form */}
        <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm space-y-4">
          {lookupError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <span>&warning;</span> {lookupError}
            </div>
          )}

          <form onSubmit={handleLookupSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                Library Workspace Slug
              </label>
              <div className="flex items-center rounded-xl bg-background border border-panel-border overflow-hidden focus-within:ring-2 focus-within:ring-rose-500">
                <span className="px-3 py-2 text-xs font-mono text-text-muted bg-neutral-500/5 border-r border-panel-border select-none">
                  /l/
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. testing-library-1"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  className="w-full bg-transparent px-3.5 py-2.5 text-xs font-mono text-text-main focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                The unique identifier assigned when your library registered.
              </p>
            </div>

            <button
              type="submit"
              disabled={searchingSlug || !slugInput.trim()}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {searchingSlug ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Finding Workspace...
                </>
              ) : (
                <>Access Library Portal &rarr;</>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-panel-border text-center text-xs text-text-muted">
            New to LibraryOS?{" "}
            <Link href="/signup" className="font-bold text-rose-600 dark:text-rose-400 hover:underline">
              Start 7-Day Free Trial
            </Link>
          </div>
        </div>

        {/* Discreet Footer for SaaS Founder */}
        <div className="text-center pt-4">
          <Link
            href="/superadmin"
            className="text-[11px] text-text-muted hover:text-text-main transition opacity-60 hover:opacity-100"
          >
            SaaS Platform Administration &rarr;
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
