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

export const DEMO_LIBRARY_SLUG = "demo-library";
export const DEMO_LIBRARY_ID = "00000000-0000-0000-0000-000000000000";

export function isDemoSlug(slug?: string | null): boolean {
  if (!slug) return false;
  const s = slug.toLowerCase().trim();
  return s === "demo-library" || s === "demo";
}

export const DEMO_LIBRARY: Library = {
  id: DEMO_LIBRARY_ID,
  slug: DEMO_LIBRARY_SLUG,
  name: "LibraryOS Demo Lounge",
  city: "Innovation Hub",
  phone: "+91 98765 00000",
  address: "Demo Campus, Cyber City",
  logo_url: null, // Monogram DL emblem - NEVER /lib-logo.png
  upi_id: "demo@upi",
  upi_name: "LibraryOS Demo Hub",
  monthly_fee: 600,
  discount_code: "DEMO_PREVIEW",
  is_lifetime_fixed: false,
  subscription_status: "active",
  trial_ends_at: null,
  subscription_ends_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEMO_SETTINGS: LibrarySettings = {
  library_id: DEMO_LIBRARY_ID,
  total_seats: 200,
  shifts_config: DEFAULT_SHIFTS,
  has_sheet_enabled: true,
  sheet_price_monthly: 300,
  price_protection_enabled: true,
  require_aadhar: false,
  allow_student_self_registration: true,
  updated_at: new Date().toISOString(),
};

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
  price_protection_enabled: true,
  require_aadhar: true,
  allow_student_self_registration: true,
  updated_at: new Date().toISOString(),
};

/**
 * Fetch a library by slug with safe fallback
 * - If demo-library or demo: returns DEMO_LIBRARY (isolated synthetic account)
 * - If target-library or default: returns FALLBACK_TARGET_LIBRARY
 * - If isolated tenant: returns DB record, or tenant fallback with logo_url: null (never /lib-logo.png)
 */
export async function getLibraryBySlug(slug: string = DEFAULT_LIBRARY_SLUG): Promise<Library> {
  if (isDemoSlug(slug)) {
    return DEMO_LIBRARY;
  }

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
        id: `tenant-${slug}`,
        slug,
        name: slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        city: "City",
        phone: "",
        address: "",
        logo_url: null,
        upi_id: "",
        upi_name: "",
        monthly_fee: 600,
        discount_code: null,
        is_lifetime_fixed: false,
        subscription_status: "trial",
        trial_ends_at: null,
        subscription_ends_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data as Library;
  } catch {
    if (slug === DEFAULT_LIBRARY_SLUG) {
      return FALLBACK_TARGET_LIBRARY;
    }
    return {
      id: `tenant-${slug}`,
      slug,
      name: slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      city: "City",
      phone: "",
      address: "",
      logo_url: null,
      upi_id: "",
      upi_name: "",
      monthly_fee: 600,
      discount_code: null,
      is_lifetime_fixed: false,
      subscription_status: "trial",
      trial_ends_at: null,
      subscription_ends_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Resolves the effective logo URL for a library.
 * - For Demo library: returns null (renders sleek monogram badge, never /lib-logo.png).
 * - For Target Library: defaults to "/lib-logo.png" if not explicitly changed.
 * - For any new/isolated library: returns custom logo_url, or null (NEVER "/lib-logo.png").
 */
export function getEffectiveLogo(slug?: string | null, logoUrl?: string | null): string | null {
  if (isDemoSlug(slug)) {
    return null;
  }
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
  if (libraryId === DEMO_LIBRARY_ID) {
    return DEMO_SETTINGS;
  }

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

export interface LibraryAccessInfo {
  isBlocked: boolean;
  status: "active" | "trial" | "trial_expired" | "past_due" | "suspended";
  isTrial: boolean;
  trialDaysRemaining: number;
  subscriptionDaysRemaining: number | null;
  message: string;
}

/**
 * Calculates access status for a library instance:
 * - Target Library: Lifetime fixed active client (never blocked)
 * - Demo Lounge: Always active sandbox (never blocked)
 * - 7-Day Trial: Free access for 7 days. If unpaid after 7 days, access is BLOCKED (data preserved).
 * - Active Paid: Access valid until subscription_ends_at. If unpaid, access is BLOCKED.
 * - Suspended/Blocked: Access is BLOCKED.
 */
export function getLibraryAccessStatus(library?: Library | null): LibraryAccessInfo {
  if (!library) {
    return {
      isBlocked: false,
      status: "active",
      isTrial: false,
      trialDaysRemaining: 0,
      subscriptionDaysRemaining: null,
      message: "Active",
    };
  }

  // Demo Lounge is always accessible in sandbox mode
  if (isDemoSlug(library.slug)) {
    return {
      isBlocked: false,
      status: "active",
      isTrial: false,
      trialDaysRemaining: 0,
      subscriptionDaysRemaining: null,
      message: "Demo Sandbox Active",
    };
  }

  // Target Library has lifetime fixed active access
  if (library.is_lifetime_fixed || library.slug === DEFAULT_LIBRARY_SLUG) {
    return {
      isBlocked: false,
      status: "active",
      isTrial: false,
      trialDaysRemaining: 0,
      subscriptionDaysRemaining: null,
      message: "Lifetime Founding Client Active",
    };
  }

  const now = Date.now();

  // Explicit suspension / manual block
  if (library.subscription_status === "suspended") {
    return {
      isBlocked: true,
      status: "suspended",
      isTrial: false,
      trialDaysRemaining: 0,
      subscriptionDaysRemaining: 0,
      message: "Library access has been suspended by administration.",
    };
  }

  // Check 7-day trial
  if (
    library.subscription_status === "trial" ||
    (!library.subscription_ends_at && library.trial_ends_at)
  ) {
    const trialEnd = library.trial_ends_at
      ? new Date(library.trial_ends_at).getTime()
      : now + 7 * 24 * 60 * 60 * 1000;
    const diffMs = trialEnd - now;
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs <= 0) {
      // 7-day trial ended and fee not paid -> ACCESS IS BLOCKED (data preserved)
      return {
        isBlocked: true,
        status: "trial_expired",
        isTrial: true,
        trialDaysRemaining: 0,
        subscriptionDaysRemaining: 0,
        message: "Your 7-day free trial has ended. Please complete subscription payment to unlock access.",
      };
    }

    // Trial is currently active
    return {
      isBlocked: false,
      status: "trial",
      isTrial: true,
      trialDaysRemaining: daysLeft,
      subscriptionDaysRemaining: null,
      message: `7-Day Free Trial: ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining.`,
    };
  }

  // Paid active subscription
  if (library.subscription_status === "active") {
    if (library.subscription_ends_at) {
      const subEnd = new Date(library.subscription_ends_at).getTime();
      const diffMs = subEnd - now;
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs <= 0) {
        // Subscription past due -> ACCESS IS BLOCKED (data preserved)
        return {
          isBlocked: true,
          status: "past_due",
          isTrial: false,
          trialDaysRemaining: 0,
          subscriptionDaysRemaining: 0,
          message: "Your monthly subscription has expired. Please renew to continue access.",
        };
      }

      return {
        isBlocked: false,
        status: "active",
        isTrial: false,
        trialDaysRemaining: 0,
        subscriptionDaysRemaining: daysLeft,
        message: `Active subscription: renews in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
      };
    }

    return {
      isBlocked: false,
      status: "active",
      isTrial: false,
      trialDaysRemaining: 0,
      subscriptionDaysRemaining: null,
      message: "Active subscription.",
    };
  }

  // Fallback
  return {
    isBlocked: true,
    status: "past_due",
    isTrial: false,
    trialDaysRemaining: 0,
    subscriptionDaysRemaining: 0,
    message: "Subscription fee payment required to access this workspace.",
  };
}
