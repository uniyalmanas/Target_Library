"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth";

// Secure Admin Passcode, defaults to Target2026 if not set in .env.local
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "Target2026";

function isPathPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/receipts/") ||
    pathname === "/l/demo-library" ||
    pathname.startsWith("/l/demo-library/") ||
    pathname.endsWith("/student") ||
    pathname.endsWith("/join") ||
    pathname.endsWith("/terms") ||
    pathname.startsWith("/superadmin")
  );
}

function checkClientAuth(pathname: string): boolean {
  if (isPathPublic(pathname)) return true;
  if (typeof window === "undefined") return false;

  const authStatus =
    sessionStorage.getItem("target_lib_auth") ||
    localStorage.getItem("target_lib_auth");
  const stored = getStoredSession();

  let pathSlug: string | null = null;
  if (pathname.startsWith("/l/")) {
    const parts = pathname.split("/");
    if (parts[2]) pathSlug = decodeURIComponent(parts[2]).toLowerCase();
  }
  const currentSearch = typeof window !== "undefined" ? window.location.search : "";
  const querySlug = new URLSearchParams(currentSearch).get("slug")?.toLowerCase();
  const requiredSlug = pathSlug || querySlug;

  const hasValidAuth =
    authStatus === "true" ||
    authStatus === ADMIN_PASSWORD ||
    sessionStorage.getItem("target_lib_owner_auth") === "true" ||
    localStorage.getItem("target_lib_owner_auth") === "true";

  if (!hasValidAuth) return false;

  const isSuperAdmin = stored?.role === "superadmin" || stored?.isMaster;
  if (isSuperAdmin) return true;

  const storedSlug = (stored?.librarySlug || localStorage.getItem("library_last_slug") || "").toLowerCase();

  // If there's no specific slug required by this URL, or no stored slug yet, or slugs match
  if (!requiredSlug || !storedSlug || storedSlug === requiredSlug) {
    return true;
  }

  return false;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();

  // Initialize state synchronously based on current storage & path to prevent race conditions
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => checkClientAuth(pathname));
  const [checking, setChecking] = useState<boolean>(() => !checkClientAuth(pathname));

  const verifyAndRedirect = useCallback(() => {
    if (isPathPublic(pathname)) {
      setIsAuthenticated(true);
      setChecking(false);
      return;
    }

    const valid = checkClientAuth(pathname);
    if (valid) {
      setIsAuthenticated(true);
      setChecking(false);
    } else {
      setIsAuthenticated(false);
      setChecking(false);

      // Compute redirect destination
      let pathSlug: string | null = null;
      if (pathname.startsWith("/l/")) {
        const parts = pathname.split("/");
        if (parts[2]) pathSlug = decodeURIComponent(parts[2]);
      }
      const currentSearch = typeof window !== "undefined" ? window.location.search : "";
      const slugFromUrl = new URLSearchParams(currentSearch).get("slug");
      const stored = typeof window !== "undefined" ? getStoredSession() : null;
      const storedSlug = typeof window !== "undefined" ? localStorage.getItem("library_last_slug") : null;
      const effectiveSlug = pathSlug || slugFromUrl || stored?.librarySlug || storedSlug;
      const target = effectiveSlug ? `/login?slug=${encodeURIComponent(effectiveSlug)}` : "/login";

      router.replace(target);
    }
  }, [pathname, router]);

  useEffect(() => {
    verifyAndRedirect();
  }, [verifyAndRedirect]);

  // Listen to cross-component auth updates
  useEffect(() => {
    const handleAuthEvent = () => {
      const valid = checkClientAuth(pathname);
      if (valid) {
        setIsAuthenticated(true);
        setChecking(false);
      }
    };

    window.addEventListener("auth-changed", handleAuthEvent);
    window.addEventListener("storage", handleAuthEvent);
    return () => {
      window.removeEventListener("auth-changed", handleAuthEvent);
      window.removeEventListener("storage", handleAuthEvent);
    };
  }, [pathname]);

  // Loading state while checking session validity
  if (checking && !isPathPublic(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs text-text-muted">
        Verifying librarian credentials session...
      </div>
    );
  }

  if (!isAuthenticated && !isPathPublic(pathname)) {
    return null;
  }

  return <>{children}</>;
}
