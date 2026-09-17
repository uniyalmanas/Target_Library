"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setStoredSession, getStoredSession, clearStoredSession, setSuperAdminMasterSession } from "@/lib/auth";
import { Library } from "@/lib/types";
import LibraryLogo from "@/lib/LibraryLogo";


function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySlug = searchParams.get("slug")?.trim() || "";

  // Workspace & Library State
  const [slugInput, setSlugInput] = useState(querySlug);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [loadingLib, setLoadingLib] = useState(Boolean(querySlug));

  // Credentials State
  const [role, setRole] = useState<"staff" | "owner">("staff");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Restore last selected login role if remembered
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRole = localStorage.getItem("library_last_role");
      if (savedRole === "owner" || savedRole === "staff") {
        setRole(savedRole);
      }
    }
  }, []);

  // Registered Libraries Directory Modal State
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [registeredLibraries, setRegisteredLibraries] = useState<Library[]>([]);
  const [loadingRegistered, setLoadingRegistered] = useState(false);

  // Fetch all registered libraries for the directory
  const fetchRegisteredLibraries = async () => {
    setLoadingRegistered(true);
    try {
      const res = await fetch("/api/libraries?all=true");
      if (res.ok) {
        const data = await res.json();
        setRegisteredLibraries(data.libraries || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRegistered(false);
    }
  };

  useEffect(() => {
    fetchRegisteredLibraries();
  }, []);

  // Initial mount: load querySlug if present in URL, otherwise auto-load last remembered library from localStorage
  useEffect(() => {
    if (querySlug) {
      loadLibrary(querySlug);
      return;
    }

    if (typeof window !== "undefined") {
      const savedSlug = localStorage.getItem("library_last_slug") || getStoredSession()?.librarySlug;
      if (savedSlug && savedSlug !== "undefined" && savedSlug !== "null") {
        loadLibrary(savedSlug, true);
        return;
      }
    }

    setActiveSlug(null);
    setLibrary(null);
    setLoadingLib(false);
  }, [querySlug]);

  // Close directory modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showDirectoryModal) {
        setShowDirectoryModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDirectoryModal]);

  const loadLibrary = async (slugToLoad: string, isFromStorage = false) => {
    if (!slugToLoad) return;
    setLoadingLib(true);
    setAuthError(null);
    try {
      const res = await fetch(`/api/libraries?slug=${encodeURIComponent(slugToLoad)}`);
      const data = await res.json();
      if (res.ok && data.library) {
        setLibrary(data.library);
        setActiveSlug(data.library.slug);
        setSlugInput(data.library.slug);
        if (typeof window !== "undefined") {
          localStorage.setItem("library_last_slug", data.library.slug);
        }
      } else {
        if (!isFromStorage) {
          setAuthError(`Library "${slugToLoad}" is not registered on LibraryOS. Only registered libraries can sign in.`);
        } else {
          if (typeof window !== "undefined") {
            localStorage.removeItem("library_last_slug");
          }
        }
        setLibrary(null);
        setActiveSlug(null);
      }
    } catch {
      if (!isFromStorage) {
        setAuthError("Unable to connect to library authentication service.");
      }
      setLibrary(null);
      setActiveSlug(null);
    } finally {
      setLoadingLib(false);
    }
  };

  const handleSelectFromDirectory = (lib: Library) => {
    setLibrary(lib);
    setActiveSlug(lib.slug);
    setSlugInput(lib.slug);
    setShowDirectoryModal(false);
    setAuthError(null);
    if (typeof window !== "undefined") {
      localStorage.setItem("library_last_slug", lib.slug);
    }
    router.replace(`/login?slug=${encodeURIComponent(lib.slug)}`);
  };

  const handleClearWorkspace = () => {
    setActiveSlug(null);
    setLibrary(null);
    setSlugInput("");
    setAuthError(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("library_last_slug");
    }
    router.replace("/login");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = (activeSlug || slugInput)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    if (!cleanSlug) {
      setAuthError("Please enter your library workspace identifier.");
      return;
    }

    if (!password.trim()) {
      setAuthError("Please enter your passcode / password.");
      return;
    }

    setLoggingIn(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: cleanSlug,
          role,
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      const isSuper = data.user.role === "superadmin" || Boolean(data.user.isMaster);

      setStoredSession({
        role: data.user.role,
        libraryId: data.user.libraryId || library?.id || "",
        librarySlug: data.user.slug || cleanSlug,
        username: data.user.username,
        fullName: data.user.fullName,
        isMaster: Boolean(data.user.isMaster),
      });

      sessionStorage.setItem("target_lib_auth", "true");
      if (typeof window !== "undefined") {
        localStorage.setItem("library_last_slug", data.user.slug || cleanSlug);
        localStorage.setItem("library_last_role", data.user.role === "owner" ? "owner" : "staff");
      }

      if (data.user.role === "staff") {
        // Staff login: strictly clear all owner & master privileges
        setSuperAdminMasterSession(false);
        sessionStorage.removeItem("target_lib_owner_auth");
        localStorage.removeItem("target_lib_owner_auth");
        sessionStorage.removeItem("target_lib_admin_override");
        localStorage.removeItem("target_lib_admin_override");
        sessionStorage.removeItem("libraryos_superadmin_auth");
        localStorage.removeItem("libraryos_superadmin_master");
      } else if (data.user.role === "owner" || data.user.role === "superadmin" || isSuper) {
        if (isSuper) {
          setSuperAdminMasterSession(true);
        }
        sessionStorage.setItem("target_lib_owner_auth", "true");
        localStorage.setItem("target_lib_owner_auth", "true");
      } else {
        sessionStorage.removeItem("target_lib_owner_auth");
        localStorage.removeItem("target_lib_owner_auth");
      }

      router.push(`/l/${cleanSlug}`);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoggingIn(false);
    }
  };

  // Filter registered libraries for Directory Modal
  const filteredDirectory = registeredLibraries.filter((lib) => {
    if (!directorySearch.trim()) return true;
    const q = directorySearch.toLowerCase().trim();
    return (
      lib.name.toLowerCase().includes(q) ||
      lib.slug.toLowerCase().includes(q) ||
      (lib.city && lib.city.toLowerCase().includes(q)) ||
      (lib.phone && lib.phone.includes(q))
    );
  });

  if (loadingLib) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-text-muted">Loading library workspace...</p>
        </div>
      </main>
    );
  }

  const isNotRegisteredError = authError && authError.toLowerCase().includes("not registered");

  return (
    <main className="min-h-screen bg-background text-text-main flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-2xl shadow-inner">
            📚
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Sign In to Your Library
          </h1>
          <p className="text-xs text-text-muted">
            Enter your library workspace identifier and passcode to access your portal.
          </p>
        </div>

        {/* Main Clean Sign-In Form Card */}
        <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm space-y-5">
          {/* Error Alert */}
          {authError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">⚠️</span>
                <span>{authError}</span>
              </div>
              {isNotRegisteredError && (
                <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-normal text-rose-500">
                    Want to register your library?
                  </span>
                  <Link
                    href={`/signup?name=${encodeURIComponent(slugInput)}`}
                    className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] transition shrink-0"
                  >
                    + Register as New Library &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Workspace Identifier */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                  Library Workspace
                </label>
                {library && (
                  <button
                    type="button"
                    onClick={() => setShowDirectoryModal(true)}
                    className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>🔄</span> Switch Library
                  </button>
                )}
              </div>

              {library ? (
                /* Selected Library Verified Badge - Completely replaces raw workspace code input */
                <div className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/30 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <LibraryLogo
                      slug={library.slug}
                      logoUrl={library.logo_url}
                      name={library.name}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-xs text-text-main truncate">
                          {library.name}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                          ✓ Saved on Device
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted font-mono truncate mt-0.5">
                        /l/{library.slug} &bull; {library.city || "Dehradun"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowDirectoryModal(true)}
                      className="px-2.5 py-1.5 rounded-xl border border-rose-500/30 bg-card-bg hover:bg-rose-500/10 text-[11px] font-bold text-rose-600 dark:text-rose-400 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Switch to another registered library"
                    >
                      <span>🔄</span> Switch
                    </button>
                    <button
                      type="button"
                      onClick={handleClearWorkspace}
                      className="px-2 py-1 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-[10px] font-semibold text-text-muted hover:text-text-main transition cursor-pointer"
                      title="Clear and enter workspace code manually"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                /* Workspace Selection if no library is selected yet */
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setShowDirectoryModal(true)}
                    className="w-full p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/15 border-2 border-dashed border-rose-500/40 text-left transition flex items-center justify-between gap-3 group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                        🏢
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-text-main group-hover:text-rose-600 transition">
                          Select from Registered Libraries
                        </div>
                        <div className="text-[10px] text-text-muted font-normal mt-0.5">
                          Browse registered libraries &bull; Saved forever on this device
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-extrabold text-[11px] shrink-0 shadow-xs group-hover:bg-rose-500 transition">
                      Browse List &rarr;
                    </span>
                  </button>

                  {registeredLibraries.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center justify-between">
                        <span>Quick Select:</span>
                      </div>
                      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {registeredLibraries.slice(0, 5).map((lib) => (
                          <button
                            key={lib.slug}
                            type="button"
                            onClick={() => handleSelectFromDirectory(lib)}
                            className="px-2.5 py-1 rounded-xl bg-card-bg hover:bg-rose-500/10 border border-panel-border hover:border-rose-500/40 text-[11px] font-bold text-text-main hover:text-rose-600 transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                          >
                            <span>📚</span>
                            <span className="truncate max-w-[130px]">{lib.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-panel-border">
                    <div className="flex items-center rounded-xl bg-background border border-panel-border overflow-hidden focus-within:ring-2 focus-within:ring-rose-500">
                      <span className="px-3 py-2 text-xs font-mono text-text-muted bg-neutral-500/5 border-r border-panel-border select-none">
                        /l/
                      </span>
                      <input
                        type="text"
                        placeholder="Or type workspace code directly (e.g. target-library)"
                        value={slugInput}
                        onChange={(e) => setSlugInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && slugInput.trim()) {
                            e.preventDefault();
                            loadLibrary(slugInput.trim());
                          }
                        }}
                        className="w-full bg-transparent px-3 py-2 text-xs font-mono text-text-main focus:outline-none"
                      />
                      {slugInput.trim() && (
                        <button
                          type="button"
                          onClick={() => loadLibrary(slugInput.trim())}
                          className="px-3 py-2 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-l border-panel-border transition cursor-pointer"
                        >
                          Load
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Role Selection */}
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                Select Login Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRole("staff");
                    if (typeof window !== "undefined") {
                      localStorage.setItem("library_last_role", "staff");
                    }
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    role === "staff"
                      ? "bg-rose-500/10 border-rose-500/40 text-text-main shadow-2xs"
                      : "bg-background border-panel-border text-text-muted hover:text-text-main hover:border-neutral-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">💻</span>
                    {role === "staff" && (
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    )}
                  </div>
                  <div className="font-extrabold text-xs">Front Desk</div>
                  <div className="text-[10px] text-text-muted">Reception &amp; Seats</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole("owner");
                    if (typeof window !== "undefined") {
                      localStorage.setItem("library_last_role", "owner");
                    }
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    role === "owner"
                      ? "bg-sky-500/10 border-sky-500/40 text-text-main shadow-2xs"
                      : "bg-background border-panel-border text-text-muted hover:text-text-main hover:border-neutral-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">👑</span>
                    {role === "owner" && (
                      <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    )}
                  </div>
                  <div className="font-extrabold text-xs">Library Owner</div>
                  <div className="text-[10px] text-text-muted">Ledger &amp; Settings</div>
                </button>
              </div>
            </div>

            {/* Passcode / Password with Visible Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                  Passcode / Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer select-none"
                >
                  <span>{showPassword ? "🙈 Hide" : "👁️ Show"}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-panel-border rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main text-sm transition select-none cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loggingIn || !(activeSlug || slugInput).trim() || !password.trim()}
              className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loggingIn ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Verifying Credentials...
                </>
              ) : (
                <>Sign In to Library Portal &rarr;</>
              )}
            </button>
          </form>

          {/* New to LibraryOS CTA */}
          <div className="pt-3 border-t border-panel-border text-center text-xs text-text-muted">
            New to LibraryOS?{" "}
            <Link
              href="/signup"
              className="font-bold text-rose-600 dark:text-rose-400 hover:underline"
            >
              Register as a New Library (7-Day Free Trial) &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* DIRECTORY MODAL: Option where anyone can see all registered libraries */}
      {/* --------------------------------------------------------------------- */}
      {showDirectoryModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center animate-in fade-in duration-150"
          onClick={() => setShowDirectoryModal(false)}
        >
          <div
            className="my-auto bg-card-bg border border-panel-border rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[calc(100vh-2rem)] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-panel-border">
              <div>
                <h2 className="text-base font-black text-text-main flex items-center gap-2">
                  <span>🏢</span> Registered Libraries Directory
                </h2>
                <p className="text-xs text-text-muted">
                  Select your library to automatically fill your workspace code.
                </p>
              </div>
              <button
                onClick={() => setShowDirectoryModal(false)}
                className="text-text-muted hover:text-text-main p-1.5 rounded-xl hover:bg-neutral-500/10 transition cursor-pointer text-sm font-bold"
              >
                &times;
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xs pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                autoFocus
                placeholder="Search registered libraries by name, city, or slug..."
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                className="w-full bg-background border border-panel-border rounded-xl pl-9 pr-9 py-2.5 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              {directorySearch && (
                <button
                  type="button"
                  onClick={() => setDirectorySearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Count & Info */}
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>Click a library to select</span>
              <span className="font-mono px-2 py-0.5 rounded-full bg-neutral-500/10">
                {filteredDirectory.length} Registered
              </span>
            </div>

            {/* Libraries List */}
            {loadingRegistered ? (
              <div className="space-y-2 py-2">
                <div className="h-16 rounded-2xl bg-neutral-500/10 animate-pulse" />
                <div className="h-16 rounded-2xl bg-neutral-500/10 animate-pulse" />
              </div>
            ) : filteredDirectory.length > 0 ? (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {filteredDirectory.map((lib) => {
                  const totalSeats =
                    (lib as any).library_settings?.total_seats ||
                    (lib.slug === "target-library" ? 297 : 50);
                  const isCurrent = (activeSlug || library?.slug) === lib.slug;
                  return (
                    <button
                      key={lib.id || lib.slug}
                      onClick={() => handleSelectFromDirectory(lib)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all group flex items-center justify-between gap-3 cursor-pointer shadow-2xs ${
                        isCurrent
                          ? "border-rose-500 bg-rose-500/10 shadow-xs"
                          : "border-panel-border hover:border-rose-500/40 bg-background/50 hover:bg-rose-500/5"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <LibraryLogo
                          slug={lib.slug}
                          logoUrl={lib.logo_url}
                          name={lib.name}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-xs text-text-main group-hover:text-rose-600 transition truncate">
                              {lib.name}
                            </h4>
                            {isCurrent ? (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                                ✓ Active
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-500/10 text-text-muted shrink-0">
                                /l/{lib.slug}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted truncate mt-0.5">
                            📍 {lib.city || "Dehradun"} &bull; {totalSeats} Seats Capacity
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 shrink-0 group-hover:translate-x-0.5 transition-transform">
                        <span>{isCurrent ? "Selected" : "Select & Remember"}</span>
                        <span>&rarr;</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 px-4 rounded-2xl bg-neutral-500/5 border border-dashed border-panel-border space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center text-lg">
                  ⚠️
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-text-main">
                    No registered library matching &ldquo;{directorySearch}&rdquo;
                  </p>
                  <p className="text-[11px] text-text-muted max-w-xs mx-auto">
                    Only registered libraries can sign in. Want to register this library?
                  </p>
                </div>
                <Link
                  href={`/signup?name=${encodeURIComponent(directorySearch)}`}
                  onClick={() => setShowDirectoryModal(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-sm transition active:scale-95"
                >
                  <span>+ Register &ldquo;{directorySearch}&rdquo; (7-Day Trial)</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function UniversalLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
