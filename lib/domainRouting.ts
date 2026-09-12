import fs from "fs";
import path from "path";

export interface TenantDomainRecord {
  slug: string;
  name: string;
  subdomain: string | null;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  cname_target: string;
  updated_at: string;
}

const STORAGE_FILE = path.join(process.cwd(), "lib", "localDomainStorage.json");
export const PLATFORM_BASE_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "libraryos.in";
export const CNAME_TARGET = process.env.NEXT_PUBLIC_CNAME_TARGET || "cname.vercel-dns.com";

const INITIAL_DOMAIN_RECORDS: TenantDomainRecord[] = [
  {
    slug: "target-library",
    name: "The Target Library",
    subdomain: "target",
    custom_domain: "thetargetlibrary.in",
    custom_domain_verified: true,
    cname_target: CNAME_TARGET,
    updated_at: new Date().toISOString(),
  },
  {
    slug: "demo-library",
    name: "LibraryOS Demo Lounge",
    subdomain: "demo",
    custom_domain: null,
    custom_domain_verified: false,
    cname_target: CNAME_TARGET,
    updated_at: new Date().toISOString(),
  },
  {
    slug: "testing-library-1",
    name: "Testing Library 1",
    subdomain: "testing",
    custom_domain: null,
    custom_domain_verified: false,
    cname_target: CNAME_TARGET,
    updated_at: new Date().toISOString(),
  },
];

function readStorage(): TenantDomainRecord[] {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(INITIAL_DOMAIN_RECORDS, null, 2), "utf8");
      return INITIAL_DOMAIN_RECORDS;
    }
    const data = fs.readFileSync(STORAGE_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read local domain storage:", err);
    return INITIAL_DOMAIN_RECORDS;
  }
}

function writeStorage(items: TenantDomainRecord[]): boolean {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(items, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Failed to write local domain storage:", err);
    return false;
  }
}

export function getAllTenantDomains(): TenantDomainRecord[] {
  return readStorage();
}

export function getTenantDomainConfig(slug: string): TenantDomainRecord {
  const all = readStorage();
  const found = all.find((d) => d.slug === slug);
  if (found) return found;

  // Generate fallback entry if new slug
  const cleanSub = slug.replace(/-library$/, "").replace(/[^a-z0-9]/g, "").slice(0, 16);
  return {
    slug,
    name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    subdomain: cleanSub || null,
    custom_domain: null,
    custom_domain_verified: false,
    cname_target: CNAME_TARGET,
    updated_at: new Date().toISOString(),
  };
}

export function updateTenantDomainConfig(
  slug: string,
  config: Partial<Pick<TenantDomainRecord, "subdomain" | "custom_domain" | "custom_domain_verified" | "name">>
): TenantDomainRecord {
  const all = readStorage();
  let existingIndex = all.findIndex((d) => d.slug === slug);

  if (existingIndex >= 0) {
    all[existingIndex] = {
      ...all[existingIndex],
      ...config,
      updated_at: new Date().toISOString(),
    };
  } else {
    all.push({
      slug,
      name: config.name || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      subdomain: config.subdomain || null,
      custom_domain: config.custom_domain || null,
      custom_domain_verified: config.custom_domain_verified || false,
      cname_target: CNAME_TARGET,
      updated_at: new Date().toISOString(),
    });
    existingIndex = all.length - 1;
  }

  writeStorage(all);
  return all[existingIndex];
}

/**
 * Resolves an incoming Host header (subdomain or custom apex domain) to a tenant slug.
 * Examples:
 * - "target.libraryos.in" -> "target-library"
 * - "target.localhost:3000" -> "target-library"
 * - "thetargetlibrary.in" -> "target-library"
 * - "demo.libraryos.in" -> "demo-library"
 */
export function resolveSlugFromHost(hostHeader: string): string | null {
  if (!hostHeader) return null;

  // Remove port if present (e.g. localhost:3000 -> localhost)
  const host = hostHeader.toLowerCase().split(":")[0].trim();
  const all = readStorage();

  // 1. Check direct custom domain match
  const customMatch = all.find(
    (d) => d.custom_domain && d.custom_domain.toLowerCase() === host
  );
  if (customMatch) {
    return customMatch.slug;
  }

  // 2. Check subdomain matches
  // Matches: <subdomain>.libraryos.in, <subdomain>.targetlibrary.in, <subdomain>.localhost
  const parts = host.split(".");
  if (parts.length >= 2) {
    const candidateSubdomain = parts[0];

    // Exclude system reserved subdomains
    const reserved = ["www", "app", "api", "admin", "superadmin", "mail", "cdn"];
    if (!reserved.includes(candidateSubdomain)) {
      const subMatch = all.find(
        (d) => d.subdomain && d.subdomain.toLowerCase() === candidateSubdomain
      );
      if (subMatch) {
        return subMatch.slug;
      }

      // Check if candidate matches a tenant slug directly (e.g. demo-library.localhost)
      const slugMatch = all.find((d) => d.slug.toLowerCase() === candidateSubdomain);
      if (slugMatch) {
        return slugMatch.slug;
      }
    }
  }

  return null;
}
