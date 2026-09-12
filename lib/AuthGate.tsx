"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth";

// Secure Admin Passcode, defaults to Target2026 if not set in .env.local
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "Target2026";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  const isPublicPath =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/receipts/") ||
    pathname === "/l/demo-library" ||
    pathname.startsWith("/l/demo-library/") ||
    pathname.endsWith("/student") ||
    pathname.endsWith("/join") ||
    pathname.endsWith("/terms") ||
    pathname.startsWith("/superadmin");

  useEffect(() => {
    const authStatus = sessionStorage.getItem("target_lib_auth");
    const stored = getStoredSession();

    let pathSlug: string | null = null;
    if (pathname.startsWith("/l/")) {
      const parts = pathname.split("/");
      if (parts[2]) pathSlug = decodeURIComponent(parts[2]);
    }
    const currentSearch = typeof window !== "undefined" ? window.location.search : "";
    const querySlug = new URLSearchParams(currentSearch).get("slug");
    const requiredSlug = pathSlug || querySlug;

    const hasValidAuth = authStatus === "true" || authStatus === ADMIN_PASSWORD;
    const isSuperAdmin = stored?.role === "superadmin";
    const isMatchingTenant = !requiredSlug || isSuperAdmin || stored?.librarySlug === requiredSlug;

    if (hasValidAuth && isMatchingTenant && (isSuperAdmin || stored?.librarySlug)) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
    setChecking(false);
  }, [pathname]);

  useEffect(() => {
    if (!checking) {
      if (!isAuthenticated && !isPublicPath) {
        let pathSlug: string | null = null;
        if (pathname.startsWith("/l/")) {
          const parts = pathname.split("/");
          if (parts[2]) pathSlug = decodeURIComponent(parts[2]);
        }
        const currentSearch = typeof window !== "undefined" ? window.location.search : "";
        const slugFromUrl = new URLSearchParams(currentSearch).get("slug");
        const stored = typeof window !== "undefined" ? getStoredSession() : null;
        const effectiveSlug = pathSlug || slugFromUrl || stored?.librarySlug;
        const target = effectiveSlug ? `/login?slug=${encodeURIComponent(effectiveSlug)}` : "/login";
        router.replace(target);
      }
    }
  }, [checking, isAuthenticated, isPublicPath, pathname, router]);

  // Loading state while checking session validity
  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs text-text-muted">
        Verifying librarian credentials session...
      </div>
    );
  }

  if (!isAuthenticated && !isPublicPath) {
    return null;
  }

  return <>{children}</>;
}
