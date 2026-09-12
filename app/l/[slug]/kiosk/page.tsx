"use client";

import React, { useState, useEffect, use, useRef, useCallback } from "react";
import Link from "next/link";
import { Library, LibrarySettings, ShiftConfig } from "@/lib/types";
import { FALLBACK_TARGET_LIBRARY, FALLBACK_SETTINGS, isDemoSlug } from "@/lib/tenant";
import LibraryLogo from "@/lib/LibraryLogo";
import HeaderNavbar from "@/lib/HeaderNavbar";

interface InsideStudent {
  student_id: number;
  student_name: string;
  student_phone: string | null;
  seat_number: number | null;
  subscription_type: string;
  shift_type: string | null;
  punch_time: string;
  punch_time_formatted: string;
  shift_end_time: string;
  is_overstay: boolean;
  overstay_minutes: number;
  overstay_formatted: string;
  is_warning: boolean;
  minutes_remaining: number;
}

interface RecentPunchLog {
  id: string;
  student_id: number;
  student_name: string;
  student_phone?: string | null;
  seat_number?: number | null;
  subscription_type: string;
  shift_type?: string | null;
  punch_type: "in" | "out";
  punch_time: string;
  notes?: string | null;
}

interface KioskData {
  ist_time: string;
  ist_date: string;
  headcount: {
    total_inside: number;
    overstay_count: number;
    warning_count: number;
    checked_out_count: number;
    total_entries_today: number;
  };
  inside_students: InsideStudent[];
  overstay_alerts: InsideStudent[];
  recent_logs: RecentPunchLog[];
}

export default function GateKioskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [library, setLibrary] = useState<Library>(FALLBACK_TARGET_LIBRARY);
  const [settings, setSettings] = useState<LibrarySettings>(FALLBACK_SETTINGS);
  const [mode, setMode] = useState<"kiosk" | "radar">("kiosk");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live Clock
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [currentDateStr, setCurrentDateStr] = useState<string>("");

  // Kiosk Input States
  const [identifierInput, setIdentifierInput] = useState<string>("");
  const [punching, setPunching] = useState<boolean>(false);
  const [lastPunchResult, setLastPunchResult] = useState<{
    success: boolean;
    type: "in" | "out";
    message: string;
    student: any;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoResetTimer, setAutoResetTimer] = useState<number | null>(null);

  // Radar Data States
  const [kioskData, setKioskData] = useState<KioskData>({
    ist_time: "--:--",
    ist_date: "",
    headcount: {
      total_inside: 0,
      overstay_count: 0,
      warning_count: 0,
      checked_out_count: 0,
      total_entries_today: 0,
    },
    inside_students: [],
    overstay_alerts: [],
    recent_logs: [],
  });
  const [radarFilter, setRadarFilter] = useState<"overstay" | "inside" | "logs">("overstay");
  const [radarSearch, setRadarSearch] = useState<string>("");
  const [loadingRadar, setLoadingRadar] = useState<boolean>(true);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Web Audio Synth Chimes
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playChime = useCallback(
    (type: "in" | "out" | "alert") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;

        if (type === "in") {
          // Upbeat major triad chime (C5 -> E5 -> G5)
          const notes = [523.25, 659.25, 783.99];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
            gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
            gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + idx * 0.1 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.1);
            osc.stop(ctx.currentTime + idx * 0.1 + 0.4);
          });
        } else if (type === "out") {
          // Gentle warm descent (G4 -> C4)
          const notes = [392.0, 261.63];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
            gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.15);
            gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.15 + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.45);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.15);
            osc.stop(ctx.currentTime + idx * 0.15 + 0.5);
          });
        } else {
          // Overstay Warning Beep (E5 -> C5)
          const notes = [659.25, 523.25];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
            gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.12);
            osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
          });
        }
      } catch {
        // audio error ignored
      }
    },
    [soundEnabled, getAudioContext]
  );

  // Clock Ticker
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(
        new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now)
      );
      setCurrentDateStr(
        new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(now)
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Library Info
  useEffect(() => {
    async function loadLib() {
      try {
        const res = await fetch(`/api/libraries/${slug}/settings`);
        if (res.ok) {
          const data = await res.json();
          if (data.library) setLibrary(data.library);
          if (data.settings) setSettings(data.settings);
        }
      } catch {
        // fallback
      }
    }
    loadLib();
  }, [slug]);

  // Fetch Kiosk Status & Headcount Data
  const loadKioskData = useCallback(async () => {
    try {
      const res = await fetch(`/api/kiosk?slug=${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data: KioskData = await res.json();
        setKioskData(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRadar(false);
    }
  }, [slug]);

  useEffect(() => {
    loadKioskData();
    const interval = setInterval(loadKioskData, 15000); // refresh radar every 15s
    return () => clearInterval(interval);
  }, [loadKioskData]);

  // Handle Punch In / Out
  const handlePunch = async (actionType: "in" | "out" | "toggle" = "toggle") => {
    if (!identifierInput.trim()) {
      setErrorMessage("Please enter your Member ID (e.g. 6309) or Mobile Number.");
      return;
    }

    setPunching(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/kiosk/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          identifier: identifierInput.trim(),
          action: actionType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to record punch");
        playChime("alert");
      } else {
        setLastPunchResult({
          success: true,
          type: data.punch_type,
          message: data.message,
          student: data.student,
        });

        playChime(data.punch_type);
        setIdentifierInput("");
        loadKioskData();

        // 4-second auto-reset for the next student
        if (autoResetTimer) clearTimeout(autoResetTimer);
        const t = window.setTimeout(() => {
          setLastPunchResult(null);
        }, 4500);
        setAutoResetTimer(t);
      }
    } catch {
      setErrorMessage("Connection error. Please try again.");
      playChime("alert");
    } finally {
      setPunching(false);
    }
  };

  // Numpad Touch Input Helper
  const handleKeypadPress = (val: string) => {
    if (val === "C") {
      setIdentifierInput("");
      setErrorMessage(null);
    } else if (val === "⌫") {
      setIdentifierInput((prev) => prev.slice(0, -1));
    } else {
      if (identifierInput.length < 10) {
        setIdentifierInput((prev) => prev + val);
      }
    }
  };

  // 1-Click Desk Checkout (Admin / Staff action)
  const handleDeskCheckout = async (studentId: number, studentName: string) => {
    try {
      const res = await fetch("/api/kiosk/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          identifier: studentId.toString(),
          action: "out",
          notes: "Desk manual check-out",
        }),
      });
      if (res.ok) {
        playChime("out");
        loadKioskData();
      }
    } catch {
      // ignore
    }
  };

  // 1-Click WhatsApp Overstay Reminder
  const generateOverstayWhatsAppLink = (student: InsideStudent) => {
    const phone = (student.student_phone || "").replace(/[^0-9]/g, "");
    if (!phone) return null;

    const shiftLabel =
      student.shift_type === "shift_1"
        ? "Morning Shift (6:00 AM – 2:00 PM)"
        : student.shift_type === "shift_2"
        ? "Evening Shift (2:00 PM – 12:00 AM)"
        : student.shift_type === "shift_3"
        ? "Night Shift (4:00 PM – 12:00 AM)"
        : "Registered Shift";

    const msg = `📚 *${library.name} — Shift Timing Notice*

Dear *${student.student_name}*,

Friendly reminder that your *${shiftLabel}* ended at *${student.shift_end_time}* (${student.overstay_formatted} ago).

Incoming students for the next study shift are waiting for *Seat #${student.seat_number || "Allocated"}*.

Kindly complete your study session and vacate your seat, or visit the front desk to upgrade your plan to a Full-Day subscription.

Thank you for respecting other students' study hours! ✨

Warm regards,  
*${library.name} Front Desk*`;

    return `https://wa.me/91${phone.slice(-10)}?text=${encodeURIComponent(msg)}`;
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Filtered radar students
  const filteredInside = kioskData.inside_students.filter((s) => {
    if (!radarSearch.trim()) return true;
    const q = radarSearch.toLowerCase();
    return (
      s.student_name.toLowerCase().includes(q) ||
      (s.seat_number && s.seat_number.toString().includes(q)) ||
      (s.student_phone && s.student_phone.includes(q)) ||
      s.student_id.toString().includes(q)
    );
  });

  const filteredOverstay = kioskData.overstay_alerts.filter((s) => {
    if (!radarSearch.trim()) return true;
    const q = radarSearch.toLowerCase();
    return (
      s.student_name.toLowerCase().includes(q) ||
      (s.seat_number && s.seat_number.toString().includes(q)) ||
      (s.student_phone && s.student_phone.includes(q)) ||
      s.student_id.toString().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-rose-500/20">
      {/* HeaderNavbar (hidden in kiosk tablet mode or when requested) */}
      {!isFullscreen && <HeaderNavbar />}

      {/* Top Banner Toolbar */}
      <div className="border-b border-panel-border bg-card-bg/70 backdrop-blur-md px-4 py-2.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1750px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Library Brand & Live Clock */}
          <div className="flex items-center gap-3">
            <LibraryLogo slug={slug} logoUrl={library.logo_url} name={library.name} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight">
                  {library.name} Gate Kiosk
                </h1>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <div className="text-xs font-mono font-bold text-text-muted flex items-center gap-2">
                <span className="text-rose-600 dark:text-rose-400 font-extrabold">{currentTimeStr}</span>
                <span>•</span>
                <span>{currentDateStr}</span>
              </div>
            </div>
          </div>

          {/* Mode Switcher & Tools */}
          <div className="flex items-center gap-2">
            {/* Mode Switcher Pills */}
            <div className="flex items-center bg-card-bg border border-panel-border rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setMode("kiosk")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  mode === "kiosk"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                <span>🚪</span> Student Tablet Kiosk
              </button>

              <button
                type="button"
                onClick={() => setMode("radar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  mode === "radar"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                <span>🚨</span> Desk Overstay Radar
                {kioskData.headcount.overstay_count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black animate-pulse">
                    {kioskData.headcount.overstay_count}
                  </span>
                )}
              </button>
            </div>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              className="p-2 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition cursor-pointer"
              title={soundEnabled ? "Mute audio chimes" : "Unmute audio chimes"}
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? "🗗" : "⛶"}
            </button>

            <Link
              href={`/l/${slug}`}
              className="px-3 py-1.5 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition hidden sm:inline-block"
            >
              ← Desk
            </Link>
          </div>
        </div>
      </div>

      {/* Main Workspace Content */}
      <div className="flex-1 max-w-[1750px] w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: STUDENT TABLET KIOSK (SELF-SERVICE GATE TERMINAL) */}
        {/* ------------------------------------------------------------- */}
        {mode === "kiosk" && (
          <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Left Col: Touch Numpad & Quick Entry */}
            <div className="md:col-span-6 bg-card-bg border border-panel-border rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="text-center space-y-1">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-rose-500/10 text-rose-600 border border-rose-500/20">
                  Self-Check-In Station
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  Tap Member ID or Mobile
                </h2>
                <p className="text-xs text-text-muted">
                  Enter your 4-digit ID (e.g. 6309) or 10-digit registered phone number
                </p>
              </div>

              {/* Display Box */}
              <div className="relative">
                <input
                  type="text"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePunch("toggle");
                  }}
                  placeholder="e.g. 6309"
                  maxLength={10}
                  className="w-full text-center text-3xl sm:text-4xl font-mono font-black tracking-widest py-3 px-4 rounded-2xl border-2 border-rose-500/50 bg-background focus:outline-none focus:border-rose-600 shadow-inner"
                  autoFocus
                />
                {identifierInput && (
                  <button
                    type="button"
                    onClick={() => setIdentifierInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-sm font-bold p-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Error Notification */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold text-center animate-shake">
                  ⚠️ {errorMessage}
                </div>
              )}

              {/* High-Contrast Touch Numpad */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => handleKeypadPress(btn)}
                    className={`h-14 sm:h-16 text-xl sm:text-2xl font-mono font-black rounded-2xl transition active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs border ${
                      btn === "C"
                        ? "bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20"
                        : btn === "⌫"
                        ? "bg-neutral-500/10 text-text-main border-panel-border hover:bg-neutral-500/20"
                        : "bg-card-bg hover:bg-neutral-500/10 border-panel-border text-foreground"
                    }`}
                  >
                    {btn}
                  </button>
                ))}
              </div>

              {/* Fast Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={punching || !identifierInput.trim()}
                  onClick={() => handlePunch("in")}
                  className="py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md shadow-emerald-600/25 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🟢</span> PUNCH IN
                </button>

                <button
                  type="button"
                  disabled={punching || !identifierInput.trim()}
                  onClick={() => handlePunch("out")}
                  className="py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-md shadow-rose-600/25 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🔴</span> PUNCH OUT
                </button>
              </div>
            </div>

            {/* Right Col: Instant Recognition & Greeting Feedback */}
            <div className="md:col-span-6 flex flex-col justify-center items-center">
              {lastPunchResult ? (
                // Success Greeting Card with Auto-Reset Countdown
                <div className={`w-full p-8 rounded-3xl border-2 text-center shadow-2xl animate-in zoom-in-95 duration-200 ${
                  lastPunchResult.type === "in"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-100"
                    : "bg-rose-500/10 border-rose-500/40 text-rose-950 dark:text-rose-100"
                }`}>
                  <div className="text-5xl mb-3 animate-bounce">
                    {lastPunchResult.type === "in" ? "🎉" : "👋"}
                  </div>

                  <div className="inline-block px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 bg-white/70 dark:bg-black/40 shadow-xs">
                    {lastPunchResult.type === "in" ? "🟢 Check-In Confirmed" : "🔴 Check-Out Confirmed"}
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black">
                    {lastPunchResult.student?.name}
                  </h3>

                  <div className="my-4 p-4 rounded-2xl bg-white/80 dark:bg-black/30 backdrop-blur-xs border border-panel-border space-y-1 text-sm font-semibold">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Reserved Seat:</span>
                      <span className="font-black text-rose-600">
                        Seat #{lastPunchResult.student?.seat_number || "Open Desk"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Registered Shift:</span>
                      <span className="font-bold text-foreground capitalize">
                        {lastPunchResult.student?.subscription_type?.replace(/_/g, " ")} ({lastPunchResult.student?.shift_type || "Day"})
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed max-w-xs mx-auto">
                    {lastPunchResult.message}
                  </p>

                  <div className="mt-6 text-[11px] font-mono text-text-muted flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-text-muted animate-ping" />
                    Resetting terminal for next student in 4s...
                  </div>
                </div>
              ) : (
                // Standby Presence Card
                <div className="w-full p-8 rounded-3xl border border-panel-border bg-card-bg/60 text-center space-y-4 shadow-sm">
                  <div className="text-4xl text-neutral-400">🏛️</div>
                  <h3 className="text-lg font-black text-foreground">
                    Welcome to {library.name}
                  </h3>
                  <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                    Please punch your Member ID or phone number when entering or leaving the reading hall. This helps us ensure your reserved seat remains protected.
                  </p>

                  <div className="pt-4 border-t border-panel-border grid grid-cols-2 gap-3 text-left font-mono">
                    <div className="p-3 rounded-xl bg-background border border-panel-border">
                      <span className="text-[10px] text-text-muted block">STUDENTS INSIDE</span>
                      <span className="text-2xl font-black text-emerald-600">
                        {kioskData.headcount.total_inside}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-background border border-panel-border">
                      <span className="text-[10px] text-text-muted block">TODAY&apos;S CHECK-INS</span>
                      <span className="text-2xl font-black text-text-main">
                        {kioskData.headcount.total_entries_today}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 2: DESK OVERSTAY RADAR (STAFF MONITORING PANEL) */}
        {/* ------------------------------------------------------------- */}
        {mode === "radar" && (
          <div className="space-y-6">
            
            {/* KPI Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 block">
                    Currently Inside
                  </span>
                  <span className="text-3xl font-black">{kioskData.headcount.total_inside}</span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                    Active students present
                  </span>
                </div>
                <span className="text-3xl">👥</span>
              </div>

              <div className={`p-4 rounded-2xl border flex items-center justify-between transition ${
                kioskData.headcount.overstay_count > 0
                  ? "bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-100 shadow-md shadow-rose-500/10"
                  : "bg-card-bg border-panel-border text-foreground"
              }`}>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 block">
                    🚨 Overstay Alerts
                  </span>
                  <span className="text-3xl font-black text-rose-600">
                    {kioskData.headcount.overstay_count}
                  </span>
                  <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                    Past shift end time
                  </span>
                </div>
                <span className="text-3xl">⏰</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 block">
                    Expiring Soon (&lt;30m)
                  </span>
                  <span className="text-3xl font-black text-amber-600">
                    {kioskData.headcount.warning_count}
                  </span>
                  <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
                    Approaching shift cutoff
                  </span>
                </div>
                <span className="text-3xl">⏳</span>
              </div>

              <div className="p-4 rounded-2xl bg-card-bg border border-panel-border text-foreground flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted block">
                    Total Punches Today
                  </span>
                  <span className="text-3xl font-black">
                    {kioskData.headcount.total_entries_today}
                  </span>
                  <span className="text-[10px] text-text-muted font-medium block mt-0.5">
                    {kioskData.headcount.checked_out_count} checked out
                  </span>
                </div>
                <span className="text-3xl">📜</span>
              </div>
            </div>

            {/* Radar Search & Filter Tabs */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card-bg border border-panel-border rounded-2xl p-2.5 shadow-xs">
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setRadarFilter("overstay")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    radarFilter === "overstay"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <span>🚨</span> Overstaying Now ({kioskData.headcount.overstay_count})
                </button>

                <button
                  type="button"
                  onClick={() => setRadarFilter("inside")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    radarFilter === "inside"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <span>🟢</span> All Currently Inside ({kioskData.headcount.total_inside})
                </button>

                <button
                  type="button"
                  onClick={() => setRadarFilter("logs")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    radarFilter === "logs"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <span>📜</span> Gate Punch Stream
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search name, phone, or seat..."
                  value={radarSearch}
                  onChange={(e) => setRadarSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-panel-border bg-input-bg focus:outline-none focus:border-rose-500"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">🔍</span>
              </div>
            </div>

            {/* TAB 1: Overstay Violations Table */}
            {radarFilter === "overstay" && (
              <div className="bg-card-bg border border-panel-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-panel-border flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-rose-600 flex items-center gap-1.5">
                      <span>🚨</span> Active Shift Overstay Violations
                    </h3>
                    <p className="text-xs text-text-muted">
                      Students registered for Morning/Evening shifts who are still occupying seats past their shift hours.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadKioskData}
                    className="px-3 py-1 rounded-xl border border-panel-border bg-neutral-500/10 hover:bg-neutral-500/20 text-xs font-bold transition flex items-center gap-1"
                  >
                    🔄 Refresh
                  </button>
                </div>

                {filteredOverstay.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <span className="text-4xl">🎉</span>
                    <h4 className="text-base font-bold text-foreground">Zero Overstay Violations</h4>
                    <p className="text-xs text-text-muted max-w-sm mx-auto">
                      All students currently inside are within their valid shift hours or hold full-day passes.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-panel-border bg-neutral-500/5 text-text-muted font-black uppercase text-[10px]">
                          <th className="p-3">Seat #</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Allocated Shift</th>
                          <th className="p-3">Check-In Time</th>
                          <th className="p-3">Shift Cutoff</th>
                          <th className="p-3">Overstay Duration</th>
                          <th className="p-3 text-right">Desk Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-panel-border">
                        {filteredOverstay.map((st) => {
                          const waLink = generateOverstayWhatsAppLink(st);
                          return (
                            <tr key={st.student_id} className="hover:bg-rose-500/5 transition">
                              <td className="p-3 font-mono font-black text-rose-600">
                                Seat #{st.seat_number || "—"}
                              </td>
                              <td className="p-3 font-bold text-foreground">
                                <div>{st.student_name}</div>
                                <div className="text-[10px] text-text-muted font-mono">{st.student_phone || `#${st.student_id}`}</div>
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-md bg-neutral-500/10 text-[11px] font-bold">
                                  {st.subscription_type} ({st.shift_type || "shift_1"})
                                </span>
                              </td>
                              <td className="p-3 font-mono text-text-muted">
                                {st.punch_time_formatted}
                              </td>
                              <td className="p-3 font-mono font-bold text-neutral-600">
                                {st.shift_end_time}
                              </td>
                              <td className="p-3">
                                <span className="px-2.5 py-1 rounded-full bg-red-500 text-white font-black text-xs inline-flex items-center gap-1 shadow-2xs">
                                  <span>🚨</span> {st.overstay_formatted}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {waLink && (
                                    <a
                                      href={waLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow-2xs flex items-center gap-1"
                                      title="Send WhatsApp shift end notice"
                                    >
                                      <span>💬</span> WhatsApp
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleDeskCheckout(st.student_id, st.student_name)}
                                    className="px-2.5 py-1 rounded-lg border border-rose-500/40 hover:bg-rose-500/10 text-rose-600 text-[11px] font-bold transition"
                                    title="Punch out from desk"
                                  >
                                    Check Out
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: All Inside Students Table */}
            {radarFilter === "inside" && (
              <div className="bg-card-bg border border-panel-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-panel-border flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-foreground">
                      🟢 All Students Currently Inside Hall ({filteredInside.length})
                    </h3>
                    <p className="text-xs text-text-muted">
                      Live registry of everyone currently in the building.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-panel-border bg-neutral-500/5 text-text-muted font-black uppercase text-[10px]">
                        <th className="p-3">Seat #</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Shift</th>
                        <th className="p-3">Punch-In Time</th>
                        <th className="p-3">Shift Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-panel-border">
                      {filteredInside.map((st) => (
                        <tr key={st.student_id} className="hover:bg-neutral-500/5 transition">
                          <td className="p-3 font-mono font-black text-rose-600">
                            Seat #{st.seat_number || "—"}
                          </td>
                          <td className="p-3 font-bold text-foreground">
                            <div>{st.student_name}</div>
                            <div className="text-[10px] text-text-muted font-mono">{st.student_phone || `#${st.student_id}`}</div>
                          </td>
                          <td className="p-3 font-medium">
                            {st.subscription_type} ({st.shift_type || "full"})
                          </td>
                          <td className="p-3 font-mono text-text-muted">
                            {st.punch_time_formatted}
                          </td>
                          <td className="p-3">
                            {st.is_overstay ? (
                              <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 font-bold text-[10px]">
                                🚨 Overstaying ({st.overstay_formatted})
                              </span>
                            ) : st.is_warning ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold text-[10px]">
                                ⏳ Ends in {st.minutes_remaining}m
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold text-[10px]">
                                🟢 Valid ({st.shift_end_time})
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeskCheckout(st.student_id, st.student_name)}
                              className="px-2.5 py-1 rounded-lg border border-panel-border hover:bg-neutral-500/10 text-text-muted hover:text-text-main text-[11px] font-bold transition"
                            >
                              Check Out
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: Recent Activity Stream */}
            {radarFilter === "logs" && (
              <div className="bg-card-bg border border-panel-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-panel-border">
                  <h3 className="text-sm font-black text-foreground">
                    📜 Today&apos;s Gate Access Feed ({kioskData.recent_logs.length} Punches)
                  </h3>
                  <p className="text-xs text-text-muted">
                    Live chronological record of all IN and OUT punches for today.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-panel-border bg-neutral-500/5 text-text-muted font-black uppercase text-[10px]">
                        <th className="p-3">Time</th>
                        <th className="p-3">Event</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Seat #</th>
                        <th className="p-3">Shift</th>
                        <th className="p-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-panel-border">
                      {kioskData.recent_logs.map((log) => {
                        const pDate = new Date(log.punch_time);
                        const tStr = new Intl.DateTimeFormat("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        }).format(pDate);

                        return (
                          <tr key={log.id} className="hover:bg-neutral-500/5 transition">
                            <td className="p-3 font-mono text-text-muted">{tStr}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                log.punch_type === "in"
                                  ? "bg-emerald-500/15 text-emerald-600"
                                  : "bg-rose-500/15 text-rose-600"
                              }`}>
                                {log.punch_type === "in" ? "🟢 Punch In" : "🔴 Punch Out"}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-foreground">{log.student_name}</td>
                            <td className="p-3 font-mono font-bold text-rose-600">Seat #{log.seat_number || "—"}</td>
                            <td className="p-3 text-text-muted">{log.subscription_type}</td>
                            <td className="p-3 text-[10px] text-text-muted font-mono">{log.notes || "Kiosk"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
