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
}

/**
 * Returns true if the current browser session has SaaS SuperAdmin (Platform Founder) authority.
 * Checks across localStorage, sessionStorage, and active session role.
 */
export function isSuperAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(SUPERADMIN_MASTER_KEY) === "true") return true;
    if (sessionStorage.getItem(SUPERADMIN_SESSION_KEY) === "true") return true;
    const session = getStoredSession();
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
  if (isSuperAdminAuthenticated()) return true;
  try {
    const ownerAuth = sessionStorage.getItem(OWNER_AUTH_KEY) || localStorage.getItem(OWNER_AUTH_KEY);
    if (ownerAuth === "true") return true;
    const session = getStoredSession();
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
    setStoredSession({
      role: "owner",
      libraryId: libraryId || "",
      librarySlug: slug,
      username: "founder_master",
      fullName: `SuperAdmin (${libraryName || slug})`,
      isMaster: true,
    });
  } catch (e) {
    console.error("Failed to impersonate tenant owner", e);
  }
}
