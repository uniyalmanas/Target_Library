"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import Link from "next/link";
import { Library, LibrarySettings, AdmissionRequest } from "@/lib/types";
import { FALLBACK_TARGET_LIBRARY, FALLBACK_SETTINGS, DEMO_LIBRARY, DEMO_SETTINGS, isDemoSlug, DEFAULT_LIBRARY_SLUG, DEFAULT_SHIFTS, getLibraryAccessStatus } from "@/lib/tenant";
import EditReceiptModal, { EditableReceipt } from "@/lib/EditReceiptModal";
import ThemeToggle from "@/lib/ThemeToggle";
import LibraryLogo from "@/lib/LibraryLogo";
import TenantAccessBarrier from "@/lib/TenantAccessBarrier";
import { getStoredSession, isSuperAdminAuthenticated, isOwnerAuthorizedForSlug } from "@/lib/auth";
import DynamicUpiModal from "@/lib/DynamicUpiModal";
import { generateDueFeeWhatsAppMessage } from "@/lib/upi";
import { getAvailableShiftsForSeat, getShiftDisplayLabel, sortShiftsChronologically, getShiftNameWithTiming, formatShiftTiming } from "@/lib/shifts";
import SubscriptionPaymentModal from "@/lib/SubscriptionPaymentModal";

interface MemberData {
  student_id: number;
  name: string;
  phone: string | null;
  aadhar_no?: string | null;
}

interface ReceiptData {
  receipt_no: number;
  student_id: number;
  subscription_type: "full_day" | "half_day";
  shift_type: string | null;
  has_sheet: boolean;
  amount_paid: number;
  start_date: string;
  end_date: string;
  is_vacated?: boolean;
  is_overdue?: boolean;
  days_overdue?: number;
  member: MemberData | null;
}

interface SeatData {
  seat_id: number;
  seat_number: number;
  occupied: boolean;
  is_overdue?: boolean;
  has_due?: boolean;
  is_double_shift?: boolean;
  status?: string;
  can_accommodate_another?: boolean;
  available_shifts?: any[];
  receipts: ReceiptData[];
}

type SizePreset = "fit" | "compact" | "standard" | "large" | "custom";

export default function TenantDeskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [library, setLibrary] = useState<Library>(() => {
    if (isDemoSlug(slug)) return DEMO_LIBRARY;
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`libraryos_cached_info_${slug}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.library) return parsed.library;
        }
      } catch {}
    }
    if (slug === DEFAULT_LIBRARY_SLUG) return FALLBACK_TARGET_LIBRARY;
    return {
      id: `tenant-${slug}`,
      slug,
      name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
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
  });
  const [settings, setSettings] = useState<LibrarySettings>(() => {
    if (isDemoSlug(slug)) return DEMO_SETTINGS;
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`libraryos_cached_info_${slug}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.settings) return parsed.settings;
        }
      } catch {}
    }
    return FALLBACK_SETTINGS;
  });
  const [seats, setSeats] = useState<SeatData[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`libraryos_cached_seats_${slug}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.seats) && parsed.seats.length > 0) {
            return parsed.seats;
          }
        }
      } catch {
        // ignore
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`libraryos_cached_seats_${slug}`);
        if (cached) return false;
      } catch {
        // ignore
      }
    }
    return true;
  });
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [justReconnected, setJustReconnected] = useState<boolean>(false);
  const [selected, setSelected] = useState<SeatData | null>(null);
  const [vacating, setVacating] = useState<number | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<EditableReceipt | null>(null);
  const [selectedUpiCandidate, setSelectedUpiCandidate] = useState<{
    receipt_no: number;
    student_id: number;
    student_name: string;
    student_phone: string | null;
    seat_number: number;
    shift_type: string | null;
    subscription_type: "full_day" | "half_day";
    amount_paid: number;
    end_date: string;
    days_overdue: number;
  } | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "double_shift" | "full_day" | "half_day" | "free" | "due">("all");

  // Seat Matrix Layout & Resizing States
  const [sizePreset, setSizePreset] = useState<SizePreset>("fit");
  const [tileSize, setTileSize] = useState<number>(44);
  const [computedCols, setComputedCols] = useState<number>(20);
  const [isWideLayout, setIsWideLayout] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const matrixContainerRef = useRef<HTMLDivElement>(null);

  // Incoming Admission Requests (Method B Entrance QR)
  const [admissionRequests, setAdmissionRequests] = useState<AdmissionRequest[]>([]);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [selectedSeatForApproval, setSelectedSeatForApproval] = useState<Record<string, number>>({});
  const [approvalFeedback, setApprovalFeedback] = useState<{ id: string; message: string; receiptNo?: number } | null>(null);

  // Floating / Flexible Students (Daily Vacancy Access)
  const [floatingStudents, setFloatingStudents] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`libraryos_cached_floating_${slug}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [showFloatingModal, setShowFloatingModal] = useState<boolean>(false);

  // User Authentication & Role Detection
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [showPayEarlyModal, setShowPayEarlyModal] = useState<boolean>(false);

  useEffect(() => {
    const isSuper = isSuperAdminAuthenticated();
    const isOwnerAuth = isOwnerAuthorizedForSlug(slug);
    const ownerAuth =
      typeof window !== "undefined" &&
      (sessionStorage.getItem("target_lib_owner_auth") === "true" ||
        localStorage.getItem("target_lib_owner_auth") === "true");
    const isDemo = isDemoSlug(slug);
    const session = getStoredSession();
    const hasOwner =
      isSuper ||
      session?.isMaster ||
      isOwnerAuth ||
      ownerAuth ||
      isDemo ||
      session?.role === "owner" ||
      session?.role === "superadmin";

    setIsOwner(Boolean(hasOwner));
  }, [slug]);

  // Load Library & Settings with Offline Resilience
  const loadInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/libraries/${slug}/settings`);
      if (res.ok) {
        const data = await res.json();
        if (data.library) setLibrary(data.library);
        if (data.settings) setSettings(data.settings);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              `libraryos_cached_info_${slug}`,
              JSON.stringify({
                timestamp: Date.now(),
                library: data.library,
                settings: data.settings,
              })
            );
          } catch {}
        }
      }
    } catch (e) {
      console.warn("Error loading tenant info (using offline fallback if present):", e);
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem(`libraryos_cached_info_${slug}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.library) setLibrary(parsed.library);
            if (parsed?.settings) setSettings(parsed.settings);
          }
        } catch {}
      }
    }
  }, [slug]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  // Master override for testing/troubleshooting and superadmin
  const [hasAdminOverride, setHasAdminOverride] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasAdminOverride(
        isSuperAdminAuthenticated() ||
        sessionStorage.getItem("target_lib_admin_override") === "true" ||
        localStorage.getItem("target_lib_admin_override") === "true"
      );
    }
  }, []);

  // Load Seats with Snapshot Caching
  const fetchSeats = useCallback(() => {
    fetch(`/api/seats?slug=${slug}`)
      .then((r) => r.json())
      .then((data) => {
        let loadedSeats: SeatData[] = Array.isArray(data) ? data : [];
        if (settings.total_seats && loadedSeats.length > settings.total_seats) {
          loadedSeats = loadedSeats.slice(0, settings.total_seats);
        }
        setSeats(loadedSeats);
        setLoading(false);
        if (typeof window !== "undefined" && loadedSeats.length > 0) {
          try {
            localStorage.setItem(
              `libraryos_cached_seats_${slug}`,
              JSON.stringify({
                timestamp: Date.now(),
                seats: loadedSeats,
              })
            );
          } catch (e) {
            console.warn("Could not save seats snapshot cache:", e);
          }
        }
      })
      .catch((err) => {
        console.warn("Network fetch failed for seats, checking local cache:", err);
        if (typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem(`libraryos_cached_seats_${slug}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed?.seats) && parsed.seats.length > 0) {
                setSeats(parsed.seats);
              }
            }
          } catch {}
        }
        setLoading(false);
      });
  }, [slug, settings.total_seats]);

  const fetchFloatingStudents = useCallback(async () => {
    try {
      const res = await fetch(`/api/receipts?slug=${encodeURIComponent(slug)}&shift_type=floating&active_only=true`);
      if (res.ok) {
        const data = await res.json();
        const loaded = Array.isArray(data) ? data : [];
        setFloatingStudents(loaded);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`libraryos_cached_floating_${slug}`, JSON.stringify(loaded));
          } catch {}
        }
      }
    } catch {
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem(`libraryos_cached_floating_${slug}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) setFloatingStudents(parsed);
          }
        } catch {}
      }
    }
  }, [slug]);

  useEffect(() => {
    fetchSeats();
    fetchFloatingStudents();
  }, [fetchSeats, fetchFloatingStudents]);

  // Online / Offline Network Listeners & Auto-Sync
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      fetchSeats();
      fetchFloatingStudents();
      loadInfo();
      setTimeout(() => setJustReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchSeats, fetchFloatingStudents, loadInfo]);

  // Sound Notification Chime for Incoming Entrance QR Admissions
  const playAdmissionChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Poll for Incoming Admission Requests
  const fetchAdmissionRequests = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const res = await fetch(`/api/admission-requests?slug=${slug}&status=pending`);
      if (res.ok) {
        const data = await res.json();
        const incoming: AdmissionRequest[] = data.requests || [];
        setAdmissionRequests((prev) => {
          if (incoming.length > prev.length && prev.length > 0) {
            playAdmissionChime();
          }
          return incoming;
        });
      }
    } catch {
      // Table may not exist yet or offline
    }
  };

  useEffect(() => {
    fetchAdmissionRequests();
    const interval = setInterval(fetchAdmissionRequests, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [slug]);

  // Close Seat Details modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selected) setSelected(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

  // Handle Approve Admission Request
  const handleApproveRequest = async (req: AdmissionRequest) => {
    const seatId = selectedSeatForApproval[req.id];
    if (!seatId) {
      alert("Please select an available seat number for this student.");
      return;
    }

    setApprovingRequestId(req.id);
    try {
      const res = await fetch("/api/admission-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: req.id,
          status: "approved",
          seat_id: seatId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");

      setApprovalFeedback({
        id: req.id,
        message: `Approved! Seat #${seatId} assigned to ${req.student_name}.`,
        receiptNo: data.receipt_no,
      });

      // Refresh seats and admission queue
      fetchSeats();
      fetchAdmissionRequests();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApprovingRequestId(null);
    }
  };

  // Handle Reject Admission Request
  const handleRejectRequest = async (id: string) => {
    if (!confirm("Are you sure you want to reject this admission request?")) return;
    try {
      const res = await fetch("/api/admission-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected" }),
      });
      if (res.ok) {
        fetchAdmissionRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Seat classification helpers
  const isSeatFullDay = (s: SeatData) =>
    s.occupied &&
    !s.is_overdue &&
    s.status !== "due" &&
    s.status !== "partial_due" &&
    (s.status === "full_day" || s.receipts?.some((r) => r.subscription_type === "full_day"));

  const isSeatDoubleShift = (s: SeatData) =>
    s.occupied &&
    !s.is_overdue &&
    s.status !== "due" &&
    s.status !== "partial_due" &&
    !isSeatFullDay(s) &&
    (s.status === "double_shift" || s.can_accommodate_another === false || s.is_double_shift === true);

  const isSeatHalfDay = (s: SeatData) =>
    s.occupied &&
    !s.is_overdue &&
    s.status !== "due" &&
    s.status !== "partial_due" &&
    !isSeatFullDay(s) &&
    !isSeatDoubleShift(s);

  const isSeatDue = (s: SeatData) =>
    s.is_overdue || s.status === "due" || s.status === "partial_due";

  const freeCount = seats.filter((s) => !s.occupied).length;
  const dueCount = seats.filter(isSeatDue).length;
  const partialCount = seats.filter(isSeatHalfDay).length;
  const fullDayCount = seats.filter(isSeatFullDay).length;
  const doubleShiftCount = seats.filter(isSeatDoubleShift).length;

  const matchesFilter = (s: SeatData) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "double_shift") return isSeatDoubleShift(s);
    if (filterStatus === "full_day") return isSeatFullDay(s);
    if (filterStatus === "half_day") return isSeatHalfDay(s);
    if (filterStatus === "free") return !s.occupied;
    if (filterStatus === "due") return isSeatDue(s);
    return true;
  };

  const seatColor = (s: SeatData) => {
    if (!s.occupied) {
      // GREEN: Free seat (0 occupants)
      return "bg-emerald-100 text-emerald-950 border-2 border-emerald-400 hover:bg-emerald-200 hover:border-emerald-500 hover:-translate-y-0.5 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border dark:border-emerald-500/20 dark:hover:bg-emerald-500/20 dark:hover:border-emerald-500/40 dark:hover:shadow-[0_0_10px_rgba(16,185,129,0.15)]";
    }
    if (s.is_overdue || s.status === "due") {
      // BLUE: Overdue fees
      return "bg-blue-100 text-blue-950 border-2 border-blue-400 hover:bg-blue-200 hover:border-blue-500 hover:-translate-y-0.5 dark:bg-blue-500/15 dark:text-blue-400 dark:border dark:border-blue-500/40 dark:hover:bg-blue-500/25 dark:hover:border-blue-500/60 dark:hover:shadow-[0_0_12px_rgba(59,130,246,0.3)]";
    }
    if (s.status === "partial_due") {
      // Gradient BLUE to ORANGE: 1 active shift + 1 overdue shift
      return "bg-gradient-to-br from-blue-100 to-orange-100 text-blue-950 border-2 border-blue-400 hover:border-blue-500 hover:-translate-y-0.5 dark:from-blue-500/20 dark:to-orange-500/20 dark:text-blue-300 dark:border dark:border-blue-400/50 dark:hover:border-blue-500/70 dark:hover:shadow-[0_0_12px_rgba(59,130,246,0.25)]";
    }
    if (isSeatFullDay(s)) {
      // RED: Full Day (1 person allocating the shift for all day for a fixed duration)
      return "bg-rose-100 text-rose-950 border-2 border-rose-400 hover:bg-rose-200 hover:border-rose-500 hover:-translate-y-0.5 dark:bg-rose-500/15 dark:text-rose-400 dark:border dark:border-rose-500/30 dark:hover:bg-rose-500/25 dark:hover:border-rose-500/50 dark:hover:shadow-[0_0_10px_rgba(244,63,94,0.2)]";
    }
    if (isSeatDoubleShift(s)) {
      // PURPLE: Completely occupied by multiple shifts and more shifts cannot be added
      return "bg-purple-100 text-purple-950 border-2 border-purple-400 hover:bg-purple-200 hover:border-purple-500 hover:-translate-y-0.5 dark:bg-purple-500/15 dark:text-purple-300 dark:border dark:border-purple-500/40 dark:hover:bg-purple-500/25 dark:hover:border-purple-500/60 dark:hover:shadow-[0_0_12px_rgba(168,85,247,0.3)]";
    }
    // ORANGE: Partially filled seat (1+ shifts occupied, yet another shift can still be filled)
    return "bg-orange-100 text-orange-950 border-2 border-orange-400 hover:bg-orange-200 hover:border-orange-500 hover:-translate-y-0.5 dark:bg-orange-500/15 dark:text-orange-400 dark:border dark:border-orange-500/30 dark:hover:bg-orange-500/25 dark:hover:border-orange-500/50 dark:hover:shadow-[0_0_10px_rgba(249,115,22,0.2)]";
  };

  // Auto-fit calculation to scale seats so they fit within the visible desktop screen
  const calculateFit = useCallback(() => {
    if (!matrixContainerRef.current) return;
    const container = matrixContainerRef.current;
    const rect = container.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    // Mobile / small tablet fallback
    if (windowWidth < 640) {
      setComputedCols(6);
      setTileSize(44);
      return;
    }

    const availableWidth = rect.width > 0 ? rect.width : (windowWidth > 1280 ? 1200 : windowWidth - 48);
    // Calculate visible vertical room available on desktop screen
    const availableHeight = isFullscreen
      ? windowHeight - 120
      : Math.max(340, windowHeight - rect.top - 45);

    const filteredSeats = seats.filter(matchesFilter);
    const visibleCount = Math.max(1, filteredSeats.length);
    const gap = 5;

    let bestCols = 16;
    let bestSize = 42;
    let maxFoundSize = 0;

    // Find the column count (from 10 to 32) that gives the largest legible tile size fitting within availableHeight
    for (let c = 10; c <= 32; c++) {
      const rows = Math.ceil(visibleCount / c);
      const widthPerCol = (availableWidth - (c - 1) * gap) / c;
      const heightPerRow = (availableHeight - (rows - 1) * gap) / rows;
      const s = Math.min(widthPerCol, heightPerRow);

      if (s > maxFoundSize && s >= 24) {
        maxFoundSize = s;
        bestCols = c;
        bestSize = Math.floor(s);
      }
    }

    if (maxFoundSize > 0) {
      setComputedCols(bestCols);
      setTileSize(Math.min(bestSize, 68));
    } else {
      const fallbackCols = visibleCount > 150 ? 22 : 14;
      setComputedCols(fallbackCols);
      setTileSize(38);
    }
  }, [seats, filterStatus, isFullscreen, matchesFilter]);

  // Restore saved layout & size preferences from localStorage
  useEffect(() => {
    try {
      const savedPreset = localStorage.getItem("library_seat_matrix_preset") as SizePreset | null;
      const savedTileSize = localStorage.getItem("library_seat_matrix_tile_size");
      const savedWide = localStorage.getItem("library_seat_matrix_is_wide");

      if (savedPreset) setSizePreset(savedPreset);
      if (savedTileSize) setTileSize(Number(savedTileSize));
      if (savedWide !== null) setIsWideLayout(savedWide === "true");
    } catch {
      // ignore
    }
  }, []);

  // Save layout & size preferences
  useEffect(() => {
    try {
      localStorage.setItem("library_seat_matrix_preset", sizePreset);
      localStorage.setItem("library_seat_matrix_tile_size", tileSize.toString());
      localStorage.setItem("library_seat_matrix_is_wide", isWideLayout.toString());
    } catch {
      // ignore
    }
  }, [sizePreset, tileSize, isWideLayout]);

  // Listen for native Fullscreen events (Esc key or browser exit)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Trigger calculateFit whenever seats or filters update in "fit" mode
  useEffect(() => {
    if (sizePreset === "fit" && seats.length > 0) {
      const t = setTimeout(calculateFit, 60);
      return () => clearTimeout(t);
    }
  }, [seats.length, filterStatus, sizePreset, isWideLayout, isFullscreen, calculateFit]);

  // Recalculate on window resize when in "fit" mode
  useEffect(() => {
    if (sizePreset !== "fit") return;
    const handleResize = () => {
      calculateFit();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sizePreset, calculateFit]);

  // Fullscreen monitor mode toggle
  const toggleFullscreen = () => {
    if (!matrixContainerRef.current) return;
    if (!document.fullscreenElement) {
      matrixContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const shiftLabel = (shift: string | null, subType?: string) => {
    return getShiftDisplayLabel(shift, subType, settings.shifts_config || DEFAULT_SHIFTS);
  };

  const getRenewUrl = (r: ReceiptData) => {
    const today = new Date().toISOString().split("T")[0];
    const params = new URLSearchParams({
      student_id: r.student_id.toString(),
      seat_number: selected?.seat_number.toString() || "",
      subscription_type: r.subscription_type,
      shift_type: r.shift_type || "",
      has_sheet: r.has_sheet ? "true" : "false",
      amount: r.amount_paid.toString(),
      start_date: today,
      slug: slug,
    });
    return `/l/${slug}/new-receipt?${params.toString()}`;
  };

  const handleVacateSeat = async (receiptNo: number, isOverdue?: boolean) => {
    const confirmMsg = isOverdue
      ? "This student's subscription has expired. Vacating this seat will remove their overdue hold and make the seat GREEN (available) for new students.\n\nProceed?"
      : "Are you sure you want to officially vacate this student and free the seat?";
    if (!confirm(confirmMsg)) return;
    setVacating(receiptNo);
    try {
      const res = await fetch("/api/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_no: receiptNo }),
      });
      if (res.ok) {
        fetchSeats();
        setSelected(null);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Error: ${errorData.error || "Failed to vacate seat"}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message || "Failed to vacate seat"}`);
    } finally {
      setVacating(null);
    }
  };

  // Free seats list for assigning
  const freeSeats = seats.filter((s) => !s.occupied);

  // Compute live subscription and trial access status
  const access = getLibraryAccessStatus(library);

  // If trial expired or past due, strictly lock UI behind paywall while preserving 100% of data (never block superadmin)
  if (access.isBlocked && !hasAdminOverride && !isSuperAdminAuthenticated()) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <TenantAccessBarrier
          library={library}
          access={access}
          onRefresh={loadInfo}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <div className={`flex-1 w-full mx-auto px-3 sm:px-6 py-4 space-y-4 transition-all duration-300 ${isWideLayout ? "max-w-[98vw]" : "max-w-[1680px]"}`}>
        {/* Interactive Demo Top Banner */}
        {isDemoSlug(slug) && (
          <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-500/25 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 rounded-2xl bg-amber-500/15 border border-amber-500/25 shrink-0">
                🧪
              </span>
              <div>
                <div className="font-extrabold text-sm text-text-main flex items-center gap-2">
                  <span>Interactive Demo Desk</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    Synthetic Sample Records
                  </span>
                </div>
                <p className="text-text-muted mt-0.5 leading-relaxed">
                  All 200 seats, double-shifts, daily collections, and student profiles are simulated sample records. Click any seat to test inspections, view shifts, and test approval chimes!
                </p>
              </div>
            </div>
            <Link
              href="/signup"
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition active:scale-95 text-center shrink-0"
            >
              Launch Your Own Library (7-Day Trial) 🚀
            </Link>
          </div>
        )}

        {/* Testing Phase: 7-Day Free Trial Notice Banner */}
        {access.isTrial && !access.isBlocked && !isDemoSlug(slug) && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border border-amber-500/30 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 rounded-2xl bg-amber-500/15 border border-amber-500/25 shrink-0">
                ⏳
              </span>
              <div>
                <div className="font-extrabold text-sm text-text-main flex items-center gap-2">
                  <span>Testing Phase: 7-Day Free Trial</span>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/25 text-amber-700 dark:text-amber-300">
                    {access.trialDaysRemaining} Day{access.trialDaysRemaining === 1 ? "" : "s"} Remaining
                  </span>
                </div>
                <p className="text-text-muted mt-0.5 leading-relaxed">
                  You are evaluating LibraryOS. All your seats, shifts, student admissions, and fee receipts are safely preserved in the cloud database.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowPayEarlyModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 text-center cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>⚡</span> Pay &amp; Activate Plan Early 🚀
              </button>
            </div>
          </div>
        )}

        {/* PWA Offline Mode Notice */}
        {!isOnline && (
          <div className="bg-amber-500/15 border-2 border-amber-500/40 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 rounded-2xl bg-amber-500/20 border border-amber-500/30 shrink-0">
                📡
              </span>
              <div>
                <div className="font-extrabold text-sm text-amber-950 dark:text-amber-300 flex items-center gap-2">
                  <span>Offline Resilience Mode Active</span>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-900 dark:text-amber-200">
                    Local Device Cache
                  </span>
                </div>
                <p className="text-amber-900/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                  Basement/network disconnect detected. The seat matrix and cached records are operating seamlessly from your device&apos;s high-speed local cache. Updates will auto-sync the moment connectivity is restored.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchSeats();
                fetchFloatingStudents();
                loadInfo();
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow transition active:scale-95 text-center shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🔄</span> Re-check Connection
            </button>
          </div>
        )}

        {/* Reconnected Banner */}
        {justReconnected && isOnline && (
          <div className="bg-emerald-500/15 border-2 border-emerald-500/40 rounded-3xl p-3.5 shadow-sm flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 text-emerald-950 dark:text-emerald-300">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">✅</span>
              <div>
                <div className="font-extrabold text-sm">Connection Restored!</div>
                <div className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80">Live cloud sync complete. Desk seat matrix is synchronized with the server.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setJustReconnected(false)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Section: Real-Time Incoming Admission Requests Drawer */}
        {admissionRequests.length > 0 && (
          <div className="bg-card-bg border-2 border-emerald-500/40 rounded-3xl p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h2 className="font-black text-sm text-text-main flex items-center gap-2">
                  <span>🔔</span> Incoming Door Admissions Waiting for Soundbox Verification
                </h2>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                  {admissionRequests.length}
                </span>
              </div>
              <button
                onClick={fetchAdmissionRequests}
                className="text-xs text-text-muted hover:text-text-main underline cursor-pointer"
              >
                Refresh Queue
              </button>
            </div>

            {/* Request Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {admissionRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-background border border-panel-border shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-black text-sm text-text-main">{req.student_name}</div>
                      <div className="text-xs font-mono text-text-muted">{req.student_phone}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        ₹{req.amount_paid}
                      </div>
                      <div className="text-[10px] font-bold text-text-muted uppercase">
                        {req.subscription_type === "full_day" ? "Full Day" : "Half Day"} {req.has_sheet ? "(+Sheet)" : ""}
                      </div>
                    </div>
                  </div>

                  {/* UTR Soundbox Verification Badge */}
                  <div className="p-2.5 rounded-xl bg-neutral-500/5 border border-dashed border-panel-border flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-text-muted uppercase block">
                        Soundbox UTR Number
                      </span>
                      <span className="font-mono font-black text-rose-600 dark:text-rose-400 tracking-wider text-sm">
                        {req.utr_number || "No UTR Entered"}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      Verify on Soundbox
                    </span>
                  </div>

                  {/* Seat Allocation & Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      value={selectedSeatForApproval[req.id] || ""}
                      onChange={(e) =>
                        setSelectedSeatForApproval({
                          ...selectedSeatForApproval,
                          [req.id]: Number(e.target.value),
                        })
                      }
                      className="flex-1 bg-card-bg border border-panel-border text-xs rounded-xl px-2.5 py-2 font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Assign Free Seat --</option>
                      {freeSeats.map((fs) => (
                        <option key={fs.seat_id} value={fs.seat_number}>
                          Seat #{fs.seat_number} (Free)
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleApproveRequest(req)}
                      disabled={approvingRequestId === req.id}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {approvingRequestId === req.id ? "Assigning..." : "✓ Approve"}
                    </button>

                    <button
                      onClick={() => handleRejectRequest(req.id)}
                      className="px-2.5 py-2 rounded-xl border border-panel-border hover:bg-rose-500/10 hover:text-rose-600 text-xs font-semibold text-text-muted transition cursor-pointer"
                      title="Reject Request"
                    >
                      ✕
                    </button>
                  </div>

                  {approvalFeedback?.id === req.id && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between">
                      <span>{approvalFeedback.message}</span>
                      {approvalFeedback.receiptNo && (
                        <Link
                          href={`/receipts/${approvalFeedback.receiptNo}`}
                          target="_blank"
                          className="underline"
                        >
                          View Pass →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 sm:gap-3">
          <button
            onClick={() => setFilterStatus("all")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              filterStatus === "all"
                ? "bg-slate-100 dark:bg-neutral-800 border-2 dark:border border-slate-900 dark:border-neutral-500 shadow-sm"
                : "bg-card-bg border-panel-border hover:border-slate-300 dark:hover:border-neutral-700 shadow-2xs"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-text-muted tracking-wider">Total Seats</div>
            <div className="text-xl font-black font-mono mt-0.5 text-foreground">{seats.length}</div>
          </button>

          <button
            onClick={() => setFilterStatus("free")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              filterStatus === "free"
                ? "bg-emerald-100 dark:bg-emerald-500/15 border-2 dark:border border-emerald-600 dark:border-emerald-500 shadow-sm"
                : "bg-emerald-50/70 dark:bg-card-bg border-emerald-200 dark:border-panel-border hover:border-emerald-400 dark:hover:border-neutral-700 shadow-2xs"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-400 tracking-wider">🟢 Free Seats</div>
            <div className="text-xl font-black font-mono text-emerald-950 dark:text-emerald-400 mt-0.5">{freeCount}</div>
          </button>

          <button
            onClick={() => setFilterStatus("full_day")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              filterStatus === "full_day"
                ? "bg-rose-100 dark:bg-rose-500/15 border-2 dark:border border-rose-600 dark:border-rose-500 shadow-sm"
                : "bg-rose-50/70 dark:bg-card-bg border-rose-200 dark:border-panel-border hover:border-rose-400 dark:hover:border-neutral-700 shadow-2xs"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-rose-800 dark:text-rose-400 tracking-wider">🔴 Full Day</div>
            <div className="text-xl font-black font-mono text-rose-950 dark:text-rose-400 mt-0.5">{fullDayCount}</div>
          </button>

          <button
            onClick={() => setFilterStatus("half_day")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              filterStatus === "half_day"
                ? "bg-orange-100 dark:bg-orange-500/15 border-2 dark:border border-orange-600 dark:border-orange-500 shadow-sm"
                : "bg-orange-50/70 dark:bg-card-bg border-orange-200 dark:border-panel-border hover:border-orange-400 dark:hover:border-neutral-700 shadow-2xs"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-orange-800 dark:text-orange-400 tracking-wider">🟠 Partially Filled</div>
            <div className="text-xl font-black font-mono text-orange-950 dark:text-orange-400 mt-0.5">{partialCount}</div>
          </button>

          <button
            onClick={() => setFilterStatus("double_shift")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              filterStatus === "double_shift"
                ? "bg-purple-100 dark:bg-purple-500/15 border-2 dark:border border-purple-600 dark:border-purple-500 shadow-sm"
                : "bg-purple-50/70 dark:bg-card-bg border-purple-200 dark:border-panel-border hover:border-purple-400 dark:hover:border-neutral-700 shadow-2xs"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-purple-800 dark:text-purple-400 tracking-wider">🟣 Multiple Shifts (Full)</div>
            <div className="text-xl font-black font-mono text-purple-950 dark:text-purple-300 mt-0.5">{doubleShiftCount}</div>
          </button>

          <button
            onClick={() => setFilterStatus("due")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              filterStatus === "due"
                ? "bg-blue-100 dark:bg-blue-500/15 border-2 dark:border border-blue-600 dark:border-blue-500 shadow-sm"
                : "bg-blue-50/70 dark:bg-card-bg border-blue-200 dark:border-panel-border hover:border-blue-400 dark:hover:border-neutral-700 shadow-2xs"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-400 tracking-wider">🔵 Overdue Fees</div>
            <div className="text-xl font-black font-mono text-blue-950 dark:text-blue-400 mt-0.5">{dueCount}</div>
          </button>

          <button
            onClick={() => setShowFloatingModal(true)}
            className="p-3 rounded-2xl border text-left transition cursor-pointer bg-indigo-50/70 dark:bg-card-bg border-indigo-200 dark:border-panel-border hover:border-indigo-400 dark:hover:border-neutral-700 shadow-2xs group"
          >
            <div className="text-[10px] uppercase font-bold text-indigo-800 dark:text-indigo-400 tracking-wider flex items-center justify-between">
              <span>🌐 Floating Pass</span>
              <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-extrabold opacity-75 group-hover:opacity-100 transition">View →</span>
            </div>
            <div className="text-xl font-black font-mono text-indigo-950 dark:text-indigo-300 mt-0.5">
              {floatingStudents.length}
            </div>
          </button>
        </div>

        {/* Cinema Seats Matrix */}
        <div
          ref={matrixContainerRef}
          className={`bg-card-bg border border-panel-border rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 transition-all ${
            isFullscreen ? "fixed inset-0 z-50 rounded-none overflow-y-auto p-6 bg-background" : ""
          }`}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-panel-border pb-3.5">
            <div className="flex items-center gap-3">
              <h2 className="font-black text-sm sm:text-base flex items-center gap-2">
                <span>🎬</span> Real-Time Seat Matrix Layout
              </h2>
              <span className="text-xs text-text-muted font-medium bg-neutral-500/10 px-2.5 py-0.5 rounded-full">
                Showing {seats.filter(matchesFilter).length} of {seats.length} seats
              </span>
            </div>

            {/* Quick Status Legend & Fullscreen Button */}
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[11px] font-bold">
              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20">
                🟢 Free
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-950 border border-rose-400 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20">
                🔴 Full Day
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-orange-100 text-orange-950 border border-orange-400 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20">
                🟠 Partially Filled
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-950 border border-purple-400 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/20">
                🟣 Multiple Shifts (Full)
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-950 border border-blue-400 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20">
                🔵 Overdue
              </span>
              <button
                onClick={toggleFullscreen}
                className="ml-auto px-2.5 py-1 rounded-lg border border-panel-border bg-background hover:bg-neutral-500/10 text-text-muted hover:text-text-main text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? "✕ Exit Fullscreen" : "⛶ Fullscreen"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  sizePreset === "fit"
                    ? `repeat(${computedCols}, minmax(0, 1fr))`
                    : sizePreset === "custom"
                    ? `repeat(auto-fill, minmax(${tileSize}px, 1fr))`
                    : sizePreset === "compact"
                    ? `repeat(auto-fill, minmax(36px, 1fr))`
                    : sizePreset === "standard"
                    ? `repeat(auto-fill, minmax(54px, 1fr))`
                    : `repeat(auto-fill, minmax(72px, 1fr))`,
                gap: tileSize < 36 ? "4px" : "6px",
              }}
              className="w-full transition-all duration-200"
            >
              {seats.filter(matchesFilter).map((seat) => {
                const isTiny = tileSize < 34;
                const isSmall = tileSize >= 34 && tileSize < 46;
                const isMedium = tileSize >= 46 && tileSize < 62;

                return (
                  <button
                    key={seat.seat_id}
                    onClick={() => setSelected(seat)}
                    style={{
                      height: sizePreset === "fit" ? `${Math.max(26, tileSize)}px` : undefined,
                      minHeight: sizePreset !== "fit" ? `${tileSize}px` : undefined,
                    }}
                    title={`Seat #${seat.seat_number} • ${
                      !seat.occupied
                        ? "Free (Available)"
                        : seat.is_overdue
                        ? `Due • ${seat.receipts?.[0]?.member?.name || "Student"}`
                        : isSeatDoubleShift(seat)
                        ? `2x Shift • ${seat.receipts?.map((r) => r.member?.name).filter(Boolean).join(" & ") || "2 Students"}`
                        : `${seat.status?.replace("_", " ") || "Occupied"} • ${seat.receipts?.[0]?.member?.name || "Student"}`
                    }`}
                    className={`rounded-lg sm:rounded-xl flex flex-col items-center justify-center p-0.5 font-bold cursor-pointer transition-all duration-150 relative group ${seatColor(
                      seat
                    )}`}
                  >
                    <span
                      className={`font-mono leading-none ${
                        isTiny
                          ? "text-[9px] font-extrabold"
                          : isSmall
                          ? "text-[11px] font-extrabold"
                          : isMedium
                          ? "text-xs font-black"
                          : "text-sm font-black"
                      }`}
                    >
                      {seat.seat_number}
                    </span>

                    {!isTiny && isSeatDoubleShift(seat) && (
                      <span
                        className={`font-black uppercase tracking-tighter leading-none mt-0.5 ${
                          isSmall ? "text-[6px]" : "text-[8px]"
                        }`}
                      >
                        2x
                      </span>
                    )}
                    {!isTiny && seat.is_overdue && (
                      <span
                        className={`font-black uppercase tracking-tighter leading-none mt-0.5 text-rose-600 dark:text-rose-400 ${
                          isSmall ? "text-[6px]" : "text-[8px]"
                        }`}
                      >
                        Due
                      </span>
                    )}
                    {isTiny && (isSeatDoubleShift(seat) || seat.is_overdue) && (
                      <span className="w-1 h-1 rounded-full bg-current mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Seat Details Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center animate-in fade-in"
          onClick={() => setSelected(null)}
        >
          <div
            className={`my-auto bg-card-bg border border-panel-border rounded-3xl ${
              selected.receipts && selected.receipts.length > 1 ? "max-w-4xl" : "max-w-lg"
            } w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[92vh]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header: shrink-0 pinned at top so it never scrolls or gets cut off */}
            <div className="px-5 py-3.5 border-b border-panel-border bg-card-bg shrink-0 flex justify-between items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black text-text-main flex items-center gap-2 truncate">
                  Seat #{selected.seat_number}
                </h2>
                <p className="text-[11px] text-text-muted mt-0.5 truncate">
                  Workspace details &middot; {library.name}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider border text-center ${
                    !selected.occupied
                      ? "bg-emerald-100 text-emerald-950 border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
                      : selected.is_overdue || selected.status === "due"
                      ? "bg-blue-100 text-blue-950 border-blue-400 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40"
                      : selected.status === "partial_due"
                      ? "bg-gradient-to-r from-blue-100 to-orange-100 text-blue-950 border-blue-400 dark:from-blue-500/20 dark:to-orange-500/20 dark:text-blue-300 dark:border-blue-400/50"
                      : isSeatFullDay(selected)
                      ? "bg-rose-100 text-rose-950 border-rose-400 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30"
                      : isSeatDoubleShift(selected)
                      ? "bg-purple-100 text-purple-950 border-purple-400 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/35"
                      : "bg-orange-100 text-orange-950 border-orange-400 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/25"
                  }`}
                >
                  {!selected.occupied
                    ? "🟢 Free (Available)"
                    : selected.is_overdue || selected.status === "due"
                    ? `🔵 Fees Due (${selected.receipts?.find((r) => r.is_overdue)?.days_overdue || 1}d overdue)`
                    : selected.status === "partial_due"
                    ? "Partial Due"
                    : isSeatFullDay(selected)
                    ? "🔴 Full Day (1 Person Full Day)"
                    : isSeatDoubleShift(selected)
                    ? "🟣 Multiple Shifts (Fully Occupied)"
                    : `🟠 Partially Filled • ${shiftLabel(selected.receipts[0]?.shift_type)} (Another Shift Can Be Added)`}
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-text-muted hover:text-text-main flex items-center justify-center text-sm font-bold cursor-pointer transition shrink-0"
                  title="Close popup (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content Body: compact and side-by-side for multiple shifts */}
            <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3 overscroll-contain">
              {selected.occupied && selected.receipts && selected.receipts.length > 0 ? (
                <div className="space-y-3">
                  {/* Occupants: Side-by-Side 2 columns when dual seat */}
                  <div className={`grid ${selected.receipts.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"} gap-3`}>
                    {selected.receipts.map((r, idx) => {
                      const today = new Date().toISOString().split("T")[0];
                      const diffTime = new Date(r.end_date).getTime() - new Date(today).getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      const isOverdue = r.is_overdue || diffDays < 0;
                      const daysOverdue = isOverdue ? Math.abs(diffDays) || r.days_overdue || 1 : 0;

                      return (
                        <div
                          key={r.receipt_no || idx}
                          className="bg-background border border-panel-border rounded-2xl p-3.5 relative shadow-xs flex flex-col justify-between space-y-2.5"
                        >
                          {/* Card Top: Shift Name & Overdue / Days Left status */}
                          <div className="flex items-center justify-between pb-2 border-b border-panel-border/40">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isSeatDoubleShift(selected)
                                    ? idx === 0
                                      ? "bg-purple-500"
                                      : "bg-indigo-500"
                                    : "bg-emerald-500"
                                }`}
                              />
                              <span className="text-xs font-black uppercase tracking-wider text-text-main truncate">
                                {selected.receipts.length > 1 ? `Shift ${idx + 1}: ` : ""}
                                {shiftLabel(r.shift_type, r.subscription_type)}
                              </span>
                            </div>
                            {isOverdue ? (
                              <span className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold border border-blue-500/30 flex items-center gap-1 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                {daysOverdue}d overdue
                              </span>
                            ) : diffDays === 0 ? (
                              <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold shrink-0">
                                Expires Today
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold shrink-0">
                                {diffDays}d left
                              </span>
                            )}
                          </div>

                          {/* Student Details List */}
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between items-center py-0.5 border-b border-panel-border/30">
                              <span className="text-text-muted text-[11px]">Name:</span>
                              <span className="font-bold text-text-main text-xs flex items-center gap-1.5">
                                {r.member?.name || "Student"}
                                <Link
                                  href={`/l/${slug}/members/${r.student_id}`}
                                  className="font-mono text-blue-600 dark:text-blue-400 font-bold hover:underline text-[11px]"
                                  title="View member profile"
                                >
                                  #{r.student_id}
                                </Link>
                              </span>
                            </div>

                            {r.member?.phone && (
                              <div className="flex justify-between items-center py-0.5 border-b border-panel-border/30">
                                <span className="text-text-muted text-[11px]">Phone:</span>
                                <span className="font-mono font-bold text-text-main text-[11px]">
                                  {r.member.phone}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between items-center py-0.5 border-b border-panel-border/30">
                              <span className="text-text-muted text-[11px]">Subscription:</span>
                              <span className="font-semibold text-text-main text-[11px]">
                                {r.subscription_type === "full_day"
                                  ? "Full day (6am–12am)"
                                  : `Half day (${shiftLabel(r.shift_type, r.subscription_type)})`}
                              </span>
                            </div>

                            <div className="flex justify-between items-center py-0.5 border-b border-panel-border/30">
                              <span className="text-text-muted text-[11px]">Sheets Desk:</span>
                              <span className="text-text-main font-medium text-[11px]">
                                {r.has_sheet ? "Included (₹300)" : "None"}
                              </span>
                            </div>

                            <div className="flex justify-between items-center py-0.5 border-b border-panel-border/30">
                              <span className="text-text-muted text-[11px]">Valid till:</span>
                              <span className="font-semibold text-text-main flex items-center gap-1.5 text-[11px]">
                                <span
                                  className={
                                    isOverdue
                                      ? "text-blue-600 dark:text-blue-400 font-bold"
                                      : "text-text-main"
                                  }
                                >
                                  {r.end_date}
                                </span>
                                {isOverdue ? (
                                  <span className="text-[9px] bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded-full font-bold">
                                    {daysOverdue}d overdue
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded-full font-bold">
                                    {diffDays}d left
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons Row */}
                          <div className="pt-1 flex gap-1.5 flex-wrap items-center">
                            {/* Renew */}
                            <Link
                              href={getRenewUrl(r)}
                              className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] px-2.5 py-1 rounded-lg font-bold shadow-xs transition hover:-translate-y-0.5 cursor-pointer"
                            >
                              Renew
                            </Link>

                            {/* Vacate */}
                            <button
                              disabled={vacating === r.receipt_no}
                              onClick={() => handleVacateSeat(r.receipt_no, isOverdue)}
                              className={`${
                                isOverdue
                                  ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                  : "bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-muted hover:text-red-500 border border-panel-border"
                              } text-[11px] px-2.5 py-1 rounded-lg font-bold transition cursor-pointer disabled:opacity-50`}
                            >
                              {vacating === r.receipt_no
                                ? "Vacating..."
                                : isOverdue
                                ? "Vacate Seat"
                                : "Vacate"}
                            </button>

                            {/* Edit Plan */}
                            <button
                              onClick={() =>
                                setEditingReceipt({
                                  receipt_no: r.receipt_no,
                                  student_id: r.student_id,
                                  student_name: r.member?.name,
                                  student_phone: r.member?.phone,
                                  aadhar_no: r.member?.aadhar_no,
                                  seat_id: selected.seat_id,
                                  seat_number: selected.seat_number,
                                  subscription_type: r.subscription_type,
                                  shift_type: r.shift_type,
                                  has_sheet: r.has_sheet,
                                  amount_paid: r.amount_paid,
                                  start_date: r.start_date,
                                  end_date: r.end_date,
                                })
                              }
                              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[11px] px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                              title="Owner: Edit plan, dates, or fees"
                            >
                              ✏️ Edit Plan
                            </button>

                            {/* Digital Pass */}
                            <Link
                              href={`/receipts/${r.receipt_no}`}
                              className="bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-details border border-panel-border text-[11px] px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1"
                            >
                              🎟️ Pass
                            </Link>

                            {/* Overdue UPI QR & WhatsApp triggers */}
                            {isOverdue && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedUpiCandidate({
                                      receipt_no: r.receipt_no,
                                      student_id: r.student_id,
                                      student_name: r.member?.name || "Student",
                                      student_phone: r.member?.phone || null,
                                      seat_number: selected.seat_number,
                                      shift_type: r.shift_type,
                                      subscription_type: r.subscription_type,
                                      amount_paid: r.amount_paid,
                                      end_date: r.end_date,
                                      days_overdue: daysOverdue,
                                    });
                                  }}
                                  className="px-2 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Instant Dynamic UPI Intent & QR Code"
                                >
                                  ⚡ UPI QR
                                </button>

                                {r.member?.phone && (
                                  <a
                                    href={`https://wa.me/91${r.member.phone
                                      .replace(/[^0-9]/g, "")
                                      .slice(-10)}?text=${encodeURIComponent(
                                      generateDueFeeWhatsAppMessage({
                                        studentName: r.member.name,
                                        studentPhone: r.member.phone,
                                        seatNumber: selected.seat_number,
                                        shiftName: shiftLabel(r.shift_type, r.subscription_type),
                                        daysOverdue: daysOverdue,
                                        expiryDate: r.end_date,
                                        amountDue: r.amount_paid,
                                        libraryName: library.name,
                                        upiId: library.upi_id || "targetlibrary@upi",
                                        upiName: library.upi_name || library.name,
                                        digitalPassUrl:
                                          typeof window !== "undefined"
                                            ? `${window.location.origin}/receipts/${r.receipt_no}`
                                            : undefined,
                                      })
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    title="Send WhatsApp payment reminder"
                                  >
                                    💬 WhatsApp
                                  </a>
                                )}
                              </>
                            )}

                            {/* History */}
                            <Link
                              href={`/l/${slug}/members/${r.student_id}`}
                              className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 text-[11px] font-bold underline flex items-center ml-auto transition-colors"
                            >
                              History &rarr;
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* If seat has room for another non-overlapping shift */}
                  {(() => {
                    const activeOnly = selected.receipts.filter((r) => !r.is_overdue);
                    const available = sortShiftsChronologically(
                      getAvailableShiftsForSeat(
                        activeOnly,
                        settings.shifts_config || DEFAULT_SHIFTS
                      )
                    );
                    if (available.length === 0) return null;

                    return (
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3 text-center space-y-2">
                        <p className="text-xs text-orange-700 dark:text-orange-300 font-bold">
                          🟠 Seat is partially filled &mdash; you can fill another non-overlapping shift ({available.length} slot{available.length === 1 ? "" : "s"} available):
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {available.map((av) => (
                            <Link
                              key={av.id}
                              href={`/l/${slug}/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=${av.id}`}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] px-3.5 py-1.5 rounded-xl font-bold transition shadow-sm cursor-pointer"
                            >
                              + {getShiftNameWithTiming(av)} • ₹{av.base_price}
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  <p className="text-text-muted text-xs">
                    This seat is completely unoccupied for all shifts.
                  </p>
                  <div className="flex flex-col gap-2">
                    {(() => {
                      const fullShift = (settings.shifts_config || DEFAULT_SHIFTS).find((s) => s.id === "full_day");
                      if (!fullShift) return null;
                      return (
                        <Link
                          href={`/l/${slug}/new-receipt?seat_number=${selected.seat_number}&subscription_type=full_day`}
                          className="block text-center bg-rose-600 hover:bg-rose-500 text-white text-xs py-2 rounded-xl font-bold shadow-md shadow-rose-600/20 transition hover:-translate-y-0.5 cursor-pointer"
                        >
                          Assign {getShiftNameWithTiming(fullShift)} (₹{fullShift.base_price} / ₹{fullShift.sheet_price} with sheet)
                        </Link>
                      );
                    })()}
                    <div className="flex flex-wrap gap-2">
                      {sortShiftsChronologically(settings.shifts_config || DEFAULT_SHIFTS)
                        .filter((s) => s.id !== "full_day")
                        .map((s) => (
                          <Link
                            key={s.id}
                            href={`/l/${slug}/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=${s.id}`}
                            className="flex-1 min-w-[130px] text-center bg-card-bg border border-panel-border hover:border-emerald-500 hover:bg-emerald-500/10 text-text-main text-[11px] py-2 px-2.5 rounded-xl font-bold shadow-xs transition hover:-translate-y-0.5 cursor-pointer"
                          >
                            <div>{getShiftNameWithTiming(s)}</div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">₹{s.base_price}/mo</div>
                          </Link>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer: shrink-0 pinned at bottom */}
            <div className="px-5 py-2.5 border-t border-panel-border bg-card-bg shrink-0 flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-details border border-panel-border px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close Layout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Receipt Modal */}
      {editingReceipt && (
        <EditReceiptModal
          isOpen={!!editingReceipt}
          receipt={editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSuccess={() => {
            setEditingReceipt(null);
            fetchSeats();
          }}
          shiftsConfig={settings.shifts_config || DEFAULT_SHIFTS}
          slug={slug}
        />
      )}

      {/* Dynamic UPI Modal for Overdue Payments */}
      {selectedUpiCandidate && (
        <DynamicUpiModal
          isOpen={!!selectedUpiCandidate}
          onClose={() => setSelectedUpiCandidate(null)}
          candidate={selectedUpiCandidate}
          library={{
            name: library.name,
            slug: library.slug,
            upi_id: library.upi_id || "targetlibrary@upi",
            upi_name: library.upi_name || library.name,
          }}
          shiftLabel={shiftLabel(selectedUpiCandidate.shift_type, selectedUpiCandidate.subscription_type)}
        />
      )}

      {/* Instant Early Subscription Payment Modal */}
      <SubscriptionPaymentModal
        isOpen={showPayEarlyModal}
        onClose={() => setShowPayEarlyModal(false)}
        library={library}
        onSuccess={loadInfo}
      />

      {/* Floating / Flexible Students (Daily Vacancy Access) Modal */}
      {showFloatingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card-bg border border-panel-border rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-panel-border pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-lg">
                  🌐
                </span>
                <div>
                  <h2 className="text-base font-black text-foreground">
                    Floating Students (Daily Vacancy Access)
                  </h2>
                  <p className="text-xs text-text-muted">
                    {floatingStudents.length} active student{floatingStudents.length === 1 ? "" : "s"} enrolled without fixed desk reservations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFloatingModal(false)}
                className="p-1.5 rounded-xl text-text-muted hover:text-foreground hover:bg-neutral-500/10 transition cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3 text-xs text-indigo-950 dark:text-indigo-200">
              <p className="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
                <span>💡</span> Librarian Operational Workflow:
              </p>
              <p className="mt-1 leading-relaxed text-[11px] text-text-muted">
                These students have paid their fees and are fully registered, but do not own a fixed seat. When they arrive, glance at the matrix to find seats that are <strong>🟢 Free</strong> or where students are absent today, and allot them that seat for this study session.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-panel-border">
              {floatingStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  No active floating students registered right now.
                </div>
              ) : (
                floatingStudents.map((st: any) => (
                  <div key={st.receipt_no} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-foreground text-sm flex items-center gap-2">
                        <span>{st.members?.name || "Student"}</span>
                        <span className="font-mono text-[10px] bg-neutral-500/10 px-1.5 py-0.5 rounded text-text-muted">
                          #{st.student_id}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted flex items-center gap-3 mt-0.5">
                        {st.members?.phone && (
                          <a href={`tel:${st.members.phone}`} className="hover:underline hover:text-rose-500">
                            📞 {st.members.phone}
                          </a>
                        )}
                        <span>Valid: {st.start_date} &rarr; {st.end_date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right font-mono">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{st.amount_paid}</span>
                        <span className="block text-[10px] text-text-muted uppercase font-bold">{st.payment_mode}</span>
                      </div>
                      <Link
                        href={`/receipts/${st.receipt_no}`}
                        target="_blank"
                        className="px-2.5 py-1.5 rounded-lg border border-panel-border hover:bg-neutral-500/10 font-bold text-[11px] transition text-text-main"
                      >
                        Pass →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-panel-border flex justify-between items-center text-xs">
              <Link
                href={`/l/${encodeURIComponent(slug)}/new-receipt?mode=floating`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-sm"
              >
                + Admit Floating Student
              </Link>
              <button
                onClick={() => setShowFloatingModal(false)}
                className="px-4 py-2 rounded-xl border border-panel-border text-text-muted hover:text-foreground font-semibold transition cursor-pointer"
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
