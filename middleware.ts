import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, icons, etc)
     * - api routes (direct access)
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

// Known platform domain hosts
const PLATFORM_DOMAINS = ["localhost", "127.0.0.1", "libraryos.in", "targetlibrary.in", "vercel.app"];

// Quick static mappings for edge performance
const KNOWN_SUBDOMAINS: Record<string, string> = {
  target: "target-library",
  demo: "demo-library",
  testing: "testing-library-1",
};

const KNOWN_CUSTOM_DOMAINS: Record<string, string> = {
  "thetargetlibrary.in": "target-library",
  "thetargetlibrary.com": "target-library",
  "demo.thetargetlibrary.in": "demo-library",
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0].trim();

  // If path already explicitly starts with /l/[slug] or /superadmin, pass through
  if (pathname.startsWith("/l/") || pathname.startsWith("/superadmin")) {
    return NextResponse.next();
  }

  let matchedSlug: string | null = null;

  // 1. Check custom apex/branded domain match
  if (KNOWN_CUSTOM_DOMAINS[host]) {
    matchedSlug = KNOWN_CUSTOM_DOMAINS[host];
  }

  // 2. Check subdomain match (e.g. target.libraryos.in, target.localhost)
  if (!matchedSlug) {
    const parts = host.split(".");
    if (parts.length >= 2) {
      const candidateSub = parts[0];
      const reserved = ["www", "app", "api", "admin", "superadmin", "mail", "cdn", "assets"];
      if (!reserved.includes(candidateSub)) {
        if (KNOWN_SUBDOMAINS[candidateSub]) {
          matchedSlug = KNOWN_SUBDOMAINS[candidateSub];
        } else if (candidateSub.endsWith("-library")) {
          matchedSlug = candidateSub;
        }
      }
    }
  }

  // 3. If a tenant domain was matched, rewrite internally
  if (matchedSlug) {
    // If root path "/", rewrite to desk of that tenant
    if (pathname === "/") {
      return NextResponse.rewrite(new URL(`/l/${matchedSlug}`, req.url));
    }

    // If sub-features (e.g. /join, /print, /student, /settings)
    const tenantSubRoutes = ["/join", "/print", "/student", "/settings"];
    if (tenantSubRoutes.some((r) => pathname.startsWith(r))) {
      return NextResponse.rewrite(new URL(`/l/${matchedSlug}${pathname}`, req.url));
    }

    // For multi-tenant global pages (/members, /collections, /due-fees, /expenses)
    const globalPages = ["/members", "/collections", "/due-fees", "/expenses", "/new-receipt", "/dashboard"];
    if (globalPages.some((p) => pathname.startsWith(p))) {
      const newUrl = new URL(pathname, req.url);
      if (!newUrl.searchParams.has("slug")) {
        newUrl.searchParams.set("slug", matchedSlug);
      }
      return NextResponse.rewrite(newUrl);
    }
  }

  return NextResponse.next();
}
