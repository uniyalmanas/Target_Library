"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/lib/ThemeToggle";

export default function HeaderNavbar() {
  const pathname = usePathname() || "";
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const authStatus = sessionStorage.getItem("target_lib_auth");
    setIsAuthenticated(authStatus === "true");
  }, [pathname]);

  const isPublicPath =
    pathname === "/login" ||
    pathname.startsWith("/receipts/");

  return (
    <nav className="border-b border-panel-border bg-background/70 backdrop-blur-md sticky top-0 z-50 transition-all duration-200">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
        <Link href="/" className="flex items-center gap-2.5 group">
          <img 
            src="/lib-logo.png" 
            alt="The Target Library Logo" 
            className="w-6 h-6 rounded-md object-contain group-hover:scale-105 transition-transform duration-200" 
          />
          <span className="font-extrabold text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-amber-500 dark:from-rose-500 dark:to-amber-400">
            THE TARGET LIBRARY
          </span>
        </Link>
        
        {/* Only show navigation links if logged in and not on a public path */}
        {!isPublicPath && isAuthenticated && (
          <div className="flex items-center gap-6 text-sm">
            <Link href="/" className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors">Seats</Link>
            <Link href="/new-receipt" className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors">New Receipt</Link>
            <Link href="/dashboard" className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors">Dashboard</Link>
            <Link href="/members" className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors">Members</Link>
            <Link href="/import" className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors">Bulk Import</Link>
            <button
              onClick={() => {
                sessionStorage.removeItem("target_lib_auth");
                window.location.href = "/login";
              }}
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
