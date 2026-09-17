/**
 * Centralized Authentication & Role Management
 * Currently in Demo/Dev Mode (zero-password friction).
 * Structured cleanly so real bcrypt passwords / Supabase Auth
 * can be plugged in later with zero UI refactoring.
 */

export type UserRole = "superadmin" | "owner" | "staff" | "student";

export interface AuthSession {
  role: UserRole;
  libraryId?: string;
  librarySlug?: string;
  username?: string;
  fullName?: string;
  isMaster?: boolean;
}

const STORAGE_KEY = "library_ms_auth_session";
export const SUPERADMIN_MASTER_KEY = "libraryos_superadmin_master";
export const SUPERADMIN_SESSION_KEY = "libraryos_superadmin_auth";
export const OWNER_AUTH_KEY = "target_lib_owner_auth";
export const ADMIN_OVERRIDE_KEY = "target_lib_admin_override";

export const DEFAULT_SESSION: AuthSession = {
  role: "staff",
  libraryId: "",
  librarySlug: "",
  username: "",
  fullName: "",
};

export function getStoredSession(): AuthSession {
  if (typeof window === "undefined") return DEFAULT_SESSION;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SESSION;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SESSION;
  }
}

export function setStoredSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error("Failed to persist auth session", e);
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SUPERADMIN_MASTER_KEY);
  sessionStorage.removeItem(SUPERADMIN_SESSION_KEY);
  localStorage.removeItem(ADMIN_OVERRIDE_KEY);
  sessionStorage.removeItem(ADMIN_OVERRIDE_KEY);
  localStorage.removeItem(OWNER_AUTH_KEY);
  sessionStorage.removeItem(OWNER_AUTH_KEY);
  localStorage.removeItem("target_lib_auth");
  sessionStorage.removeItem("target_lib_auth");
  try {
    window.dispatchEvent(new Event("auth-changed"));
  } catch {
    // ignore
  }
}

/**
 * Returns true if the current browser session has SaaS SuperAdmin (Platform Founder) authority.
 * Checks across localStorage, sessionStorage, and active session role.
 */
export function isSuperAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const session = getStoredSession();
    // If active session is explicitly staff, strictly ignore any leftover founder master tokens
    if (session?.role === "staff" && !session?.isMaster) {
      return false;
    }
    if (localStorage.getItem(SUPERADMIN_MASTER_KEY) === "true") return true;
    if (sessionStorage.getItem(SUPERADMIN_SESSION_KEY) === "true") return true;
    if (session?.role === "superadmin" || session?.isMaster === true) return true;
  } catch {
    // ignore
  }
  return false;
}

/**
 * Sets or clears global SuperAdmin master credentials across browser storage.
 */
export function setSuperAdminMasterSession(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      localStorage.setItem(SUPERADMIN_MASTER_KEY, "true");
      sessionStorage.setItem(SUPERADMIN_SESSION_KEY, "true");
      localStorage.setItem(ADMIN_OVERRIDE_KEY, "true");
      sessionStorage.setItem(ADMIN_OVERRIDE_KEY, "true");
      localStorage.setItem(OWNER_AUTH_KEY, "true");
      sessionStorage.setItem(OWNER_AUTH_KEY, "true");
    } else {
      localStorage.removeItem(SUPERADMIN_MASTER_KEY);
      sessionStorage.removeItem(SUPERADMIN_SESSION_KEY);
      localStorage.removeItem(ADMIN_OVERRIDE_KEY);
      sessionStorage.removeItem(ADMIN_OVERRIDE_KEY);
      localStorage.removeItem(OWNER_AUTH_KEY);
      sessionStorage.removeItem(OWNER_AUTH_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Checks if the user is authorized as Owner for a specific tenant library slug.
 * SuperAdmin is automatically authorized for ALL libraries without any password prompt.
 */
export function isOwnerAuthorizedForSlug(slug?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const session = getStoredSession();
    if (isSuperAdminAuthenticated() || session?.isMaster) return true;

    // If owner passcode has been verified on this browser/session, grant owner authority!
    const ownerAuth = sessionStorage.getItem(OWNER_AUTH_KEY) || localStorage.getItem(OWNER_AUTH_KEY);
    if (ownerAuth === "true") return true;

    if (session?.role === "owner" && (!slug || !session.librarySlug || session.librarySlug === slug)) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * 1-Click Impersonate / Master Login into a tenant library as Owner.
 * Gives SuperAdmin instantaneous full access with zero password prompts.
 */
export function impersonateTenantOwner(slug: string, libraryName?: string, libraryId?: string): void {
  if (typeof window === "undefined") return;
  try {
    setSuperAdminMasterSession(true);
    sessionStorage.setItem("target_lib_auth", "true");
    localStorage.setItem("target_lib_auth", "true");
    localStorage.setItem("library_last_slug", slug);
    localStorage.setItem("library_last_role", "owner");
    setStoredSession({
      role: "owner",
      libraryId: libraryId || "",
      librarySlug: slug,
      username: "founder_master",
      fullName: `SuperAdmin (${libraryName || slug})`,
      isMaster: true,
    });
    window.dispatchEvent(new Event("auth-changed"));
  } catch (e) {
    console.error("Failed to impersonate tenant owner", e);
  }
}
