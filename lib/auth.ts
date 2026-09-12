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
}

const STORAGE_KEY = "library_ms_auth_session";

export const DEFAULT_SESSION: AuthSession = {
  role: "staff",
  libraryId: "00000000-0000-0000-0000-000000000001",
  librarySlug: "target-library",
  username: "staff",
  fullName: "Front Desk Staff",
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
