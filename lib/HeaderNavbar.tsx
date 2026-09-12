"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import ThemeToggle from "@/lib/ThemeToggle";
import { getStoredSession } from "@/lib/auth";
import LibraryLogo from "@/lib/LibraryLogo";

interface LibraryHeaderInfo {
  name: string;
  logoUrl: string | null;
  totalSeats: number;
}

// In-memory cache across tab switches within the session
const headerCache: Record<string, LibraryHeaderInfo> = {
  "target-library": {
    name: "The Target Library",
    logoUrl: "/lib-logo.png",
    totalSeats: 297,
  },
};

function HeaderNavbarContent() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();

  // Helper to extract active slug from pathname or query param
  const getUrlSlug = useCallback((): string | null => {
    if (pathname.startsWith("/l/")) {
      const parts = pathname.split("/");
      if (parts[2] && parts[2] !== "join" && parts[2] !== "student") {
        return decodeURIComponent(parts[2]);
      }
    }
    const qSlug = searchParams.get("slug");
    if (qSlug) return qSlug;
    return null;
  }, [pathname, searchParams]);

  const urlSlug = getUrlSlug();
  const initialSlug = urlSlug || "target-library";

  const [activeSlug, setActiveSlug] = useState<string>(initialSlug);
  const [libInfo, setLibInfo] = useState<LibraryHeaderInfo>(() => {
    if (headerCache[initialSlug]) return headerCache[initialSlug];
    return {
      name: initialSlug === "target-library" ? "The Target Library" : initialSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      logoUrl: initialSlug === "target-library" ? "/lib-logo.png" : null,
      totalSeats: 297,
    };
  });
  const [isOwner, setIsOwner] = useState(false);

  // Synchronize active slug and owner authentication role
  useEffect(() => {
    const currentSlug = getUrlSlug();
    const session = getStoredSession();
    const effective =
      currentSlug ||
      (session?.librarySlug && session.librarySlug !== "target-library"
        ? session.librarySlug
        : "target-library");

    setActiveSlug(effective);

    const ownerAuth = sessionStorage.getItem("target_lib_owner_auth");
    const hasOwner =
      session?.role === "owner" ||
      session?.role === "superadmin" ||
      ownerAuth === "true";

    setIsOwner(hasOwner);
  }, [pathname, searchParams, getUrlSlug]);

  // Fetch or load cached library settings & branding
  const loadLibraryInfo = useCallback(async (slug: string, force = false) => {
    if (!force && headerCache[slug]) {
      setLibInfo(headerCache[slug]);
      return;
    }

    try {
      const res = await fetch(`/api/libraries/${encodeURIComponent(slug)}/settings`);
      if (res.ok) {
        const data = await res.json();
        const info: LibraryHeaderInfo = {
          name: data.library?.name || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          logoUrl: data.library?.logo_url || null,
          totalSeats: data.settings?.total_seats || 297,
        };
        headerCache[slug] = info;
        setLibInfo(info);
      }
    } catch {
      // Keep existing or fallback state
    }
  }, []);

  useEffect(() => {
    if (activeSlug) {
      loadLibraryInfo(activeSlug);
    }
  }, [activeSlug, loadLibraryInfo]);

  // Listen for real-time library updates (e.g. name or logo saved in settings)
  useEffect(() => {
    const handleSettingsUpdated = () => {
      if (activeSlug) {
        delete headerCache[activeSlug];
        loadLibraryInfo(activeSlug, true);
      }
    };

    window.addEventListener("library-settings-updated", handleSettingsUpdated);
    return () => {
      window.removeEventListener("library-settings-updated", handleSettingsUpdated);
    };
  }, [activeSlug, loadLibraryInfo]);

  // Exclude navbar from public landing, login, registration, and isolated student views
  const isExcluded =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/superadmin") ||
    pathname.endsWith("/join") ||
    pathname.endsWith("/student") ||
    pathname.startsWith("/receipts/");

  if (isExcluded) {
    return null;
  }

  // Determine active route highlighting
  const isDeskActive = pathname === `/l/${activeSlug}` || (pathname === "/" && activeSlug === "target-library");
  const isMembersActive = pathname.startsWith("/members");
  const isCollectionsActive = pathname.startsWith("/collections");
  const isDueFeesActive = pathname.startsWith("/due-fees");
  const isDashboardActive = pathname.startsWith("/dashboard");
  const isSettingsActive = pathname.startsWith(`/l/${activeSlug}/settings`);
  const isNewReceiptActive = pathname.startsWith("/new-receipt");

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-panel-border px-3 sm:px-6 py-2.5 transition-colors print:hidden">
      <div className="w-full max-w-[96vw] 2xl:max-w-[1750px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Brand, Logo & Badges */}
        <div className="flex items-center gap-3">
          <LibraryLogo
            slug={activeSlug}
            logoUrl={libInfo.logoUrl}
            name={libInfo.name}
            size="md"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/l/${activeSlug}`}
              className="text-base sm:text-lg font-black tracking-tight text-text-main hover:opacity-90 transition-opacity"
            >
              {libInfo.name}
            </Link>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              {isOwner ? "👑 Owner Desk" : "💻 Front Desk"}
            </span>
            <span className="text-[10px] font-mono text-text-muted font-bold px-2 py-0.5 rounded-full bg-neutral-500/10">
              {libInfo.totalSeats} Seats
            </span>
          </div>
        </div>

        {/* Right: Unified Navigation Group & Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Main Navigation Pill */}
          <nav className="flex items-center bg-card-bg border border-panel-border rounded-xl p-0.5 shadow-xs overflow-x-auto">
            <Link
              href={`/l/${activeSlug}`}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 whitespace-nowrap ${
                isDeskActive
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold shadow-2xs"
                  : "text-text-muted hover:text-text-main hover:bg-neutral-500/10"
              }`}
            >
              <span>🪑</span> Desk
            </Link>

            <Link
              href={`/members?slug=${encodeURIComponent(activeSlug)}`}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 whitespace-nowrap ${
                isMembersActive
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold shadow-2xs"
                  : "text-text-muted hover:text-text-main hover:bg-neutral-500/10"
              }`}
            >
              <span>👥</span> Members
            </Link>

            <Link
              href={`/collections?slug=${encodeURIComponent(activeSlug)}`}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 whitespace-nowrap ${
                isCollectionsActive
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold shadow-2xs"
                  : "text-text-muted hover:text-text-main hover:bg-neutral-500/10"
              }`}
            >
              <span>💰</span> Daily Fees
            </Link>

            <Link
              href={`/due-fees?slug=${encodeURIComponent(activeSlug)}`}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 whitespace-nowrap ${
                isDueFeesActive
                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 font-extrabold shadow-2xs"
                  : "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              }`}
            >
              <span>🔵</span> Due Fees
            </Link>

            <Link
              href={`/l/${activeSlug}/join`}
              target="_blank"
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition flex items-center gap-1 whitespace-nowrap"
              title="Open Student Entrance QR Code in new tab"
            >
              <span>📱</span> Door QR
            </Link>

            {/* Owner-Only Privileged Links */}
            {isOwner && (
              <>
                <Link
                  href={`/dashboard?slug=${encodeURIComponent(activeSlug)}`}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 whitespace-nowrap ${
                    isDashboardActive
                      ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 font-extrabold shadow-2xs"
                      : "text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                  }`}
                >
                  <span>📊</span> Dashboard
                </Link>

                <Link
                  href={`/l/${activeSlug}/settings`}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 whitespace-nowrap ${
                    isSettingsActive
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold shadow-2xs"
                      : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  }`}
                >
                  <span>👑</span> Settings
                </Link>
              </>
            )}
          </nav>

          {/* Primary CTA: Walk-in Admission */}
          <Link
            href={`/new-receipt?slug=${encodeURIComponent(activeSlug)}`}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold shadow-sm transition active:scale-95 whitespace-nowrap ${
              isNewReceiptActive
                ? "bg-rose-700 text-white ring-2 ring-rose-500 ring-offset-2 ring-offset-background"
                : "bg-rose-600 hover:bg-rose-500 text-white"
            }`}
          >
            + Walk-in Admission
          </Link>

          {/* Switch Portal & Theme Toggle */}
          <div className="flex items-center gap-1">
            <Link
              href={`/login?slug=${encodeURIComponent(activeSlug)}`}
              className="px-2.5 py-1.5 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-text-muted hover:text-text-main text-xs font-bold transition flex items-center gap-1"
              title="Switch Workspace or Portal"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Switch</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

export default function HeaderNavbar() {
  return (
    <Suspense fallback={null}>
      <HeaderNavbarContent />
    </Suspense>
  );
}
