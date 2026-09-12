"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function TenantFooterContent() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const [libraryName, setLibraryName] = useState<string>("");

  const getUrlSlug = (): string | null => {
    if (pathname.startsWith("/l/")) {
      const parts = pathname.split("/");
      if (parts[2]) return decodeURIComponent(parts[2]);
    }
    return searchParams.get("slug");
  };

  const activeSlug = getUrlSlug() || "target-library";

  useEffect(() => {
    if (activeSlug === "target-library") {
      setLibraryName("The Target Library");
      return;
    }
    let isMounted = true;
    fetch(`/api/libraries/${encodeURIComponent(activeSlug)}/settings`)
      .then((r) => r.json())
      .then((d) => {
        if (!isMounted) return;
        if (d.library?.name) {
          setLibraryName(d.library.name);
        } else {
          setLibraryName(activeSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [activeSlug]);

  // Hide footer on desk page (maximizes seat matrix visibility) and public/auth pages
  if (
    (pathname.startsWith("/l/") && !pathname.includes("/settings")) ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/superadmin") ||
    pathname.endsWith("/join") ||
    pathname.endsWith("/student") ||
    pathname.startsWith("/receipts/")
  ) {
    return null;
  }

  return (
    <footer className="border-t border-panel-border bg-background/50 py-5 mt-auto text-center text-xs text-text-muted print:hidden">
      <div className="w-full max-w-[96vw] 2xl:max-w-[1750px] mx-auto px-6">
        &copy; {new Date().getFullYear()} {libraryName || "Library Workspace"}. Internal Study Space Management System.
      </div>
    </footer>
  );
}

export default function TenantFooter() {
  return (
    <Suspense fallback={null}>
      <TenantFooterContent />
    </Suspense>
  );
}
