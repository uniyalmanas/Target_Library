"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Secure Admin Passcode, defaults to Target2026 if not set in .env.local
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "Target2026";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  const isPublicPath =
    pathname === "/login" ||
    pathname.startsWith("/receipts/");

  useEffect(() => {
    const authStatus = sessionStorage.getItem("target_lib_auth");
    if (authStatus === "true" || authStatus === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
    setChecking(false);
  }, [pathname]);

  useEffect(() => {
    if (!checking) {
      if (!isAuthenticated && !isPublicPath) {
        router.replace("/login");
      } else if (isAuthenticated && pathname === "/login") {
        router.replace("/");
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
