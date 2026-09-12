import { supabase } from "./supabase";
import { Library, LibrarySettings, ShiftConfig } from "./types";

export const DEFAULT_LIBRARY_SLUG = "target-library";
export const DEFAULT_LIBRARY_ID = "00000000-0000-0000-0000-000000000001";

export const DEFAULT_SHIFTS: ShiftConfig[] = [
  {
    id: "full_day",
    name: "Full Day (6 AM - 12 AM)",
    start_time: "06:00",
    end_time: "00:00",
    base_price: 900,
    sheet_price: 1200,
  },
  {
    id: "shift_1",
    name: "Shift 1 (6 AM - 2 PM)",
    start_time: "06:00",
    end_time: "14:00",
    base_price: 600,
    sheet_price: 900,
  },
  {
    id: "shift_2",
    name: "Shift 2 (2 PM - 12 AM)",
    start_time: "14:00",
    end_time: "00:00",
    base_price: 600,
    sheet_price: 900,
  },
  {
    id: "shift_3",
    name: "Shift 3 (4 PM - 12 AM)",
    start_time: "16:00",
    end_time: "00:00",
    base_price: 500,
    sheet_price: 800,
  },
];

export const FALLBACK_TARGET_LIBRARY: Library = {
  id: DEFAULT_LIBRARY_ID,
  slug: DEFAULT_LIBRARY_SLUG,
  name: "The Target Library",
  city: "Dehradun",
  phone: "9876543210",
  address: "Dehradun, Uttarakhand",
  logo_url: "/lib-logo.png",
  upi_id: "targetlibrary@upi",
  upi_name: "The Target Library",
  monthly_fee: 400,
  discount_code: "FOUNDING_CLIENT",
  is_lifetime_fixed: true,
  subscription_status: "active",
  trial_ends_at: null,
  subscription_ends_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const FALLBACK_SETTINGS: LibrarySettings = {
  library_id: DEFAULT_LIBRARY_ID,
  total_seats: 297,
  shifts_config: DEFAULT_SHIFTS,
  has_sheet_enabled: true,
  sheet_price_monthly: 300,
  require_aadhar: true,
  allow_student_self_registration: true,
  updated_at: new Date().toISOString(),
};

/**
 * Fetch a library by slug with safe fallback
 * - If target-library or default: returns FALLBACK_TARGET_LIBRARY
 * - If isolated tenant: returns DB record, or tenant fallback with logo_url: null (never /lib-logo.png)
 */
export async function getLibraryBySlug(slug: string = DEFAULT_LIBRARY_SLUG): Promise<Library> {
  try {
    const { data, error } = await supabase
      .from("libraries")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error || !data) {
      if (slug === DEFAULT_LIBRARY_SLUG) {
        return FALLBACK_TARGET_LIBRARY;
      }
      return {
        ...FALLBACK_TARGET_LIBRARY,
        id: `tenant-${slug}`,
        slug,
        name: slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        logo_url: null,
      };
    }

    return data as Library;
  } catch {
    if (slug === DEFAULT_LIBRARY_SLUG) {
      return FALLBACK_TARGET_LIBRARY;
    }
    return {
      ...FALLBACK_TARGET_LIBRARY,
      id: `tenant-${slug}`,
      slug,
      name: slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      logo_url: null,
    };
  }
}

/**
 * Resolves the effective logo URL for a library.
 * - For Target Library: defaults to "/lib-logo.png" if not explicitly changed.
 * - For any new/isolated library: returns custom logo_url, or null (NEVER "/lib-logo.png").
 */
export function getEffectiveLogo(slug?: string | null, logoUrl?: string | null): string | null {
  if (logoUrl && logoUrl.trim().length > 0) {
    return logoUrl;
  }
  if (slug === DEFAULT_LIBRARY_SLUG) {
    return "/lib-logo.png";
  }
  return null;
}

/**
 * Fetch library settings by libraryId with safe fallback
 */
export async function getLibrarySettings(libraryId: string = DEFAULT_LIBRARY_ID): Promise<LibrarySettings> {
  try {
    const { data, error } = await supabase
      .from("library_settings")
      .select("*")
      .eq("library_id", libraryId)
      .single();

    if (error || !data) {
      return FALLBACK_SETTINGS;
    }

    return data as LibrarySettings;
  } catch {
    return FALLBACK_SETTINGS;
  }
}
