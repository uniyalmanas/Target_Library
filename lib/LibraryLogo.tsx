"use client";

import React, { useState } from "react";
import { getEffectiveLogo } from "./tenant";

interface LibraryLogoProps {
  slug?: string | null;
  logoUrl?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  imgClassName?: string;
}

const SIZE_MAP = {
  xs: "w-5 h-5 text-[9px] rounded-md",
  sm: "w-6 h-6 text-[10px] rounded-md",
  md: "w-8 h-8 text-xs rounded-lg",
  lg: "w-10 h-10 text-sm rounded-xl",
  xl: "w-14 h-14 text-xl rounded-2xl",
  "2xl": "w-16 h-16 text-2xl rounded-2xl",
};

/**
 * Extracts 1-2 uppercase letters for the monogram badge
 */
function getInitials(name?: string | null, slug?: string | null): string {
  if (name && name.trim()) {
    const clean = name.trim().replace(/^the\s+/i, "");
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }
  if (slug && slug.trim()) {
    const parts = slug.split("-").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return slug.slice(0, 2).toUpperCase();
  }
  return "LB";
}

/**
 * LibraryLogo Component
 * - For Target Library: defaults to /lib-logo.png
 * - For isolated tenants: renders custom logo if configured, or a sleek, modern monogram badge.
 * - NEVER leaks Target Library logo to isolated tenants.
 */
export default function LibraryLogo({
  slug,
  logoUrl,
  name,
  size = "sm",
  className = "",
  imgClassName = "",
}: LibraryLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const effectiveLogo = getEffectiveLogo(slug, logoUrl);
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.sm;
  const initials = getInitials(name, slug);

  if (effectiveLogo && !imageFailed) {
    return (
      <img
        src={effectiveLogo}
        alt={name || "Library Logo"}
        onError={() => setImageFailed(true)}
        className={`${sizeClass} object-contain shrink-0 ${imgClassName} ${className}`}
      />
    );
  }

  // Sleek Monogram Emblem Badge
  return (
    <div
      title={name || "Library"}
      className={`${sizeClass} shrink-0 bg-gradient-to-br from-rose-500 via-rose-600 to-amber-500 text-white font-black tracking-tight flex items-center justify-center shadow-xs select-none border border-white/20 ${className}`}
    >
      {initials}
    </div>
  );
}
