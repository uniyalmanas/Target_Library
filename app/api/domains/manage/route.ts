import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  getTenantDomainConfig,
  updateTenantDomainConfig,
  PLATFORM_BASE_DOMAIN,
  CNAME_TARGET,
} from "@/lib/domainRouting";
import { isDemoSlug } from "@/lib/tenant";

// GET /api/domains/manage?slug=target-library
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug") || "target-library";

    // 1. Get local persistent domain config
    const localConfig = getTenantDomainConfig(slug);

    // 2. Try to supplement from Supabase libraries table if columns exist
    try {
      const { data: libData, error } = await supabase
        .from("libraries")
        .select("subdomain, custom_domain, custom_domain_verified")
        .eq("slug", slug)
        .maybeSingle();

      if (!error && libData) {
        if (libData.subdomain) localConfig.subdomain = libData.subdomain;
        if (libData.custom_domain) localConfig.custom_domain = libData.custom_domain;
        if (typeof libData.custom_domain_verified === "boolean") {
          localConfig.custom_domain_verified = libData.custom_domain_verified;
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      config: localConfig,
      platform_base_domain: PLATFORM_BASE_DOMAIN,
      cname_target: CNAME_TARGET,
      instructions: {
        record_type: "CNAME",
        host: localConfig.custom_domain ? localConfig.custom_domain.split(".")[0] : "@",
        value: CNAME_TARGET,
        ttl: "Automatic / 300",
      },
    });
  } catch (error: any) {
    console.error("GET /api/domains/manage error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load domain configuration" },
      { status: 500 }
    );
  }
}

// POST /api/domains/manage
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug = "target-library", subdomain, custom_domain } = body;

    // Validate Subdomain format
    let cleanSubdomain: string | null = null;
    if (subdomain !== undefined) {
      if (subdomain && subdomain.trim()) {
        const clean = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (clean.length < 2 || clean.length > 30) {
          return NextResponse.json(
            { error: "Subdomain must be between 2 and 30 characters (letters and numbers only)." },
            { status: 400 }
          );
        }
        const reserved = ["www", "app", "api", "admin", "superadmin", "mail", "cdn", "assets"];
        if (reserved.includes(clean)) {
          return NextResponse.json(
            { error: `"${clean}" is a reserved platform subdomain.` },
            { status: 400 }
          );
        }
        cleanSubdomain = clean;
      }
    }

    // Validate Custom Domain format
    let cleanCustomDomain: string | null = null;
    if (custom_domain !== undefined) {
      if (custom_domain && custom_domain.trim()) {
        const clean = custom_domain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\/.*$/, "")
          .trim();

        const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,10}$/;
        if (!domainRegex.test(clean)) {
          return NextResponse.json(
            { error: "Please enter a valid domain name (e.g. library.yourdomain.com or mylibrary.in)." },
            { status: 400 }
          );
        }
        cleanCustomDomain = clean;
      }
    }

    // Update Local Storage
    const updated = updateTenantDomainConfig(slug, {
      subdomain: cleanSubdomain !== null ? cleanSubdomain : undefined,
      custom_domain: cleanCustomDomain !== null ? cleanCustomDomain : undefined,
      custom_domain_verified: cleanCustomDomain ? false : false, // reset verification on domain change
    });

    // Try to update Supabase if columns are present
    if (!isDemoSlug(slug)) {
      try {
        await supabase
          .from("libraries")
          .update({
            subdomain: updated.subdomain,
            custom_domain: updated.custom_domain,
            custom_domain_verified: updated.custom_domain_verified,
          })
          .eq("slug", slug);
      } catch {
        // local storage serves as reliable fallback
      }
    }

    return NextResponse.json({
      success: true,
      config: updated,
      message: "Domain configuration saved successfully!",
    });
  } catch (error: any) {
    console.error("POST /api/domains/manage error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update domain configuration" },
      { status: 500 }
    );
  }
}
