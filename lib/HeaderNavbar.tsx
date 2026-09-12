"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import ThemeToggle from "@/lib/ThemeToggle";
import { getStoredSession, clearStoredSession } from "@/lib/auth";

function HeaderNavbarContent() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [libraryName, setLibraryName] = useState<string>("");

  // Detect active library tenant from URL query param or stored session
  const slugFromParam = searchParams.get("slug");
  const storedSession = typeof window !== "undefined" ? getStoredSession() : null;
  const activeSlug =
    slugFromParam ||
    (storedSession?.librarySlug && storedSession.librarySlug !== "target-library"
      ? storedSession.librarySlug
      : null);

  useEffect(() => {
    const authStatus = sessionStorage.getItem("target_lib_auth");
    const ownerAuth = sessionStorage.getItem("target_lib_owner_auth");
    const session = getStoredSession();
    const authed =
      authStatus === "true" ||
      ownerAuth === "true" ||
      session.role === "owner" ||
      session.role === "staff" ||
      session.role === "superadmin" ||
      !!activeSlug;

    setIsAuthenticated(authed);
  }, [pathname, activeSlug]);

  // Dynamically load active library name if on tenant workspace
  useEffect(() => {
    if (!activeSlug || activeSlug === "target-library") {
      setLibraryName("THE TARGET LIBRARY");
      return;
    }

    let isMounted = true;
    fetch(`/api/libraries/${encodeURIComponent(activeSlug)}/settings`)
      .then((r) => r.json())
      .then((d) => {
        if (isMounted && d.library?.name) {
          setLibraryName(d.library.name.toUpperCase());
        } else if (isMounted) {
          setLibraryName(activeSlug.replace(/-/g, " ").toUpperCase());
        }
      })
      .catch(() => {
        if (isMounted) {
          setLibraryName(activeSlug.replace(/-/g, " ").toUpperCase());
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeSlug]);

  if (
    pathname === "/" ||
    pathname === "/signup" ||
    pathname.startsWith("/l/") ||
    pathname.startsWith("/superadmin")
  ) {
    return null;
  }

  const isPublicPath =
    pathname === "/login" || pathname.startsWith("/receipts/");

  // URL Generators preserving tenant isolation
  const homeHref = activeSlug ? `/l/${activeSlug}` : "/";
  const seatsHref = activeSlug ? `/l/${activeSlug}` : "/";
  const newReceiptHref = activeSlug ? `/new-receipt?slug=${activeSlug}` : "/new-receipt";
  const dueFeesHref = activeSlug ? `/due-fees?slug=${activeSlug}` : "/due-fees";
  const collectionsHref = activeSlug ? `/collections?slug=${activeSlug}` : "/collections";
  const dashboardHref = activeSlug ? `/dashboard?slug=${activeSlug}` : "/dashboard";
  const membersHref = activeSlug ? `/members?slug=${activeSlug}` : "/members";
  const importHref = activeSlug ? `/import?slug=${activeSlug}` : "/import";
  const settingsHref = activeSlug ? `/l/${activeSlug}/settings` : null;

  const handleLogout = () => {
    sessionStorage.removeItem("target_lib_auth");
    sessionStorage.removeItem("target_lib_owner_auth");
    clearStoredSession();
    window.location.href = "/login";
  };

  return (
    <nav className="border-b border-panel-border bg-background/70 backdrop-blur-md sticky top-0 z-50 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={homeHref} className="flex items-center gap-2.5 group">
            <img
              src="/lib-logo.png"
              alt="Library Logo"
              className="w-6 h-6 rounded-md object-contain group-hover:scale-105 transition-transform duration-200"
            />
            <span className="font-extrabold text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-amber-500 dark:from-rose-500 dark:to-amber-400">
              {libraryName || "THE TARGET LIBRARY"}
            </span>
          </Link>
          {activeSlug && activeSlug !== "target-library" && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              Active Workspace
            </span>
          )}
        </div>

        {/* Only show navigation links if logged in and not on a public path */}
        {!isPublicPath && isAuthenticated && (
          <div className="flex items-center gap-4 sm:gap-6 text-sm flex-wrap">
            <Link
              href={seatsHref}
              className={`${
                pathname === "/" || pathname.startsWith("/l/")
                  ? "text-rose-600 dark:text-rose-400 font-bold"
                  : "text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium"
              } transition-colors`}
            >
              Seats
            </Link>
            <Link
              href={newReceiptHref}
              className={`${
                pathname === "/new-receipt"
                  ? "text-rose-600 dark:text-rose-400 font-bold"
                  : "text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium"
              } transition-colors`}
            >
              New Receipt
            </Link>
            <Link
              href={dueFeesHref}
              className={`${
                pathname === "/due-fees"
                  ? "text-blue-600 dark:text-blue-400 font-bold"
                  : "text-text-muted hover:text-blue-500 dark:hover:text-blue-400 font-medium"
              } transition-colors flex items-center gap-1.5`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block animate-pulse" />
              Due Fees
            </Link>
            <Link
              href={collectionsHref}
              className={`${
                pathname === "/collections"
                  ? "text-rose-600 dark:text-rose-400 font-bold"
                  : "text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium"
              } transition-colors`}
            >
              Daily Fees
            </Link>
            <Link
              href={dashboardHref}
              className={`${
                pathname === "/dashboard"
                  ? "text-rose-600 dark:text-rose-400 font-bold"
                  : "text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium"
              } transition-colors`}
            >
              Dashboard
            </Link>
            <Link
              href={membersHref}
              className={`${
                pathname.startsWith("/members")
                  ? "text-rose-600 dark:text-rose-400 font-bold"
                  : "text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium"
              } transition-colors`}
            >
              Members
            </Link>
            {settingsHref && (
              <Link
                href={settingsHref}
                className="text-text-muted hover:text-sky-500 dark:hover:text-sky-400 font-medium transition-colors"
                title="Library Owner Settings"
              >
                👑 Settings
              </Link>
            )}
            <Link
              href={importHref}
              className={`${
                pathname === "/import"
                  ? "text-rose-600 dark:text-rose-400 font-bold"
                  : "text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium"
              } transition-colors`}
            >
              Bulk Import
            </Link>
            <button
              onClick={handleLogout}
              className="text-rose-600 dark:text-rose-400 hover:underline text-xs font-semibold cursor-pointer"
            >
              Logout
            </button>
            <ThemeToggle />
          </div>
        )}

        {/* If public path, only show ThemeToggle */}
        {isPublicPath && (
          <div className="flex items-center gap-6">
            <ThemeToggle />
          </div>
        )}
      </div>
    </nav>
  );
}

export default function HeaderNavbar() {
  return (
    <Suspense fallback={null}>
      <HeaderNavbarContent />
    </Suspense>
  );
}
