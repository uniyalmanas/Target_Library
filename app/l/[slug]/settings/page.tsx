"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { Library, LibrarySettings, ShiftConfig } from "@/lib/types";
import { FALLBACK_TARGET_LIBRARY, FALLBACK_SETTINGS, DEMO_LIBRARY, DEMO_SETTINGS, isDemoSlug, getEffectiveLogo, getLibraryAccessStatus } from "@/lib/tenant";
import LibraryLogo from "@/lib/LibraryLogo";
import TenantAccessBarrier from "@/lib/TenantAccessBarrier";
import { getStoredSession, setStoredSession, isSuperAdminAuthenticated, isOwnerAuthorizedForSlug } from "@/lib/auth";
import { doShiftsClash } from "@/lib/shifts";
import SubscriptionPaymentModal from "@/lib/SubscriptionPaymentModal";

export const PRESET_EMBLEMS = [
  { id: "academy", label: "Academy Crest", icon: "🏛️", gradient: ["#8B5CF6", "#6D28D9"] },
  { id: "books", label: "Modern Stack", icon: "📚", gradient: ["#F43F5E", "#E11D48"] },
  { id: "scholar", label: "Scholar Laurel", icon: "🎓", gradient: ["#3B82F6", "#1D4ED8"] },
  { id: "torch", label: "Wisdom Torch", icon: "💡", gradient: ["#F59E0B", "#D97706"] },
  { id: "focus", label: "Focus Station", icon: "⚡", gradient: ["#10B981", "#059669"] },
  { id: "tome", label: "Open Tome", icon: "📖", gradient: ["#EC4899", "#BE185D"] },
  { id: "apex", label: "Apex Study", icon: "🌟", gradient: ["#6366F1", "#4338CA"] },
  { id: "haven", label: "Quiet Haven", icon: "☕", gradient: ["#78350F", "#451A03"] },
];

export const MONOGRAM_PALETTES = [
  { id: "sunrise", name: "Sunrise (Rose/Amber)", from: "#E11D48", to: "#F59E0B" },
  { id: "midnight", name: "Midnight (Indigo/Purple)", from: "#4F46E5", to: "#9333EA" },
  { id: "emerald", name: "Emerald (Teal/Emerald)", from: "#0D9488", to: "#10B981" },
  { id: "slate", name: "Obsidian (Dark Titanium)", from: "#1E293B", to: "#0F172A" },
];

function generateEmblemSvg(icon: string, [c1, c2]: string[]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="200" rx="44" fill="url(#g)"/><text x="50%" y="54%" font-size="100" text-anchor="middle" dominant-baseline="central">${icon}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function generateMonogramSvg(initials: string, c1: string, c2: string) {
  const clean = (initials || "LB").trim().slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="mg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="200" rx="44" fill="url(#mg)"/><rect x="8" y="8" width="184" height="184" rx="36" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="4"/><text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="80" fill="#FFFFFF" text-anchor="middle" dominant-baseline="central" letter-spacing="-2">${clean}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function LibraryOwnerSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [library, setLibrary] = useState<Library>(FALLBACK_TARGET_LIBRARY);
  const [settings, setSettings] = useState<LibrarySettings>(FALLBACK_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable Form States
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Dehradun");
  const [address, setAddress] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");

  // Branding & Logo State
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [selectedPalette, setSelectedPalette] = useState(MONOGRAM_PALETTES[0].id);
  const [customInitials, setCustomInitials] = useState("");
  const [logoUploadLoading, setLogoUploadLoading] = useState(false);

  // Seats & Shifts Configuration
  const [totalSeats, setTotalSeats] = useState<number>(297);
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [hasSheetEnabled, setHasSheetEnabled] = useState(true);
  const [sheetPriceMonthly, setSheetPriceMonthly] = useState(300);
  const [priceProtectionEnabled, setPriceProtectionEnabled] = useState(true);
  const [shiftEnrollmentCounts, setShiftEnrollmentCounts] = useState<Record<string, number>>({});
  const [shiftStudents, setShiftStudents] = useState<Record<string, any[]>>({});
  const [loadingShiftEnrollments, setLoadingShiftEnrollments] = useState(false);

  // Shift Safety & Migration Modal State
  const [shiftToMigrate, setShiftToMigrate] = useState<ShiftConfig | null>(null);
  const [destinationShiftId, setDestinationShiftId] = useState<string>("");
  const [migratingShift, setMigratingShift] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  // WhatsApp Shift Broadcast Modal State
  const [shiftToBroadcast, setShiftToBroadcast] = useState<ShiftConfig | null>(null);
  const [copiedBroadcastText, setCopiedBroadcastText] = useState(false);

  // New Shift Modal/Form State
  const [showAddShift, setShowAddShift] = useState(false);
  const [newShiftName, setNewShiftName] = useState("");
  const [newShiftStart, setNewShiftStart] = useState("06:00");
  const [newShiftEnd, setNewShiftEnd] = useState("14:00");
  const [newShiftBasePrice, setNewShiftBasePrice] = useState<number>(600);
  const [newShiftSheetPrice, setNewShiftSheetPrice] = useState<number>(900);
  const [addingShift, setAddingShift] = useState(false);
  const [addShiftError, setAddShiftError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"branding" | "seats_shifts" | "matrix_layout" | "upi_soundbox" | "passwords" | "general" | "poster" | "domains" | "backup" | "billing">("branding");
  const [showBillingPaymentModal, setShowBillingPaymentModal] = useState(false);

  // Seat Matrix Display & Layout States
  const [matrixPreset, setMatrixPreset] = useState<"fit" | "compact" | "standard" | "large" | "custom">("fit");
  const [matrixTileSize, setMatrixTileSize] = useState<number>(44);
  const [matrixIsWide, setMatrixIsWide] = useState<boolean>(true);
  const [matrixSaveSuccess, setMatrixSaveSuccess] = useState(false);

  // Owner Access Control & Security Gate
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState(false);
  const [checkingOwnerAuth, setCheckingOwnerAuth] = useState(true);
  const [ownerPassInput, setOwnerPassInput] = useState("");
  const [showOwnerPass, setShowOwnerPass] = useState(false);
  const [ownerPassError, setOwnerPassError] = useState("");
  const [unlockingOwner, setUnlockingOwner] = useState(false);
  const [showNewStaffPass, setShowNewStaffPass] = useState(false);
  const [showNewOwnerPass, setShowNewOwnerPass] = useState(false);

  // Password Management State
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [confirmStaffPassword, setConfirmStaffPassword] = useState("");
  const [savingStaffPass, setSavingStaffPass] = useState(false);
  const [staffPassSuccess, setStaffPassSuccess] = useState(false);

  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [savingOwnerPass, setSavingOwnerPass] = useState(false);
  const [ownerPassSuccess, setOwnerPassSuccess] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);

  // Custom Domain & Subdomain Management States
  const [subdomainInput, setSubdomainInput] = useState<string>("");
  const [customDomainInput, setCustomDomainInput] = useState<string>("");
  const [isDomainVerified, setIsDomainVerified] = useState<boolean>(false);
  const [verifyingDomain, setVerifyingDomain] = useState<boolean>(false);
  const [domainVerifyResult, setDomainVerifyResult] = useState<{ verified: boolean; details: string } | null>(null);
  const [savingDomain, setSavingDomain] = useState<boolean>(false);
  const [domainSaveSuccess, setDomainSaveSuccess] = useState<boolean>(false);
  const [domainErrorMessage, setDomainErrorMessage] = useState<string | null>(null);

  // Fetch initial settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/libraries/${slug}/settings`);
      if (res.ok) {
        const data = await res.json();
        const isDemo = isDemoSlug(slug);
        const lib = data.library || (isDemo ? DEMO_LIBRARY : FALLBACK_TARGET_LIBRARY);
        const sett = data.settings || (isDemo ? DEMO_SETTINGS : FALLBACK_SETTINGS);

        setLibrary(lib);
        setSettings(sett);

        setName(lib.name || "");
        setPhone(lib.phone || "");
        setCity(lib.city || (isDemo ? "Innovation Hub" : "Dehradun"));
        setAddress(lib.address || "");
        setUpiId(lib.upi_id || "");
        setUpiName(lib.upi_name || "");
        setLogoUrl(lib.logo_url || "");
        setCustomInitials((lib.name || slug).replace(/^the\s+/i, "").slice(0, 2).toUpperCase());

        setTotalSeats(sett.total_seats || 297);
        setShifts(sett.shifts_config || FALLBACK_SETTINGS.shifts_config);
        setHasSheetEnabled(sett.has_sheet_enabled ?? true);
        setSheetPriceMonthly(sett.sheet_price_monthly ?? 300);
        setPriceProtectionEnabled(sett.price_protection_enabled ?? true);
      }

      // Fetch domain and subdomain configuration
      try {
        const dRes = await fetch(`/api/domains/manage?slug=${slug}`);
        if (dRes.ok) {
          const dData = await dRes.json();
          if (dData.config) {
            setSubdomainInput(dData.config.subdomain || "");
            setCustomDomainInput(dData.config.custom_domain || "");
            setIsDomainVerified(dData.config.custom_domain_verified || false);
          }
        }
      } catch {
        // ignore
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadShiftEnrollments = useCallback(async () => {
    setLoadingShiftEnrollments(true);
    try {
      const res = await fetch(`/api/libraries/${slug}/shifts`);
      if (res.ok) {
        const data = await res.json();
        setShiftEnrollmentCounts(data.counts || {});
        setShiftStudents(data.studentsByShift || {});
      }
    } catch {
      // ignore
    } finally {
      setLoadingShiftEnrollments(false);
    }
  }, [slug]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (activeTab === "seats_shifts") {
      loadShiftEnrollments();
    }
  }, [activeTab, loadShiftEnrollments]);

  // Restore saved seat matrix display preferences and check ?tab= query parameter
  useEffect(() => {
    try {
      const urlTab = new URLSearchParams(window.location.search).get("tab");
      if (
        urlTab === "matrix_layout" ||
        urlTab === "seats_shifts" ||
        urlTab === "branding" ||
        urlTab === "passwords" ||
        urlTab === "upi_soundbox" ||
        urlTab === "general" ||
        urlTab === "poster" ||
        urlTab === "domains"
      ) {
        setActiveTab(urlTab as any);
      }
      const savedPreset = localStorage.getItem("library_seat_matrix_preset");
      const savedTileSize = localStorage.getItem("library_seat_matrix_tile_size");
      const savedWide = localStorage.getItem("library_seat_matrix_is_wide");
      if (savedPreset) setMatrixPreset(savedPreset as any);
      if (savedTileSize) setMatrixTileSize(Number(savedTileSize));
      if (savedWide !== null) setMatrixIsWide(savedWide === "true");
    } catch {
      // ignore
    }
  }, []);

  const handleSaveMatrixDisplay = (
    preset = matrixPreset,
    tileSize = matrixTileSize,
    isWide = matrixIsWide
  ) => {
    try {
      localStorage.setItem("library_seat_matrix_preset", preset);
      localStorage.setItem("library_seat_matrix_tile_size", tileSize.toString());
      localStorage.setItem("library_seat_matrix_is_wide", isWide.toString());
      setMatrixSaveSuccess(true);
      setTimeout(() => setMatrixSaveSuccess(false), 3500);
    } catch {
      // ignore
    }
  };

  // Verify Owner Credentials & Role
  useEffect(() => {
    if (isSuperAdminAuthenticated() || isOwnerAuthorizedForSlug(slug) || isDemoSlug(slug)) {
      setIsOwnerAuthenticated(true);
      setCheckingOwnerAuth(false);
      return;
    }

    const session = getStoredSession();
    const ownerAuth = sessionStorage.getItem("target_lib_owner_auth") || localStorage.getItem("target_lib_owner_auth");
    const isOwnerRole = session.role === "owner" || session.role === "superadmin" || session.isMaster;
    const isMatchingSlug = session.librarySlug === slug || session.role === "superadmin" || session.isMaster;

    if (ownerAuth === "true" || (isOwnerRole && isMatchingSlug)) {
      setIsOwnerAuthenticated(true);
    } else {
      setIsOwnerAuthenticated(false);
    }
    setCheckingOwnerAuth(false);
  }, [slug]);

  const handleUnlockOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerPassInput.trim()) {
      setOwnerPassError("Please enter your owner passcode.");
      return;
    }

    setUnlockingOwner(true);
    setOwnerPassError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          role: "owner",
          password: ownerPassInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        sessionStorage.setItem("target_lib_owner_auth", "true");
        localStorage.setItem("target_lib_owner_auth", "true");
        if (data.user?.isMaster) {
          localStorage.setItem("libraryos_superadmin_master", "true");
        }
        setStoredSession({
          role: "owner",
          libraryId: library?.id || "",
          librarySlug: slug,
          username: data.user?.username || "owner",
          fullName: data.user?.fullName || "Library Owner",
          isMaster: data.user?.isMaster,
        });
        setIsOwnerAuthenticated(true);
      } else {
        setOwnerPassError(data.error || "Incorrect owner passcode. Access denied.");
      }
    } catch {
      setOwnerPassError("Authentication service error. Please try again.");
    } finally {
      setUnlockingOwner(false);
    }
  };

  // Handle Shift Update
  const handleShiftChange = (index: number, field: keyof ShiftConfig, value: any) => {
    const updated = [...shifts];
    updated[index] = { ...updated[index], [field]: value };
    setShifts(updated);
  };

  // Persist shifts directly to backend and sync state
  const persistShifts = async (updatedShifts: ShiftConfig[]) => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/libraries/${slug}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          city,
          address,
          logo_url: logoUrl.trim() || null,
          upi_id: upiId,
          upi_name: upiName,
          total_seats: Number(totalSeats),
          shifts_config: updatedShifts,
          has_sheet_enabled: hasSheetEnabled,
          sheet_price_monthly: Number(sheetPriceMonthly),
          price_protection_enabled: priceProtectionEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update shifts configuration");

      if (data.library) {
        setLibrary(data.library);
        setLogoUrl(data.library.logo_url || "");
      }
      if (data.settings?.shifts_config) {
        setShifts(data.settings.shifts_config);
        setSettings(data.settings);
      } else {
        setShifts(updatedShifts);
      }

      setSaveSuccess(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("library-settings-updated"));
      }
      setTimeout(() => setSaveSuccess(false), 4000);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving shifts";
      setErrorMessage(msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Remove Shift with Active Enrollment Safety Guard & Auto-Persistence
  const handleRemoveShift = async (id: string) => {
    if (shifts.length <= 1) {
      alert("At least one shift must be configured.");
      return;
    }
    const count = shiftEnrollmentCounts[id] || 0;
    const shift = shifts.find((s) => s.id === id);
    if (!shift) return;

    if (count > 0) {
      // Active students enrolled: trigger safety migration modal!
      setShiftToMigrate(shift);
      const otherShifts = shifts.filter((s) => s.id !== id);
      setDestinationShiftId(otherShifts[0]?.id || "");
      setMigrationError(null);
    } else {
      // Clean delete with immediate backend persistence
      const nextShifts = shifts.filter((s) => s.id !== id);
      await persistShifts(nextShifts);
    }
  };

  const handleExecuteMigrationAndDelete = async () => {
    if (!shiftToMigrate || !destinationShiftId) return;
    setMigratingShift(true);
    setMigrationError(null);
    try {
      const res = await fetch(`/api/libraries/${slug}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "migrate",
          fromShiftId: shiftToMigrate.id,
          toShiftId: destinationShiftId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Migration failed");

      // Successfully migrated in DB -> remove from settings & persist
      const nextShifts = shifts.filter((s) => s.id !== shiftToMigrate.id);
      await persistShifts(nextShifts);
      setShiftToMigrate(null);
      await loadShiftEnrollments();
      alert(data.message || "Students migrated successfully.");
    } catch (err: unknown) {
      setMigrationError(err instanceof Error ? err.message : "Failed to migrate students");
    } finally {
      setMigratingShift(false);
    }
  };

  // Add Custom Shift with Immediate Persistence
  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftName.trim()) return;

    setAddingShift(true);
    setAddShiftError(null);

    // Clean, readable and URL-safe ID under 20 chars for database safety
    const cleanSlug = newShiftName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newId = `s_${cleanSlug || "custom"}_${randomSuffix}`.slice(0, 19);

    const newShift: ShiftConfig = {
      id: newId,
      name: newShiftName.trim(),
      start_time: newShiftStart,
      end_time: newShiftEnd,
      base_price: Number(newShiftBasePrice),
      sheet_price: Number(newShiftSheetPrice),
    };

    const nextShifts = [...shifts, newShift];

    const ok = await persistShifts(nextShifts);
    if (ok) {
      setNewShiftName("");
      setShowAddShift(false);
    } else {
      setAddShiftError("Could not save new shift to server. Please try again.");
    }
    setAddingShift(false);
  };

  // Handle Logo Upload via HTML5 Canvas Compression
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file (PNG, JPG, WebP, or SVG).");
      return;
    }

    setLogoUploadLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/webp", 0.85);
          setLogoUrl(compressed);
        }
        setLogoUploadLoading(false);
      };
      img.onerror = () => {
        alert("Failed to process image file.");
        setLogoUploadLoading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle Preset Emblem Selection
  const handleSelectPreset = (preset: (typeof PRESET_EMBLEMS)[number]) => {
    const svgData = generateEmblemSvg(preset.icon, preset.gradient);
    setLogoUrl(svgData);
  };

  // Handle Monogram Generation
  const handleApplyMonogram = () => {
    const pal = MONOGRAM_PALETTES.find((p) => p.id === selectedPalette) || MONOGRAM_PALETTES[0];
    const inits = (customInitials.trim() || (name || slug).replace(/^the\s+/i, "").slice(0, 2)).toUpperCase();
    const svgData = generateMonogramSvg(inits, pal.from, pal.to);
    setLogoUrl(svgData);
  };

  // Reset / Remove Logo
  const handleRemoveLogo = () => {
    setLogoUrl("");
  };

  // Save Settings
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/libraries/${slug}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          city,
          address,
          logo_url: logoUrl.trim() || null,
          upi_id: upiId,
          upi_name: upiName,
          total_seats: Number(totalSeats),
          shifts_config: shifts,
          has_sheet_enabled: hasSheetEnabled,
          sheet_price_monthly: Number(sheetPriceMonthly),
          price_protection_enabled: priceProtectionEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      if (data.library) {
        setLibrary(data.library);
        setLogoUrl(data.library.logo_url || "");
      }
      if (data.settings) {
        setSettings(data.settings);
        if (data.settings.shifts_config) {
          setShifts(data.settings.shifts_config);
        }
      }

      setSaveSuccess(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("library-settings-updated"));
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  // Update Staff Password
  const handleUpdateStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffPassword.trim()) return;
    if (newStaffPassword !== confirmStaffPassword) {
      setPasswordErrorMessage("Staff passwords do not match.");
      return;
    }

    setSavingStaffPass(true);
    setPasswordErrorMessage(null);
    try {
      const res = await fetch(`/api/libraries/${slug}/staff-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_role: "staff",
          new_password: newStaffPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update staff password");

      setStaffPassSuccess(true);
      setNewStaffPassword("");
      setConfirmStaffPassword("");
      setTimeout(() => setStaffPassSuccess(false), 4000);
    } catch (err: unknown) {
      setPasswordErrorMessage(err instanceof Error ? err.message : "Error updating staff password");
    } finally {
      setSavingStaffPass(false);
    }
  };

  // Update Owner Password
  const handleUpdateOwnerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerPassword.trim()) return;

    setSavingOwnerPass(true);
    setPasswordErrorMessage(null);
    try {
      const res = await fetch(`/api/libraries/${slug}/staff-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_role: "owner",
          new_password: newOwnerPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update owner password");

      setOwnerPassSuccess(true);
      setNewOwnerPassword("");
      setTimeout(() => setOwnerPassSuccess(false), 4000);
    } catch (err: unknown) {
      setPasswordErrorMessage(err instanceof Error ? err.message : "Error updating owner password");
    } finally {
      setSavingOwnerPass(false);
    }
  };

  // Save Subdomain and Custom Domain Config
  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDomain(true);
    setDomainSaveSuccess(false);
    setDomainErrorMessage(null);

    try {
      const res = await fetch("/api/domains/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          subdomain: subdomainInput.trim() || null,
          custom_domain: customDomainInput.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save domain configuration");

      setDomainSaveSuccess(true);
      if (data.config) {
        setSubdomainInput(data.config.subdomain || "");
        setCustomDomainInput(data.config.custom_domain || "");
        setIsDomainVerified(data.config.custom_domain_verified || false);
      }
      setTimeout(() => setDomainSaveSuccess(false), 4000);
    } catch (err: any) {
      setDomainErrorMessage(err.message || "Error saving domain configuration");
    } finally {
      setSavingDomain(false);
    }
  };

  // Verify Custom Domain DNS
  const handleVerifyDomain = async () => {
    if (!customDomainInput.trim()) {
      setDomainErrorMessage("Please enter a custom domain name first.");
      return;
    }

    setVerifyingDomain(true);
    setDomainVerifyResult(null);
    setDomainErrorMessage(null);

    try {
      const res = await fetch("/api/domains/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          domain: customDomainInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify domain DNS");

      setDomainVerifyResult({
        verified: data.verified,
        details: data.details,
      });
      setIsDomainVerified(data.verified);
    } catch (err: any) {
      setDomainErrorMessage(err.message || "DNS verification check failed");
    } finally {
      setVerifyingDomain(false);
    }
  };

  // Door QR URL
  const origin = typeof window !== "undefined" ? window.location.origin : "https://library-ms-three.vercel.app";
  const entranceJoinUrl = `${origin}/l/${slug}/join`;
  const entranceQrImage = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
    entranceJoinUrl
  )}`;

  if (loading || checkingOwnerAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Access check: if subscription or trial expired, block settings access
  const access = getLibraryAccessStatus(library);
  const isSuper = isSuperAdminAuthenticated();
  const hasOverride =
    isSuper ||
    (typeof window !== "undefined" &&
      (sessionStorage.getItem("target_lib_admin_override") === "true" ||
        localStorage.getItem("target_lib_admin_override") === "true"));

  if (access.isBlocked && !hasOverride) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <TenantAccessBarrier
          library={library}
          access={access}
        />
      </main>
    );
  }

  if (!isOwnerAuthenticated) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="bg-card-bg border border-panel-border rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-5 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
            👑
          </div>

          <div>
            <h1 className="text-xl font-black text-text-main tracking-tight">
              Owner Credentials Required
            </h1>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
              Library settings, pricing, soundbox UPI, and staff passwords are restricted strictly to the Library Owner. Staff members do not have access.
            </p>
          </div>

          <form onSubmit={handleUnlockOwner} className="space-y-4 text-left pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted block">
                  Owner Passcode
                </label>
                <button
                  type="button"
                  onClick={() => setShowOwnerPass((prev) => !prev)}
                  className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer select-none"
                >
                  <span>{showOwnerPass ? "🙈 Hide" : "👁️ Show"}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showOwnerPass ? "text" : "password"}
                  placeholder="Enter owner password"
                  value={ownerPassInput}
                  onChange={(e) => {
                    setOwnerPassInput(e.target.value);
                    setOwnerPassError("");
                  }}
                  className="w-full bg-background border border-panel-border rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowOwnerPass((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main text-sm transition select-none cursor-pointer"
                  title={showOwnerPass ? "Hide password" : "Show password"}
                  aria-label={showOwnerPass ? "Hide password" : "Show password"}
                >
                  {showOwnerPass ? "🙈" : "👁️"}
                </button>
              </div>
              {ownerPassError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">{ownerPassError}</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Link
                href={`/l/${slug}`}
                className="flex-1 px-4 py-2.5 rounded-xl border border-panel-border hover:bg-neutral-500/10 text-xs font-bold text-center text-text-muted hover:text-text-main transition"
              >
                ← Return to Desk
              </Link>
              <button
                type="submit"
                disabled={unlockingOwner}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {unlockingOwner ? "Verifying..." : "Unlock Settings"}
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-main pb-24 print:bg-white print:text-black print:p-0">
      {/* Settings Top Action Bar */}
      <div className="w-full max-w-[96vw] 2xl:max-w-[1750px] mx-auto px-4 md:px-8 pt-4 pb-2 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-panel-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Library Owner Settings
              </h1>
              <span className="text-[10px] font-mono text-text-muted bg-neutral-500/10 px-2.5 py-0.5 rounded-full border border-panel-border">
                {slug}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Configure library profile, logo emblem, seat layout, pricing, and staff passcodes.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Saving...
              </>
            ) : (
              <>💾 Save All Changes</>
            )}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-[96vw] 2xl:max-w-[1750px] mx-auto px-4 md:px-8 pt-4 print:p-0 print:max-w-none">
        {/* Feedback Notifications */}
        {saveSuccess && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 print:hidden">
            <span>✅</span> Settings saved successfully! Changes are instantly live for desk staff and students.
          </div>
        )}

        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 print:hidden">
            <span>⚠️</span> {errorMessage}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-card-bg border border-panel-border rounded-2xl mb-6 overflow-x-auto print:hidden">
          <button
            onClick={() => setActiveTab("branding")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "branding"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            <span>🎨</span> Brand & Logo
          </button>
          <button
            onClick={() => setActiveTab("seats_shifts")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "seats_shifts"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            🪑 Seats & Shift Timings
          </button>
          <button
            onClick={() => setActiveTab("matrix_layout")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "matrix_layout"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            <span>🖥️</span> Seat Matrix Layout
          </button>
          <button
            onClick={() => setActiveTab("upi_soundbox")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "upi_soundbox"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            🔊 Soundbox & UPI Setup
          </button>
          <button
            onClick={() => setActiveTab("passwords")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "passwords"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            🔐 Staff & Owner Passwords
          </button>
          <button
            onClick={() => setActiveTab("general")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "general"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            🏢 Library Details
          </button>
          <button
            onClick={() => setActiveTab("poster")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "poster"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            🖨️ Entrance QR Door Poster
          </button>
          <button
            onClick={() => setActiveTab("domains")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "domains"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            <span>🌐</span> Custom Domain &amp; Subdomain
          </button>
          <button
            onClick={() => setActiveTab("backup")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "backup"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            <span>📊</span> Data Backup &amp; Excel
          </button>
          <button
            onClick={() => setActiveTab("billing")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "billing"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            <span>💳</span> Subscription &amp; Billing
          </button>
        </div>

        {/* TAB 0: Library Brand & Custom Logo Suite */}
        {activeTab === "branding" && (
          <div className="space-y-6">
            {/* Active Logo Hero Card */}
            <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-panel-border pb-5">
                <div className="flex items-center gap-4">
                  <div className="relative p-1 rounded-2xl bg-neutral-500/5 border border-panel-border shadow-inner">
                    <LibraryLogo
                      slug={slug}
                      logoUrl={logoUrl || library.logo_url}
                      name={name || library.name}
                      size="xl"
                      className="shadow-sm"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold tracking-tight">Active Library Logo</h2>
                      {logoUrl ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Custom Logo Active
                        </span>
                      ) : slug === "target-library" ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          Target Library Default
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          Default Monogram Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {logoUrl
                        ? "Your library has a dedicated custom logo configured."
                        : slug === "target-library"
                        ? "Currently displaying Target Library's original emblem."
                        : "Isolated instance: currently using your clean library initials monogram (Target Library logo is removed)."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🗑️</span> Remove / Reset Logo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>💾</span> Save Logo
                  </button>
                </div>
              </div>

              {/* Logo Selection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                {/* Method 1: Upload Image File */}
                <div className="bg-background border border-panel-border rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">📁</span>
                      <h3 className="font-extrabold text-sm text-text-main">Method 1: Upload Your Image</h3>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mb-4">
                      Upload your official logo (PNG, JPG, SVG, WebP). It is automatically compressed to high-speed WebP and saved directly into your library profile.
                    </p>

                    <label className="border-2 border-dashed border-panel-border hover:border-rose-500/50 bg-neutral-500/5 hover:bg-rose-500/5 rounded-2xl p-6 text-center cursor-pointer flex flex-col items-center justify-center gap-2 transition group">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      {logoUploadLoading ? (
                        <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-lg group-hover:scale-110 transition">
                          📤
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                          Click to Browse
                        </span>
                        <span className="text-xs text-text-muted"> or drag & drop</span>
                      </div>
                      <p className="text-[10px] text-text-muted">Supports PNG, JPG, WebP, SVG (Auto-compressed)</p>
                    </label>
                  </div>
                </div>

                {/* Method 2: Preset Emblems */}
                <div className="bg-background border border-panel-border rounded-2xl p-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🏛️</span>
                      <h3 className="font-extrabold text-sm text-text-main">Method 2: 1-Click Emblem Presets</h3>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mb-3">
                      Don&apos;t have a graphics designer? Pick one of our curated high-resolution study emblems:
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5">
                    {PRESET_EMBLEMS.map((emblem) => (
                      <button
                        key={emblem.id}
                        type="button"
                        onClick={() => handleSelectPreset(emblem)}
                        className="p-2.5 rounded-xl border border-panel-border hover:border-rose-500/50 hover:bg-rose-500/5 transition flex flex-col items-center gap-1.5 cursor-pointer text-center group"
                      >
                        <span className="text-2xl group-hover:scale-110 transition">{emblem.icon}</span>
                        <span className="text-[9px] font-bold text-text-muted group-hover:text-text-main leading-tight line-clamp-1">
                          {emblem.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Method 3: Custom Monogram Generator */}
                <div className="bg-background border border-panel-border rounded-2xl p-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">✨</span>
                      <h3 className="font-extrabold text-sm text-text-main">Method 3: Monogram Generator</h3>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mb-3">
                      Create an initial badge with luxury gradients tailored to your library name:
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                          Initials (1-2 chars)
                        </label>
                        <input
                          type="text"
                          maxLength={3}
                          value={customInitials}
                          onChange={(e) => setCustomInitials(e.target.value.toUpperCase())}
                          placeholder="e.g. TL"
                          className="w-full bg-card-bg border border-panel-border rounded-xl px-3 py-2 text-sm font-black tracking-widest text-center text-text-main uppercase focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                        />
                      </div>
                      <div className="flex-[2]">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                          Color Theme
                        </label>
                        <select
                          value={selectedPalette}
                          onChange={(e) => setSelectedPalette(e.target.value)}
                          className="w-full bg-card-bg border border-panel-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                        >
                          {MONOGRAM_PALETTES.map((pal) => (
                            <option key={pal.id} value={pal.id}>
                              {pal.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyMonogram}
                      className="w-full py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold shadow-xs hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>🎨</span> Apply Monogram as Logo
                    </button>
                  </div>
                </div>

                {/* Method 4: Direct Image URL */}
                <div className="bg-background border border-panel-border rounded-2xl p-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🔗</span>
                      <h3 className="font-extrabold text-sm text-text-main">Method 4: Hosted Image URL</h3>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mb-3">
                      Already have an image hosted online? Paste the direct URL here:
                    </p>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="url"
                      value={logoUrl.startsWith("data:") ? "" : logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value.trim())}
                      placeholder="https://example.com/logo.png"
                      className="w-full bg-card-bg border border-panel-border rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    {logoUrl.startsWith("data:") && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✓ Currently using an uploaded or generated vector/data URI logo.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Multi-Context Preview Showcase */}
            <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <span>👁️</span> Live Multi-Screen Preview
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  See how your logo renders across your desk app, student ID wallet cards, and official receipts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* 1. Header Bar Preview */}
                <div className="p-4 rounded-2xl bg-background border border-panel-border space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                    1. Navigation Bar
                  </span>
                  <div className="p-2.5 rounded-xl border border-panel-border bg-card-bg flex items-center gap-2">
                    <LibraryLogo
                      slug={slug}
                      logoUrl={logoUrl || library.logo_url}
                      name={name || library.name}
                      size="sm"
                    />
                    <span className="font-extrabold text-xs tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-amber-500 dark:from-rose-500 dark:to-amber-400 line-clamp-1">
                      {name || library.name}
                    </span>
                  </div>
                </div>

                {/* 2. Student ID Card Preview */}
                <div className="p-4 rounded-2xl bg-background border border-panel-border space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                    2. Student Pass (Virtual Card)
                  </span>
                  <div className="p-3 rounded-xl bg-gradient-to-tr from-neutral-900 to-neutral-950 border border-neutral-800 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LibraryLogo
                        slug={slug}
                        logoUrl={logoUrl || library.logo_url}
                        name={name || library.name}
                        size="sm"
                      />
                      <div>
                        <p className="text-[7px] text-rose-500 font-black uppercase tracking-widest leading-none">
                          {name || library.name}
                        </p>
                        <p className="text-[9px] font-extrabold text-neutral-200 mt-0.5">STUDENT PASS</p>
                      </div>
                    </div>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">
                      Seat 42
                    </span>
                  </div>
                </div>

                {/* 3. Tax Invoice Header Preview */}
                <div className="p-4 rounded-2xl bg-background border border-panel-border space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                    3. Digital Tax Invoice
                  </span>
                  <div className="p-3 rounded-xl border border-panel-border bg-card-bg flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-foreground line-clamp-1">
                        {name || library.name}
                      </p>
                      <p className="text-[8px] text-text-muted">{city || "Dehradun"}</p>
                    </div>
                    <LibraryLogo
                      slug={slug}
                      logoUrl={logoUrl || library.logo_url}
                      name={name || library.name}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: Seats & Shift Timings */}
        {activeTab === "seats_shifts" && (
          <div className="space-y-6">
            {/* Seat Capacity Card */}
            <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-panel-border pb-4">
                <div>
                  <h2 className="text-base font-extrabold flex items-center gap-2">
                    <span>🪑</span> Total Seats Capacity
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Adjust the exact number of cinema seats available in your study hall.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                    {totalSeats}
                  </span>
                  <span className="text-xs font-bold text-text-muted uppercase">Seats</span>
                </div>
              </div>

              {/* Slider & Quick Presets */}
              <div className="space-y-3">
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="1"
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />

                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>10 Seats (Co-working Room)</span>
                  <span>500 Seats (Grand Study Campus)</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mr-1">
                    Quick Presets:
                  </span>
                  {[30, 50, 80, 100, 150, 200, 297, 400, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTotalSeats(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        totalSeats === preset
                          ? "bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400 font-bold"
                          : "border-panel-border bg-background hover:bg-neutral-500/10 text-text-muted"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Shifts & Timings Configuration */}
            <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-panel-border pb-4">
                <div>
                  <h2 className="text-base font-extrabold flex items-center gap-2">
                    <span>🕒</span> Shift Hours & Monthly Fees
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Customize slot timings, monthly base fee, and sheet prices for your students.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddShift(true)}
                  className="px-3 py-1.5 rounded-xl bg-neutral-500/10 hover:bg-neutral-500/20 border border-panel-border text-xs font-bold transition cursor-pointer"
                >
                  + Add New Shift
                </button>
              </div>

              {/* Shift Rows */}
              <div className="space-y-3">
                {shifts.map((shift, idx) => (
                  <div
                    key={shift.id || idx}
                    className="p-4 rounded-2xl bg-background border border-panel-border space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                        <input
                          type="text"
                          value={shift.name}
                          onChange={(e) => handleShiftChange(idx, "name", e.target.value)}
                          className="font-bold text-sm bg-transparent border-b border-dashed border-panel-border focus:outline-none focus:border-rose-500 px-1 py-0.5"
                        />
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          (shiftEnrollmentCounts[shift.id] || 0) > 0
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                            : "bg-neutral-500/10 text-text-muted border-panel-border"
                        }`}>
                          👥 {shiftEnrollmentCounts[shift.id] || 0} enrolled
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(shiftEnrollmentCounts[shift.id] || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => setShiftToBroadcast(shift)}
                            className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs px-2.5 py-1 rounded-lg border border-emerald-500/30 transition flex items-center gap-1 cursor-pointer font-semibold"
                            title="Send WhatsApp update notice to students in this shift"
                          >
                            📢 WhatsApp Notice
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveShift(shift.id)}
                          className="text-text-muted hover:text-rose-600 text-xs px-2 py-1 rounded transition cursor-pointer"
                          title="Remove Shift"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={shift.start_time}
                          onChange={(e) => handleShiftChange(idx, "start_time", e.target.value)}
                          className="w-full bg-card-bg border border-panel-border rounded-xl px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={shift.end_time}
                          onChange={(e) => handleShiftChange(idx, "end_time", e.target.value)}
                          className="w-full bg-card-bg border border-panel-border rounded-xl px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          Base Fee (₹)
                        </label>
                        <input
                          type="number"
                          value={shift.base_price}
                          onChange={(e) => handleShiftChange(idx, "base_price", Number(e.target.value))}
                          className="w-full bg-card-bg border border-panel-border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          With Sheet Fee (₹)
                        </label>
                        <input
                          type="number"
                          value={shift.sheet_price}
                          onChange={(e) => handleShiftChange(idx, "sheet_price", Number(e.target.value))}
                          className="w-full bg-card-bg border border-panel-border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Shift Modal Form */}
              {showAddShift && (
                <form
                  onSubmit={handleAddShift}
                  className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/30 space-y-3 animate-in fade-in"
                >
                  <div className="font-extrabold text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    Add New Study Shift
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Shift Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Night Owl Shift (8 PM - 4 AM)"
                        value={newShiftName}
                        onChange={(e) => setNewShiftName(e.target.value)}
                        className="w-full bg-background border border-panel-border rounded-xl px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={newShiftStart}
                          onChange={(e) => setNewShiftStart(e.target.value)}
                          className="w-full bg-background border border-panel-border rounded-xl px-2 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={newShiftEnd}
                          onChange={(e) => setNewShiftEnd(e.target.value)}
                          className="w-full bg-background border border-panel-border rounded-xl px-2 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Base Monthly Price (₹)
                      </label>
                      <input
                        type="number"
                        value={newShiftBasePrice}
                        onChange={(e) => setNewShiftBasePrice(Number(e.target.value))}
                        className="w-full bg-background border border-panel-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Price with Desk Sheet (₹)
                      </label>
                      <input
                        type="number"
                        value={newShiftSheetPrice}
                        onChange={(e) => setNewShiftSheetPrice(Number(e.target.value))}
                        className="w-full bg-background border border-panel-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  {addShiftError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                      ⚠️ {addShiftError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddShift(false)}
                      disabled={addingShift}
                      className="px-3 py-1.5 rounded-xl border border-panel-border text-xs font-semibold hover:bg-neutral-500/10 cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingShift}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {addingShift ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Saving Shift...</span>
                        </>
                      ) : (
                        <>Confirm &amp; Save Shift</>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Desk Sheet Addon Section */}
              <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="enableSheet"
                      checked={hasSheetEnabled}
                      onChange={(e) => setHasSheetEnabled(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="enableSheet" className="text-xs font-bold text-amber-900 dark:text-amber-200 cursor-pointer">
                      Enable White Desk Sheet Add-on Option
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-800/80 dark:text-amber-300/80 font-semibold">
                      Monthly Sheet Surcharge:
                    </span>
                    <div className="flex items-center gap-1 font-mono font-black text-sm text-amber-700 dark:text-amber-300">
                      <span>₹</span>
                      <input
                        type="number"
                        value={sheetPriceMonthly}
                        onChange={(e) => setSheetPriceMonthly(Number(e.target.value))}
                        className="w-20 bg-background border border-panel-border rounded-lg px-2 py-1 text-xs font-mono text-text-main text-right"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800/70 dark:text-amber-300/70">
                  When enabled, students onboarding at the door QR or front desk can opt into clean desk sheet protection.
                </p>
              </div>

              {/* Renewal Price Protection (Grandfathering) Toggle */}
              <div className="p-4 rounded-2xl bg-background border border-panel-border flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🛡️</span>
                    <h4 className="text-sm font-bold text-foreground">Renewal Price Protection (Grandfathering)</h4>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-xl">
                    When enabled, existing students renewing their passes keep their historical fee rate even if new shift prices have increased. Front desk staff can choose between their loyalty rate or the new standard rate with 1 click.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={priceProtectionEnabled}
                    onChange={(e) => setPriceProtectionEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>

              {/* Shift Collision & Seat Color Guidelines Card */}
              {(() => {
                const halfShifts = shifts.filter((s) => s.id !== "full_day");
                const clashes: Array<{ shiftA: string; shiftB: string }> = [];
                for (let i = 0; i < halfShifts.length; i++) {
                  for (let j = i + 1; j < halfShifts.length; j++) {
                    if (doShiftsClash(halfShifts[i].id, halfShifts[j].id, shifts)) {
                      clashes.push({ shiftA: halfShifts[i].name, shiftB: halfShifts[j].name });
                    }
                  }
                }

                return (
                  <div className="p-4 rounded-2xl bg-background border border-panel-border space-y-3">
                    <div className="flex items-center justify-between border-b border-panel-border pb-2.5">
                      <div className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
                        <span>🚦</span> Shift Collision &amp; Seat Color Rules
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-500/10 text-text-muted">
                        Real-Time Validation
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400">
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          RED: 1 Person Full Day
                        </div>
                        <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                          1 student bought the seat for the month/tenure. Entire seat is occupied.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          YELLOW: Shift Available
                        </div>
                        <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                          1 or more shifts occupied, yet you can still accommodate another person in that seat.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-400">
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          PURPLE: Full (Multiple Shifts)
                        </div>
                        <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                          Multiple students occupied different shifts and seat is 100% full. No one else can fit.
                        </p>
                      </div>
                    </div>

                    {clashes.length > 0 ? (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>⚠️</span> Detected Overlapping Shifts:
                        </div>
                        <ul className="list-disc list-inside text-[11px] text-amber-700 dark:text-amber-300/90 pl-1 space-y-0.5">
                          {clashes.map((c, idx) => (
                            <li key={idx}>
                              <strong>{c.shiftA}</strong> and <strong>{c.shiftB}</strong> overlap in time. The system will prevent booking both on the same seat.
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                        <span>✓</span> All half-day shifts are complementary and non-overlapping! Multiple students can cleanly share seats without conflict.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action Bar for Seats & Shifts */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-panel-border">
                {saveSuccess ? (
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                    <span>✅</span> Shifts &amp; seat capacity saved successfully!
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">
                    Changes apply immediately to your Desk Seat Matrix, Door QR Join Form, and Walk-in Billings.
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Save Shifts &amp; Capacity</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Seat Matrix Layout & Desktop Fit Settings */}
        {activeTab === "matrix_layout" && (
          <div className="space-y-6">
            {/* Notification Banner */}
            {matrixSaveSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span>✅</span>
                  <span>Seat matrix display layout preferences saved! Your front desk is updated.</span>
                </div>
                <Link
                  href={`/l/${slug}`}
                  className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition"
                >
                  View Desk →
                </Link>
              </div>
            )}

            {/* Header Hero Card */}
            <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-panel-border pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🖥️</span>
                    <h2 className="text-lg font-black tracking-tight">
                      Real-Time Seat Matrix Layout & Screen Fit
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      Front Desk Display
                    </span>
                  </div>
                  <p className="text-xs text-text-muted max-w-2xl leading-relaxed">
                    Configure how the cinema seat matrix renders on desktop screens at the front desk reception.
                    Choose auto-fit to comfortably display all 200–300 seats on a single screen without vertical scrolling, or fine-tune tile size and monitor width.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSaveMatrixDisplay()}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>💾</span> Save Layout Preferences
                  </button>
                </div>
              </div>

              {/* Sizing Presets Selection Grid */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-black text-text-main uppercase tracking-wider">
                  Select Seat Matrix Sizing Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Preset 1: Fit Screen */}
                  <button
                    type="button"
                    onClick={() => {
                      setMatrixPreset("fit");
                      handleSaveMatrixDisplay("fit", matrixTileSize, matrixIsWide);
                    }}
                    className={`p-4 rounded-2xl border text-left transition relative cursor-pointer ${
                      matrixPreset === "fit"
                        ? "bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                        : "bg-background border-panel-border hover:border-neutral-400"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base font-black flex items-center gap-1.5">
                        <span>🖥️</span> Fit to Screen
                      </span>
                      {matrixPreset === "fit" && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      )}
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 inline-block mb-1.5">
                      ★ Recommended
                    </span>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Auto-calculates columns and height based on your desktop monitor. All 200–300 seats fit vertically with zero page scrolling.
                    </p>
                  </button>

                  {/* Preset 2: Compact */}
                  <button
                    type="button"
                    onClick={() => {
                      setMatrixPreset("compact");
                      setMatrixTileSize(36);
                      handleSaveMatrixDisplay("compact", 36, matrixIsWide);
                    }}
                    className={`p-4 rounded-2xl border text-left transition relative cursor-pointer ${
                      matrixPreset === "compact"
                        ? "bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                        : "bg-background border-panel-border hover:border-neutral-400"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base font-black flex items-center gap-1.5">
                        <span>📐</span> Compact
                      </span>
                      {matrixPreset === "compact" && (
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      )}
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-neutral-500/15 text-text-muted inline-block mb-1.5">
                      36px Tiles (~20 cols)
                    </span>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      High-density matrix layout. Ideal for reception desks managing over 250 seats with maximum overview density.
                    </p>
                  </button>

                  {/* Preset 3: Standard */}
                  <button
                    type="button"
                    onClick={() => {
                      setMatrixPreset("standard");
                      setMatrixTileSize(54);
                      handleSaveMatrixDisplay("standard", 54, matrixIsWide);
                    }}
                    className={`p-4 rounded-2xl border text-left transition relative cursor-pointer ${
                      matrixPreset === "standard"
                        ? "bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                        : "bg-background border-panel-border hover:border-neutral-400"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base font-black flex items-center gap-1.5">
                        <span>📏</span> Standard
                      </span>
                      {matrixPreset === "standard" && (
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      )}
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-neutral-500/15 text-text-muted inline-block mb-1.5">
                      54px Tiles (12 cols)
                    </span>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Classic balanced matrix grid. Great for standard desktop monitors or libraries with under 150 seats.
                    </p>
                  </button>

                  {/* Preset 4: Large */}
                  <button
                    type="button"
                    onClick={() => {
                      setMatrixPreset("large");
                      setMatrixTileSize(72);
                      handleSaveMatrixDisplay("large", 72, matrixIsWide);
                    }}
                    className={`p-4 rounded-2xl border text-left transition relative cursor-pointer ${
                      matrixPreset === "large"
                        ? "bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                        : "bg-background border-panel-border hover:border-neutral-400"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base font-black flex items-center gap-1.5">
                        <span>🔍</span> Large
                      </span>
                      {matrixPreset === "large" && (
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      )}
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-neutral-500/15 text-text-muted inline-block mb-1.5">
                      72px Tiles (8 cols)
                    </span>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Spacious, bold touch targets. Ideal for touch screen monitors, iPad kiosks, or wall monitors viewed from a distance.
                    </p>
                  </button>
                </div>
              </div>

              {/* Fine-Tuning Slider & Steppers */}
              <div className="pt-4 border-t border-panel-border grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-text-main uppercase tracking-wider">
                      Fine-Tune Tile Size
                    </label>
                    <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                      {matrixTileSize}px
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-background border border-panel-border">
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.max(26, matrixTileSize - 4);
                        setMatrixPreset("custom");
                        setMatrixTileSize(next);
                        handleSaveMatrixDisplay("custom", next, matrixIsWide);
                      }}
                      disabled={matrixTileSize <= 26}
                      className="w-8 h-8 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 flex items-center justify-center font-black text-base cursor-pointer disabled:opacity-30"
                      title="Shrink seat tiles"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={26}
                      max={84}
                      step={2}
                      value={matrixTileSize}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setMatrixPreset("custom");
                        setMatrixTileSize(next);
                        handleSaveMatrixDisplay("custom", next, matrixIsWide);
                      }}
                      className="flex-1 accent-rose-600 cursor-pointer h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.min(84, matrixTileSize + 4);
                        setMatrixPreset("custom");
                        setMatrixTileSize(next);
                        handleSaveMatrixDisplay("custom", next, matrixIsWide);
                      }}
                      disabled={matrixTileSize >= 84}
                      className="w-8 h-8 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 flex items-center justify-center font-black text-base cursor-pointer disabled:opacity-30"
                      title="Enlarge seat tiles"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Adjusting the slider sets custom mode with your exact preferred button width and height.
                  </p>
                </div>

                {/* Monitor Width Toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-text-main uppercase tracking-wider block">
                    Desktop Screen Width Mode
                  </label>
                  <div className="p-3 rounded-2xl bg-background border border-panel-border flex items-center justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
                        <span>↔️</span> Expanded Wide Monitor (98vw)
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Spreads seats across the entire 1080p/2K desktop monitor width (24–28 cols).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={matrixIsWide}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setMatrixIsWide(next);
                        handleSaveMatrixDisplay(matrixPreset, matrixTileSize, next);
                      }}
                      className="w-5 h-5 accent-rose-600 rounded cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Recommended for wide reception monitors so seats take up minimal vertical rows.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Interactive Simulator Card */}
            <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-panel-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎮</span>
                  <h3 className="font-black text-sm">Live Real-Time Seat Matrix Preview</h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-mono text-text-muted">
                    Active Mode: <strong className="text-rose-600 dark:text-rose-400 capitalize">{matrixPreset}</strong> ({matrixTileSize}px)
                  </span>
                </div>
              </div>

              {/* Status Color Legend */}
              <div className="flex items-center gap-2 flex-wrap text-[11px] pb-1">
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-950 font-bold border border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20">
                  🟢 Free (Available)
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-950 font-bold border border-rose-400 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20">
                  🔴 Full Day
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 font-bold border border-amber-400 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20">
                  🟡 Half Day
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-950 font-bold border border-purple-400 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/20">
                  🟣 2x Shift Split
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-950 font-bold border border-blue-400 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20">
                  🔵 Overdue Fee
                </span>
              </div>

              {/* Simulated Seat Grid */}
              <div className="p-4 rounded-2xl bg-background border border-dashed border-panel-border overflow-hidden">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      matrixPreset === "fit"
                        ? `repeat(auto-fill, minmax(38px, 1fr))`
                        : matrixPreset === "compact"
                        ? `repeat(auto-fill, minmax(36px, 1fr))`
                        : matrixPreset === "standard"
                        ? `repeat(auto-fill, minmax(54px, 1fr))`
                        : matrixPreset === "large"
                        ? `repeat(auto-fill, minmax(72px, 1fr))`
                        : `repeat(auto-fill, minmax(${matrixTileSize}px, 1fr))`,
                    gap: matrixTileSize < 36 ? "4px" : "6px",
                  }}
                  className="w-full transition-all duration-200"
                >
                  {Array.from({ length: 36 }).map((_, idx) => {
                    const seatNum = idx + 1;
                    const isDue = seatNum === 4 || seatNum === 19;
                    const isFull = seatNum === 2 || seatNum === 8 || seatNum === 14 || seatNum === 22 || seatNum === 29;
                    const isHalf = seatNum === 5 || seatNum === 11 || seatNum === 25 || seatNum === 33;
                    const isDouble = seatNum === 7 || seatNum === 17 || seatNum === 31;
                    const isFree = !isDue && !isFull && !isHalf && !isDouble;

                    let colorClass = "bg-emerald-100 text-emerald-950 border-2 border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border dark:border-emerald-500/20";
                    let badge = "";
                    if (isDue) {
                      colorClass = "bg-blue-100 text-blue-950 border-2 border-blue-400 dark:bg-blue-500/15 dark:text-blue-400 dark:border dark:border-blue-500/40";
                      badge = "Due";
                    } else if (isDouble) {
                      colorClass = "bg-purple-100 text-purple-950 border-2 border-purple-400 dark:bg-purple-500/15 dark:text-purple-300 dark:border dark:border-purple-500/40";
                      badge = "2x";
                    } else if (isFull) {
                      colorClass = "bg-rose-100 text-rose-950 border-2 border-rose-400 dark:bg-rose-500/10 dark:text-rose-400 dark:border dark:border-rose-500/20";
                    } else if (isHalf) {
                      colorClass = "bg-amber-100 text-amber-950 border-2 border-amber-400 dark:bg-amber-500/10 dark:text-amber-400 dark:border dark:border-amber-500/20";
                    }

                    const isTiny = matrixTileSize < 34;
                    const isSmall = matrixTileSize >= 34 && matrixTileSize < 46;

                    return (
                      <div
                        key={seatNum}
                        style={{
                          height: matrixPreset === "fit" ? "38px" : `${matrixTileSize}px`,
                        }}
                        className={`rounded-lg flex flex-col items-center justify-center p-0.5 font-bold transition-all shadow-xs ${colorClass}`}
                      >
                        <span
                          className={`font-mono leading-none ${
                            isTiny
                              ? "text-[9px] font-extrabold"
                              : isSmall
                              ? "text-[11px] font-extrabold"
                              : "text-xs font-black"
                          }`}
                        >
                          {seatNum}
                        </span>
                        {!isTiny && badge && (
                          <span className="text-[7px] font-black uppercase tracking-tighter leading-none mt-0.5">
                            {badge}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Link to Desk */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-text-muted">
                  The front desk reception view automatically synchronizes with these saved preferences.
                </p>
                <Link
                  href={`/l/${slug}`}
                  className="px-4 py-2 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <span>←</span> Return to Front Desk
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Soundbox & UPI Setup */}
        {activeTab === "upi_soundbox" && (
          <div className="space-y-6">
            <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <span>🔊</span> Desk Soundbox & UPI Integration (Method B)
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Direct bank deposits with 0% payment gateway fees. All entrance student payments credit directly to your account.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Desk UPI ID / VPA *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. targetlibrary@upi or 9876543210@paytm"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    The UPI ID linked to your desk Paytm, PhonePe, or Google Pay Soundbox.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Merchant / Owner Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. The Target Library"
                    value={upiName}
                    onChange={(e) => setUpiName(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    Displayed in the student&apos;s UPI app when they pay fees.
                  </p>
                </div>
              </div>

              {/* How it works info banner */}
              <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-2 text-xs">
                <div className="font-bold flex items-center gap-1.5 text-text-main">
                  <span>ℹ️</span> How Soundbox Verification Works:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-text-muted text-[11px] leading-relaxed">
                  <li>Student scans the front door QR poster and pays ₹600 via their UPI app.</li>
                  <li>Your physical desk soundbox speaks aloud: <em>&quot;Paytm par chhe sau rupaye praapt hue&quot;</em>.</li>
                  <li>Student submits their 12-digit UTR reference number into the app.</li>
                  <li>Desk staff sees the incoming request alert on their screen, verifies the UTR, and clicks <strong>Approve</strong> to assign a seat.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: General Library Details */}
        {activeTab === "general" && (
          <div className="space-y-6">
            <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <span>🏢</span> Library Brand & Contact Profile
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Information displayed on student digital wallet cards, invoices, and passes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Library Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    City / Branch
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Official Helpdesk Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Full Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Staff & Owner Passwords Management */}
        {activeTab === "passwords" && (
          <div className="space-y-6">
            {passwordErrorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                <span>⚠️</span> {passwordErrorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Front-Desk Staff Passcode */}
              <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                        💻
                      </span>
                      <div>
                        <h3 className="font-extrabold text-sm text-text-main">
                          Desk Staff Passcode
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          Receptionist Access
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed mb-5">
                    Give this password to your front-desk librarians and staff. They can manage the seat grid, admit students, and create receipts, but <span className="font-semibold text-text-main">cannot</span> change pricing or view owner revenue settings.
                  </p>

                  <form onSubmit={handleUpdateStaffPassword} className="space-y-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                          New Staff Passcode
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowNewStaffPass((prev) => !prev)}
                          className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer select-none"
                        >
                          <span>{showNewStaffPass ? "🙈 Hide" : "👁️ Show"}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showNewStaffPass ? "text" : "password"}
                          placeholder="e.g. 1234 or staff2026"
                          value={newStaffPassword}
                          onChange={(e) => setNewStaffPassword(e.target.value)}
                          required
                          className="w-full bg-background border border-panel-border rounded-xl pl-3 pr-10 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewStaffPass((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main text-sm transition select-none cursor-pointer"
                          title={showNewStaffPass ? "Hide password" : "Show password"}
                          aria-label={showNewStaffPass ? "Hide password" : "Show password"}
                        >
                          {showNewStaffPass ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        Confirm Staff Passcode
                      </label>
                      <input
                        type={showNewStaffPass ? "text" : "password"}
                        placeholder="Re-enter passcode"
                        value={confirmStaffPassword}
                        onChange={(e) => setConfirmStaffPassword(e.target.value)}
                        required
                        className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                      />
                    </div>

                    {staffPassSuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                        <span>✅</span> Staff passcode updated successfully!
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingStaffPass || !newStaffPassword.trim()}
                      className="w-full mt-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {savingStaffPass ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Saving Staff Passcode...
                        </>
                      ) : (
                        <>🔑 Update Staff Passcode</>
                      )}
                    </button>
                  </form>
                </div>

                <div className="mt-4 pt-3 border-t border-panel-border text-[11px] text-text-muted">
                  Default: <span className="font-mono font-semibold">Target2026</span>
                </div>
              </div>

              {/* Card 2: Library Owner Master Password */}
              <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                        👑
                      </span>
                      <div>
                        <h3 className="font-extrabold text-sm text-text-main">
                          Owner Master Password
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          Owner Full Access
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed mb-5">
                    This master password unlocks your Library Settings, Shift Timings, Soundbox UPI ID, and Fee Configuration. Keep this strictly private.
                  </p>

                  <form onSubmit={handleUpdateOwnerPassword} className="space-y-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                          New Owner Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowNewOwnerPass((prev) => !prev)}
                          className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer select-none"
                        >
                          <span>{showNewOwnerPass ? "🙈 Hide" : "👁️ Show"}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showNewOwnerPass ? "text" : "password"}
                          placeholder="Enter secure master password"
                          value={newOwnerPassword}
                          onChange={(e) => setNewOwnerPassword(e.target.value)}
                          required
                          className="w-full bg-background border border-panel-border rounded-xl pl-3 pr-10 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewOwnerPass((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main text-sm transition select-none cursor-pointer"
                          title={showNewOwnerPass ? "Hide password" : "Show password"}
                          aria-label={showNewOwnerPass ? "Hide password" : "Show password"}
                        >
                          {showNewOwnerPass ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </div>

                    {ownerPassSuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                        <span>✅</span> Owner password updated successfully!
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingOwnerPass || !newOwnerPassword.trim()}
                      className="w-full mt-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {savingOwnerPass ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Saving Master Password...
                        </>
                      ) : (
                        <>🛡️ Update Master Password</>
                      )}
                    </button>
                  </form>
                </div>

                <div className="mt-4 pt-3 border-t border-panel-border text-[11px] text-text-muted">
                  Default: <span className="font-mono font-semibold">TargetOwner2026</span>
                </div>
              </div>
            </div>

            {/* Security Advisory Callout */}
            <div className="bg-neutral-500/5 border border-panel-border rounded-2xl p-4 text-xs text-text-muted flex items-start gap-3">
              <span className="text-base">💡</span>
              <p className="leading-relaxed">
                <span className="font-bold text-text-main">Instant Credential Sync:</span> Password updates take effect immediately across all sessions. Staff and owner can log in with their newly assigned credentials from the universal login portal or direct library link.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: Front Door Entrance QR Poster (Printable A4 Sheet) */}
        {activeTab === "poster" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm print:hidden">
              <div>
                <h3 className="font-extrabold text-sm text-text-main flex items-center gap-2">
                  <span>🖨️</span> Printable Entrance Door Poster & Studio
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    Studio Available
                  </span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Print this A4 sheet for your front glass door, or launch the multi-template studio for tent cards &amp; Wi-Fi stands.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/l/${slug}/print`}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5"
                >
                  <span>✨</span> Open Full Print Studio ↗
                </Link>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-text-main font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <span>🖨️</span> Print Quick A4
                </button>
              </div>
            </div>

            {/* Poster Sheet View */}
            <div className="bg-white text-neutral-900 border-2 border-neutral-300 rounded-3xl p-8 max-w-xl mx-auto text-center shadow-xl print:border-none print:shadow-none print:p-4 print:max-w-none">
              <div className="flex justify-center mb-3">
                <LibraryLogo
                  slug={slug}
                  logoUrl={logoUrl || library.logo_url}
                  name={name || library.name}
                  size="2xl"
                  className="shadow-md"
                />
              </div>

              <h1 className="text-3xl font-black tracking-tight text-neutral-900">
                {name || library.name}
              </h1>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mt-1">
                📍 {address || city || "Dehradun"} • Self-Service Admission Desk
              </p>

              <div className="my-6 p-6 rounded-2xl bg-neutral-50 border border-neutral-200 inline-block shadow-inner">
                <img
                  src={entranceQrImage}
                  alt="Entrance QR Code"
                  className="w-64 h-64 mx-auto rounded-xl shadow-sm border border-neutral-200"
                />
                <div className="text-[11px] font-mono text-neutral-500 mt-2">
                  Scan with any Phone Camera or QR Scanner
                </div>
              </div>

              {/* 4 Easy Steps */}
              <div className="text-left bg-neutral-100 rounded-2xl p-4.5 border border-neutral-200 max-w-md mx-auto space-y-2.5">
                <div className="font-extrabold text-xs text-neutral-900 uppercase tracking-wider text-center mb-1">
                  ⚡ 4 Simple Steps to Get Your Seat:
                </div>
                <div className="flex items-start gap-2.5 text-xs text-neutral-700">
                  <span className="font-black text-rose-600">1.</span>
                  <span><strong>Scan this QR</strong> on your phone to open the admission form.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-neutral-700">
                  <span className="font-black text-rose-600">2.</span>
                  <span><strong>Choose your shift</strong> (Morning, Evening, Night, or Full Day).</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-neutral-700">
                  <span className="font-black text-rose-600">3.</span>
                  <span><strong>Pay fee via UPI</strong> (GPay, PhonePe, Paytm, or BHIM).</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-neutral-700">
                  <span className="font-black text-rose-600">4.</span>
                  <span><strong>Show desk staff</strong> your UTR confirmation to receive your seat number!</span>
                </div>
              </div>

              <div className="text-[10px] text-neutral-400 mt-6 font-mono">
                Direct URL: {entranceJoinUrl}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Custom Domain & Subdomain Management */}
        {activeTab === "domains" && (
          <div className="space-y-6">
            {/* Header Description */}
            <div className="bg-card-bg border border-panel-border rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-panel-border pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl shadow-inner">
                    🌐
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                      Custom Domains & Dedicated Subdomain
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      White-label your library with an instant .libraryos.in address or your own custom branded domain.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    isDomainVerified
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isDomainVerified ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`} />
                    {isDomainVerified ? "Custom Domain Verified" : "Subdomain Active"}
                  </span>
                </div>
              </div>

              {/* Feedback messages */}
              {domainSaveSuccess && (
                <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                  <span>✅</span> Domain preferences saved successfully!
                </div>
              )}

              {domainErrorMessage && (
                <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                  <span>⚠️</span> {domainErrorMessage}
                </div>
              )}

              {domainVerifyResult && (
                <div className={`mt-4 p-3.5 rounded-2xl border text-xs font-bold flex items-start gap-2.5 animate-in fade-in duration-200 ${
                  domainVerifyResult.verified
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
                }`}>
                  <span className="text-base shrink-0">{domainVerifyResult.verified ? "✅" : "⏳"}</span>
                  <div className="leading-relaxed">{domainVerifyResult.details}</div>
                </div>
              )}

              <form onSubmit={handleSaveDomain} className="space-y-6 pt-5">
                {/* 1. Free Subdomain */}
                <div className="p-5 rounded-2xl bg-background border border-panel-border space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                        <span>⚡</span> Option 1: Instant Free Subdomain
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Zero Setup Required
                        </span>
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        Your library is immediately accessible on this unique web address.
                      </p>
                    </div>

                    {subdomainInput && (
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                        https://{subdomainInput}.libraryos.in
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-text-muted select-none">https://</span>
                    <input
                      type="text"
                      value={subdomainInput}
                      onChange={(e) => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="target"
                      className="px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-panel-border bg-input-bg focus:border-rose-500 focus:outline-none w-48"
                    />
                    <span className="text-xs font-mono text-text-muted select-none">.libraryos.in</span>
                  </div>
                </div>

                {/* 2. Custom Domain (White-Label) */}
                <div className="p-5 rounded-2xl bg-background border border-panel-border space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                        <span>🏷️</span> Option 2: Custom Branded Domain
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                          100% White-Label
                        </span>
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        Connect your own apex domain (e.g. <code>thetargetlibrary.in</code>) or subdomain (e.g. <code>study.mysite.com</code>).
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      type="text"
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value)}
                      placeholder="e.g. thetargetlibrary.in or study.yourlibrary.com"
                      className="flex-1 px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-panel-border bg-input-bg focus:border-rose-500 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={handleVerifyDomain}
                      disabled={verifyingDomain || !customDomainInput.trim()}
                      className="px-4 py-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {verifyingDomain ? "Verifying DNS..." : "🔍 Check DNS Records"}
                    </button>
                  </div>
                </div>

                {/* 3. DNS Instructions Assistant */}
                <div className="p-5 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-3 text-xs">
                  <h4 className="font-extrabold text-foreground flex items-center gap-2">
                    <span>📋</span> DNS Configuration Guide (GoDaddy, Namecheap, Cloudflare)
                  </h4>
                  <p className="text-text-muted text-[11px] leading-relaxed">
                    To point your custom domain, log into your DNS registrar, add the following CNAME record, and wait 5–10 minutes for global DNS caching:
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono border-collapse bg-card-bg rounded-xl border border-panel-border">
                      <thead>
                        <tr className="border-b border-panel-border text-text-muted text-[10px] uppercase">
                          <th className="p-2.5">Record Type</th>
                          <th className="p-2.5">Name / Host</th>
                          <th className="p-2.5">Target / Value</th>
                          <th className="p-2.5">TTL</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-2.5 font-bold text-rose-600">CNAME</td>
                          <td className="p-2.5 font-bold text-foreground">
                            {customDomainInput && customDomainInput.includes(".") && customDomainInput.split(".").length > 2
                              ? customDomainInput.split(".")[0]
                              : "@"}
                          </td>
                          <td className="p-2.5 font-bold text-indigo-600">cname.vercel-dns.com</td>
                          <td className="p-2.5 text-text-muted">Auto / 300s</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Save Domain Changes Button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingDomain}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs shadow-md shadow-rose-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {savingDomain ? "Saving..." : "💾 Save Domain Settings"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Backup & Export Tab */}
        {activeTab === "backup" && (
          <div className="rounded-2xl border border-panel-border bg-panel-bg shadow-sm overflow-hidden animate-fade-in">
            <div className="border-b border-panel-border px-6 py-4 flex items-center justify-between bg-neutral-500/5">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <span>📊</span> Complete Data Backup & Export
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Export all your members, payment receipts, and expenses into Microsoft Excel (.xlsx) and CSV formats.
                </p>
              </div>
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                100% Data Ownership
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Main Excel Backup Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📗</span>
                    <h3 className="text-sm font-extrabold text-foreground">
                      Complete Multi-Sheet Excel Workbook (.xlsx)
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Downloads an all-in-one spreadsheet containing 3 dedicated sheets: 
                    <strong className="text-foreground"> Members Register</strong>, 
                    <strong className="text-foreground"> Receipts & Billing</strong>, and 
                    <strong className="text-foreground"> Daily Expenses</strong> with formatted columns, totals, and timestamps.
                  </p>
                </div>
                <a
                  href={`/api/libraries/${slug}/export?format=xlsx`}
                  download
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-600/20 transition active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer text-center"
                >
                  <span>📥</span> Download Full Excel Backup (.xlsx)
                </a>
              </div>

              {/* Individual CSV Exports */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-text-muted">
                  Individual Module Exports (CSV Format)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Members CSV */}
                  <div className="p-4 rounded-xl border border-panel-border bg-background flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👥</span>
                        <h5 className="text-xs font-bold text-foreground">Members Register</h5>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1">
                        All student profiles, contact info, seats, time slots, and admission status.
                      </p>
                    </div>
                    <a
                      href={`/api/libraries/${slug}/export?format=csv&sheet=members`}
                      download
                      className="px-3 py-2 rounded-lg border border-panel-border hover:border-emerald-500/50 hover:bg-emerald-500/5 text-foreground text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
                    >
                      <span>📄</span> Export Members (.csv)
                    </a>
                  </div>

                  {/* Receipts CSV */}
                  <div className="p-4 rounded-xl border border-panel-border bg-background flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🧾</span>
                        <h5 className="text-xs font-bold text-foreground">Receipts & Fees</h5>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1">
                        All fee collection transactions, payment modes (Cash/UPI), dues, and dates.
                      </p>
                    </div>
                    <a
                      href={`/api/libraries/${slug}/export?format=csv&sheet=receipts`}
                      download
                      className="px-3 py-2 rounded-lg border border-panel-border hover:border-emerald-500/50 hover:bg-emerald-500/5 text-foreground text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
                    >
                      <span>📄</span> Export Receipts (.csv)
                    </a>
                  </div>

                  {/* Expenses CSV */}
                  <div className="p-4 rounded-xl border border-panel-border bg-background flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💸</span>
                        <h5 className="text-xs font-bold text-foreground">Daily Expenses</h5>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1">
                        Electricity, rent, Wi-Fi, maintenance, tea, and miscellaneous operational costs.
                      </p>
                    </div>
                    <a
                      href={`/api/libraries/${slug}/export?format=csv&sheet=expenses`}
                      download
                      className="px-3 py-2 rounded-lg border border-panel-border hover:border-emerald-500/50 hover:bg-emerald-500/5 text-foreground text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
                    >
                      <span>📄</span> Export Expenses (.csv)
                    </a>
                  </div>
                </div>
              </div>

              {/* Data Safety & Accounting Compatibility */}
              <div className="p-4 rounded-xl bg-neutral-500/5 border border-panel-border space-y-2 text-xs">
                <h4 className="font-extrabold text-foreground flex items-center gap-2">
                  <span>🔒</span> Data Portability & Accounting Compatibility
                </h4>
                <p className="text-text-muted leading-relaxed">
                  Your data belongs solely to you. You can export these files anytime to create offline archives, 
                  perform tax audits, or directly import data into accounting software like 
                  <span className="font-semibold text-foreground"> TallyPrime, Zoho Books, or Marg ERP</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: Subscription & SaaS Billing Suite */}
        {activeTab === "billing" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Hero Subscription Status Card */}
            <div className="bg-card-bg border-2 border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-panel-border pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-3xl shrink-0">
                    💳
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-black text-text-main tracking-tight">
                        Subscription &amp; Platform License
                      </h2>
                      {access.isTrial ? (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          7-Day Free Trial ({access.trialDaysRemaining} days left)
                        </span>
                      ) : access.status === "active" ? (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          Active Plan ({access.subscriptionDaysRemaining} days remaining)
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          Expired / Renewal Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      Manage your LibraryOS software license, renewal dates, and instant payment receipts.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBillingPaymentModal(true)}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>⚡</span> Pay &amp; Activate Early 🚀
                </button>
              </div>

              {/* Status & Plan Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-1">
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Current Plan</span>
                  <div className="text-lg font-black text-foreground">
                    Flat Monthly Pro
                  </div>
                  <p className="text-xs text-text-muted font-medium">₹599 / month flat</p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-1">
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">License Expiry</span>
                  <div className="text-lg font-black text-foreground">
                    {access.isTrial
                      ? `${access.trialDaysRemaining} Days Left`
                      : library.subscription_ends_at
                        ? new Date(library.subscription_ends_at).toLocaleDateString("en-IN", { dateStyle: "medium" })
                        : "Lifetime Active"}
                  </div>
                  <p className="text-xs text-text-muted font-medium">
                    {access.isTrial ? "Trial Evaluation Phase" : "Automatic data preservation guaranteed"}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-1">
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Total Seats Managed</span>
                  <div className="text-lg font-black text-foreground">
                    {totalSeats} Physical Seats
                  </div>
                  <p className="text-xs text-text-muted font-medium">Multi-shift &amp; sheet configs included</p>
                </div>
              </div>

              {/* Instant In-Person Field Sales Payment Info Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-card-bg to-emerald-500/5 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-foreground flex items-center gap-1.5 text-sm">
                    <span>📱</span> Instant On-The-Spot Payment (UPI QR)
                  </h4>
                  <p className="text-text-muted leading-relaxed max-w-xl">
                    Want to pay right now on the spot? Click the button to scan our official dynamic UPI QR code with GPay, PhonePe, or Paytm and attach your transaction screenshot. Our team will verify and add 30 days instantly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBillingPaymentModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white font-bold text-xs shadow-sm transition active:scale-95 shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📷</span> Scan QR &amp; Upload Screenshot
                </button>
              </div>

              {/* Data Safety & Founder Support */}
              <div className="pt-2 border-t border-panel-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Zero lock-in • 100% data preservation even if subscription expires</span>
                </div>
                <div>
                  Founder Desk Support:{" "}
                  <a href="tel:+918535035757" className="font-bold text-rose-600 hover:underline">
                    +91 8535035757
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Payment Modal */}
      <SubscriptionPaymentModal
        isOpen={showBillingPaymentModal}
        onClose={() => setShowBillingPaymentModal(false)}
        library={library}
        onSuccess={loadSettings}
      />

      {/* Shift Migration & Safety Modal */}
      {shiftToMigrate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-panel-bg border border-panel-border rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Active Students Enrolled in Shift
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Cannot directly delete <span className="font-semibold text-foreground">"{shiftToMigrate.name}"</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShiftToMigrate(null)}
                className="text-text-muted hover:text-foreground text-sm p-1.5 rounded-lg hover:bg-neutral-500/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <div className="font-bold flex items-center gap-2 text-sm">
                <span>👥</span> {shiftEnrollmentCounts[shiftToMigrate.id] || 0} active student(s) currently occupy seats in this shift.
              </div>
              <p className="text-[11px] leading-relaxed text-text-muted">
                To prevent student passes and seat records from becoming orphaned, select a replacement shift. All currently active passes in "{shiftToMigrate.name}" will be cleanly migrated to the new shift.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                Select Destination Shift for Enrolled Students *
              </label>
              <select
                value={destinationShiftId}
                onChange={(e) => setDestinationShiftId(e.target.value)}
                className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-rose-500"
              >
                {shifts
                  .filter((s) => s.id !== shiftToMigrate.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.start_time} - {s.end_time}) — ₹{s.base_price}/mo
                    </option>
                  ))}
              </select>
            </div>

            {migrationError && (
              <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                {migrationError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShiftToMigrate(null)}
                disabled={migratingShift}
                className="px-4 py-2 rounded-xl border border-panel-border text-xs font-semibold text-text-muted hover:text-foreground transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteMigrationAndDelete}
                disabled={migratingShift || !destinationShiftId}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {migratingShift ? "Migrating..." : `Migrate ${shiftEnrollmentCounts[shiftToMigrate.id] || 0} Students & Delete Shift`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Shift Broadcast Modal */}
      {shiftToBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-panel-bg border border-panel-border rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
                  📢
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    WhatsApp Notice — {shiftToBroadcast.name}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {shiftEnrollmentCounts[shiftToBroadcast.id] || 0} active students in this shift
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShiftToBroadcast(null)}
                className="text-text-muted hover:text-foreground text-sm p-1.5 rounded-lg hover:bg-neutral-500/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Announcement Message Preview */}
            <div className="p-4 rounded-2xl bg-background border border-panel-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-text-muted uppercase text-[10px]">Announcement Template</span>
                <button
                  type="button"
                  onClick={() => {
                    const text = `*Notice from ${name || "LibraryOS"}*\n\nDear Student,\nPlease note that our schedule and fee structure for *${shiftToBroadcast.name}* (${shiftToBroadcast.start_time} - ${shiftToBroadcast.end_time}) has been updated.\n\n📌 Your active seat pass remains valid and unaffected until your renewal date.\nIf you have any questions, please contact the front desk.\nThank you!`;
                    navigator.clipboard.writeText(text);
                    setCopiedBroadcastText(true);
                    setTimeout(() => setCopiedBroadcastText(false), 2500);
                  }}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {copiedBroadcastText ? "✓ Copied to Clipboard" : "📋 Copy Announcement Text"}
                </button>
              </div>
              <p className="text-xs text-text-main font-mono bg-card-bg p-3 rounded-xl border border-panel-border whitespace-pre-wrap">
                {`*Notice from ${name || "LibraryOS"}*\n\nDear Student,\nPlease note that our schedule and fee structure for *${shiftToBroadcast.name}* (${shiftToBroadcast.start_time} - ${shiftToBroadcast.end_time}) has been updated.\n\n📌 Your active seat pass remains valid and unaffected until your renewal date.\nIf you have any questions, please contact the front desk.\nThank you!`}
              </p>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[150px]">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Active Enrolled Students ({shiftStudents[shiftToBroadcast.id]?.length || 0})
              </div>
              {(!shiftStudents[shiftToBroadcast.id] || shiftStudents[shiftToBroadcast.id].length === 0) ? (
                <p className="text-xs text-text-muted py-4 text-center">No active students enrolled in this shift.</p>
              ) : (
                shiftStudents[shiftToBroadcast.id].map((student: any) => {
                  const phone = (student.phone || "").replace(/[^0-9]/g, "").slice(-10);
                  const waText = encodeURIComponent(
                    `*Notice from ${name || "LibraryOS"}*\n\n` +
                    `Dear ${student.name},\n` +
                    `Please note that our schedule/fee structure for *${shiftToBroadcast.name}* (${shiftToBroadcast.start_time} - ${shiftToBroadcast.end_time}) has been updated.\n\n` +
                    `📌 *Your Current Pass:* Seat #${student.seat_number}, valid until ${student.end_date}.\n` +
                    `Your current subscription remains fully active and unaffected until your renewal date.\n\n` +
                    `For any queries, please visit the front desk.\nThank you!`
                  );
                  const waUrl = phone ? `https://wa.me/91${phone}?text=${waText}` : null;

                  return (
                    <div
                      key={student.receipt_no}
                      className="p-3 rounded-xl bg-card-bg border border-panel-border flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-foreground flex items-center gap-2">
                          {student.name}
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-500/10 text-text-muted">
                            Seat #{student.seat_number}
                          </span>
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {student.phone || "No phone"} • Valid till: {student.end_date} • Paid ₹{student.amount_paid}
                        </div>
                      </div>
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold transition flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          💬 Send WhatsApp
                        </a>
                      ) : (
                        <span className="text-[10px] text-text-muted italic">No phone</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-panel-border">
              <button
                type="button"
                onClick={() => setShiftToBroadcast(null)}
                className="px-5 py-2 rounded-xl bg-neutral-500/10 hover:bg-neutral-500/20 text-xs font-semibold text-text-main transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
