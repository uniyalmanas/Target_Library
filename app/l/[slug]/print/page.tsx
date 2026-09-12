"use client";

import React, { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { Library, LibrarySettings } from "@/lib/types";
import { FALLBACK_TARGET_LIBRARY, FALLBACK_SETTINGS, isDemoSlug } from "@/lib/tenant";
import LibraryLogo from "@/lib/LibraryLogo";
import HeaderNavbar from "@/lib/HeaderNavbar";
import { generateUpiIntentUrl } from "@/lib/upi";

type TemplateType = "entrance_poster" | "counter_tent" | "wifi_card" | "rules_poster";
type ThemeColor = "crimson" | "sapphire" | "emerald" | "amber" | "mono";

interface PrintPreferences {
  template: TemplateType;
  theme: ThemeColor;
  headline: string;
  tagline: string;
  phone: string;
  address: string;
  hours: string;
  wifiSsid: string;
  wifiPassword: string;
  pricingCallout: string;
  qrType: "join" | "upi";
  wifiLayout: "single" | "quad";
  showFoldGuide: boolean;
}

export default function PrintableStudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [library, setLibrary] = useState<Library>(FALLBACK_TARGET_LIBRARY);
  const [settings, setSettings] = useState<LibrarySettings>(FALLBACK_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Studio Customization States
  const [template, setTemplate] = useState<TemplateType>("entrance_poster");
  const [theme, setTheme] = useState<ThemeColor>("crimson");
  const [qrType, setQrType] = useState<"join" | "upi">("join");
  const [wifiLayout, setWifiLayout] = useState<"single" | "quad">("quad");
  const [showFoldGuide, setShowFoldGuide] = useState(true);

  // Editable Content Fields
  const [headline, setHeadline] = useState("");
  const [tagline, setTagline] = useState("Air-Conditioned Silent Study Lounge & Reading Room");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState("Open Daily: 6:00 AM – 12:00 Midnight");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [pricingCallout, setPricingCallout] = useState("Flexible Monthly Plans • Starting @ ₹600/mo");

  // Amenities Selected
  const [amenities, setAmenities] = useState<{ id: string; label: string; icon: string; enabled: boolean }[]>([
    { id: "wifi", label: "Commercial 300 Mbps Fiber Wi-Fi", icon: "⚡", enabled: true },
    { id: "ac", label: "Full Central Air Conditioning", icon: "❄️", enabled: true },
    { id: "power", label: "Personal Charging Socket at Every Desk", icon: "🔌", enabled: true },
    { id: "water", label: "Chilled RO Drinking Water & Tea", icon: "💧", enabled: true },
    { id: "desk", label: "Wide Ergonomic Cushion Chairs", icon: "🪑", enabled: true },
    { id: "cctv", label: "24/7 CCTV & Peaceful Ambiance", icon: "📹", enabled: true },
  ]);

  // Preview zoom level
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const printContainerRef = useRef<HTMLDivElement>(null);
  const [currentOrigin, setCurrentOrigin] = useState<string>("https://targetlibrary.in");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load Library & Settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentOrigin(window.location.origin);
    }

    async function loadData() {
      try {
        const res = await fetch(`/api/libraries/${slug}/settings`);
        if (res.ok) {
          const data = await res.json();
          if (data.library) {
            setLibrary(data.library);
            setHeadline(data.library.name || "The Target Library");
            setPhone(data.library.phone || "+91 94109 77059");
            setAddress(data.library.address || "Main Market, Civil Lines");
            setWifiSsid(
              slug === "target-library" ? "TargetLibrary_5G" : `${data.library.name.replace(/\s+/g, "")}_5G`
            );
            setWifiPassword("focus@2026");
          }
          if (data.settings) setSettings(data.settings);
        }
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Check localStorage for saved customizer prefs
    try {
      const saved = localStorage.getItem(`libraryos_print_prefs_${slug}`);
      if (saved) {
        const parsed: Partial<PrintPreferences> = JSON.parse(saved);
        if (parsed.template) setTemplate(parsed.template);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.headline) setHeadline(parsed.headline);
        if (parsed.tagline) setTagline(parsed.tagline);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.address) setAddress(parsed.address);
        if (parsed.hours) setHours(parsed.hours);
        if (parsed.wifiSsid) setWifiSsid(parsed.wifiSsid);
        if (parsed.wifiPassword) setWifiPassword(parsed.wifiPassword);
        if (parsed.pricingCallout) setPricingCallout(parsed.pricingCallout);
        if (parsed.qrType) setQrType(parsed.qrType);
        if (parsed.wifiLayout) setWifiLayout(parsed.wifiLayout);
      }
    } catch {
      // ignore
    }
  }, [slug]);

  // Save customizations to local storage
  const handleSaveDefaults = () => {
    try {
      const prefs: PrintPreferences = {
        template,
        theme,
        headline,
        tagline,
        phone,
        address,
        hours,
        wifiSsid,
        wifiPassword,
        pricingCallout,
        qrType,
        wifiLayout,
        showFoldGuide,
      };
      localStorage.setItem(`libraryos_print_prefs_${slug}`, JSON.stringify(prefs));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch {
      // ignore
    }
  };

  // QR Code Payload Computations
  const doorAdmissionUrl = `${currentOrigin}/l/${slug}/join`;
  const upiDeepLink = generateUpiIntentUrl({
    upiId: library.upi_id || "targetlibrary@upi",
    payeeName: library.upi_name || library.name,
    amount: 600,
    note: `Fee Payment - ${library.name}`,
  });

  const activeQrPayload = qrType === "join" ? doorAdmissionUrl : upiDeepLink;
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
    activeQrPayload
  )}`;

  // Wi-Fi QR Code Payload (WIFI:T:WPA;S:ssid;P:password;;)
  const wifiQrPayload = `WIFI:T:WPA;S:${wifiSsid || "StudyLibrary"};P:${wifiPassword || "Focus2026"};;`;
  const wifiQrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
    wifiQrPayload
  )}`;

  // Color theme class bindings
  const themeStyles = {
    crimson: {
      primary: "text-rose-700",
      bgPrimary: "bg-rose-700 text-white",
      bgSoft: "bg-rose-50 border-rose-200 text-rose-900",
      border: "border-rose-600",
      accentBadge: "bg-rose-100 text-rose-800 border-rose-300",
      divider: "bg-rose-600",
    },
    sapphire: {
      primary: "text-blue-700",
      bgPrimary: "bg-blue-700 text-white",
      bgSoft: "bg-blue-50 border-blue-200 text-blue-900",
      border: "border-blue-600",
      accentBadge: "bg-blue-100 text-blue-800 border-blue-300",
      divider: "bg-blue-600",
    },
    emerald: {
      primary: "text-emerald-800",
      bgPrimary: "bg-emerald-800 text-white",
      bgSoft: "bg-emerald-50 border-emerald-200 text-emerald-950",
      border: "border-emerald-700",
      accentBadge: "bg-emerald-100 text-emerald-900 border-emerald-300",
      divider: "bg-emerald-700",
    },
    amber: {
      primary: "text-amber-800",
      bgPrimary: "bg-amber-800 text-white",
      bgSoft: "bg-amber-50 border-amber-200 text-amber-950",
      border: "border-amber-700",
      accentBadge: "bg-amber-100 text-amber-900 border-amber-300",
      divider: "bg-amber-700",
    },
    mono: {
      primary: "text-black",
      bgPrimary: "bg-black text-white",
      bgSoft: "bg-neutral-100 border-neutral-300 text-black",
      border: "border-black",
      accentBadge: "bg-neutral-200 text-black border-neutral-400",
      divider: "bg-black",
    },
  }[theme];

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const toggleAmenity = (id: string) => {
    setAmenities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-rose-500/20">
      {/* Global Navbar */}
      <div className="no-print">
        <HeaderNavbar />
      </div>

      {/* Top Banner Toolbar */}
      <div className="no-print border-b border-panel-border bg-card-bg/70 backdrop-blur-md px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1750px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 text-lg">🖨️</span>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                Printable Entrance Poster & Counter Stand Studio
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Ready to Print
                </span>
              </h1>
              <p className="text-xs text-text-muted">
                Generate high-resolution A4 entrance posters, acrylic counter tent cards, and Wi-Fi desk stands.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDefaults}
              className="px-3 py-1.5 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Save current fields as defaults"
            >
              {savedSuccess ? "✅ Saved!" : "💾 Save Defaults"}
            </button>

            <Link
              href={`/l/${slug}/join`}
              target="_blank"
              className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>📱</span> Door Form ↗
            </Link>

            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-black shadow-md shadow-rose-600/20 transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span>🖨️</span> Print Now (Ctrl+P)
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Workspace */}
      <div className="flex-1 max-w-[1750px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Controls & Customizer Drawer (Hidden on Print) */}
        <div className="no-print lg:col-span-4 space-y-5">
          
          {/* 1. Template Selector */}
          <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-text-muted block">
              1. Select Printable Template
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTemplate("entrance_poster")}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  template === "entrance_poster"
                    ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold shadow-2xs"
                    : "border-panel-border hover:bg-neutral-500/5 text-text-muted hover:text-text-main"
                }`}
              >
                <span className="text-xl">🚪</span>
                <span className="text-xs font-bold">A4 Entrance Door</span>
                <span className="text-[10px] opacity-75">Self-Admission QR Poster</span>
              </button>

              <button
                type="button"
                onClick={() => setTemplate("counter_tent")}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  template === "counter_tent"
                    ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold shadow-2xs"
                    : "border-panel-border hover:bg-neutral-500/5 text-text-muted hover:text-text-main"
                }`}
              >
                <span className="text-xl">🪧</span>
                <span className="text-xs font-bold">Counter Tent Card</span>
                <span className="text-[10px] opacity-75">Foldable Front / Reverse</span>
              </button>

              <button
                type="button"
                onClick={() => setTemplate("wifi_card")}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  template === "wifi_card"
                    ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold shadow-2xs"
                    : "border-panel-border hover:bg-neutral-500/5 text-text-muted hover:text-text-main"
                }`}
              >
                <span className="text-xl">📶</span>
                <span className="text-xs font-bold">Table Wi-Fi Stand</span>
                <span className="text-[10px] opacity-75">Instant Connect QR code</span>
              </button>

              <button
                type="button"
                onClick={() => setTemplate("rules_poster")}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  template === "rules_poster"
                    ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold shadow-2xs"
                    : "border-panel-border hover:bg-neutral-500/5 text-text-muted hover:text-text-main"
                }`}
              >
                <span className="text-xl">📜</span>
                <span className="text-xs font-bold">Hall Rules & Silence</span>
                <span className="text-[10px] opacity-75">Code of Conduct Poster</span>
              </button>
            </div>
          </div>

          {/* 2. Color Theme Palette */}
          <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-text-muted block">
              2. Color Theme & Print Style
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "crimson", name: "Crimson Red", color: "bg-rose-600" },
                { id: "sapphire", name: "Royal Sapphire", color: "bg-blue-600" },
                { id: "emerald", name: "Emerald Focus", color: "bg-emerald-600" },
                { id: "amber", name: "Warm Gold", color: "bg-amber-600" },
                { id: "mono", name: "Ink-Saver (B&W)", color: "bg-black" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTheme(c.id as ThemeColor)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                    theme === c.id
                      ? "border-text-main bg-neutral-500/15 font-extrabold scale-105"
                      : "border-panel-border hover:bg-neutral-500/5 text-text-muted"
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${c.color}`} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* 3. QR Destination Selection */}
          <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-text-muted block">
              3. QR Code Destination
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQrType("join")}
                className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                  qrType === "join"
                    ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "border-panel-border text-text-muted hover:text-text-main"
                }`}
              >
                <div className="font-extrabold">🚪 Door Self-Admission</div>
                <div className="text-[10px] opacity-75 font-mono truncate">/l/{slug}/join</div>
              </button>

              <button
                type="button"
                onClick={() => setQrType("upi")}
                className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                  qrType === "upi"
                    ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "border-panel-border text-text-muted hover:text-text-main"
                }`}
              >
                <div className="font-extrabold">💸 Direct UPI Soundbox</div>
                <div className="text-[10px] opacity-75 font-mono truncate">{library.upi_id || "targetlibrary@upi"}</div>
              </button>
            </div>
          </div>

          {/* 4. Live Content Customization Inputs */}
          <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm space-y-3.5">
            <label className="text-xs font-black uppercase tracking-wider text-text-muted block">
              4. Document Text & Details
            </label>

            <div>
              <label className="text-[11px] font-bold text-text-muted block mb-1">Library Name / Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="The Target Library"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-panel-border bg-input-bg focus:border-rose-500 outline-none font-semibold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-text-muted block mb-1">Subtitle / Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Air-Conditioned Silent Study Lounge & Reading Room"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-panel-border bg-input-bg focus:border-rose-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-text-muted block mb-1">Helpline Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 94109 77059"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-panel-border bg-input-bg focus:border-rose-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-muted block mb-1">Operating Hours</label>
                <input
                  type="text"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="6:00 AM – 12:00 AM"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-panel-border bg-input-bg focus:border-rose-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-text-muted block mb-1">Address / Landmark</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="2nd Floor, Civil Lines, Opposite SBI"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-panel-border bg-input-bg focus:border-rose-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-text-muted block mb-1">Wi-Fi Network Name</label>
                <input
                  type="text"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="TargetLibrary_5G"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-panel-border bg-input-bg focus:border-rose-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-muted block mb-1">Wi-Fi Password</label>
                <input
                  type="text"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="focus@2026"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-panel-border bg-input-bg focus:border-rose-500 outline-none font-mono"
                />
              </div>
            </div>

            {template === "entrance_poster" && (
              <div>
                <label className="text-[11px] font-bold text-text-muted block mb-1">Pricing Callout</label>
                <input
                  type="text"
                  value={pricingCallout}
                  onChange={(e) => setPricingCallout(e.target.value)}
                  placeholder="Flexible Monthly Plans • Starting @ ₹600/mo"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-panel-border bg-input-bg focus:border-rose-500 outline-none"
                />
              </div>
            )}

            {template === "entrance_poster" && (
              <div>
                <label className="text-[11px] font-bold text-text-muted block mb-1">Amenities Checklist</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {amenities.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleAmenity(item.id)}
                      className={`px-2 py-1 rounded-lg border text-[11px] text-left transition flex items-center gap-1.5 cursor-pointer ${
                        item.enabled
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                          : "border-panel-border text-text-muted opacity-60 line-through"
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span className="truncate">{item.label.split(" ")[0]} {item.label.split(" ")[1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {template === "counter_tent" && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-text-muted">Show Center Fold Line Guide</span>
                <input
                  type="checkbox"
                  checked={showFoldGuide}
                  onChange={(e) => setShowFoldGuide(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
              </div>
            )}

            {template === "wifi_card" && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-text-muted">Layout Format</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setWifiLayout("single")}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      wifiLayout === "single"
                        ? "bg-rose-500/15 border-rose-500 text-rose-600"
                        : "border-panel-border text-text-muted"
                    }`}
                  >
                    1 Big Stand
                  </button>
                  <button
                    type="button"
                    onClick={() => setWifiLayout("quad")}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      wifiLayout === "quad"
                        ? "bg-rose-500/15 border-rose-500 text-rose-600"
                        : "border-panel-border text-text-muted"
                    }`}
                  >
                    4-in-1 Sheet (Desk cutouts)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Print instructions card */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-xs space-y-2 text-text-details">
            <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <span>💡</span> Optimal Printing Instructions:
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-text-muted leading-relaxed">
              <li>Use <strong>A4 Portrait</strong> paper size in your printer settings.</li>
              <li>Check <strong>&quot;Background graphics&quot;</strong> in your browser print window to ensure badges and colors print vividly.</li>
              <li>Set Margins to <strong>Default</strong> or <strong>Minimum</strong> (approx 8mm).</li>
              <li>Select <strong>Monochrome theme</strong> above if using a basic black-and-white office laser printer to save toner.</li>
            </ul>
          </div>
        </div>

        {/* Right Side: Print Preview Canvas */}
        <div className="lg:col-span-8 flex flex-col items-center">
          
          {/* Zoom & View Toolbar */}
          <div className="no-print w-full flex items-center justify-between mb-3 px-2">
            <div className="text-xs font-bold text-text-muted flex items-center gap-2">
              <span>📄 Live Print Preview (1:1 Ratio)</span>
            </div>

            <div className="flex items-center gap-1.5 bg-card-bg border border-panel-border rounded-xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                className="px-2 py-0.5 rounded-lg text-xs font-bold hover:bg-neutral-500/10 text-text-muted hover:text-text-main"
                title="Zoom Out"
              >
                −
              </button>
              <span className="text-[11px] font-mono font-bold px-1.5 text-text-muted">{zoomLevel}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="px-2 py-0.5 rounded-lg text-xs font-bold hover:bg-neutral-500/10 text-text-muted hover:text-text-main"
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="px-2 py-0.5 rounded-lg text-xs font-bold hover:bg-neutral-500/10 text-rose-600"
                title="Reset Zoom to 100%"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Printable Page Paper Simulator */}
          <div
            ref={printContainerRef}
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
            className="print-area w-full max-w-[794px] min-h-[1123px] bg-white text-neutral-900 shadow-2xl rounded-2xl overflow-hidden transition-transform duration-150 border border-neutral-200"
          >
            {/* ------------------------------------------------------------- */}
            {/* TEMPLATE 1: A4 ENTRANCE DOOR SELF-ADMISSION POSTER */}
            {/* ------------------------------------------------------------- */}
            {template === "entrance_poster" && (
              <div className="p-8 sm:p-12 flex flex-col justify-between h-full min-h-[1123px] relative bg-white">
                {/* Decorative Double Border */}
                <div className={`absolute inset-4 border-2 ${themeStyles.border} pointer-events-none rounded-xl`} />
                <div className={`absolute inset-5 border ${themeStyles.border} opacity-40 pointer-events-none rounded-lg`} />

                {/* Top Header */}
                <div className="relative z-10 text-center space-y-3 pt-2">
                  <div className="flex items-center justify-center gap-3">
                    <LibraryLogo
                      slug={slug}
                      logoUrl={library.logo_url}
                      name={headline}
                      size="xl"
                      className="shadow-sm"
                    />
                    <div className="text-left">
                      <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tight ${themeStyles.primary}`}>
                        {headline || library.name}
                      </h1>
                      <p className="text-xs sm:text-sm font-semibold text-neutral-600 tracking-wide">
                        {tagline}
                      </p>
                    </div>
                  </div>

                  {/* Admissions Open Banner */}
                  <div className="pt-1">
                    <div className={`inline-block px-6 py-1.5 rounded-full text-xs sm:text-sm font-black tracking-widest uppercase shadow-sm ${themeStyles.bgPrimary}`}>
                      ✨ ADMISSIONS OPEN • SILENT STUDY LOUNGE ✨
                    </div>
                  </div>
                </div>

                {/* Main Hero: Large QR Code Centerpiece */}
                <div className="relative z-10 my-4 flex flex-col items-center text-center space-y-3">
                  <div className={`p-4 rounded-3xl bg-white border-4 ${themeStyles.border} shadow-lg max-w-[280px]`}>
                    <img
                      src={qrImageSrc}
                      alt="Student Admission QR Code"
                      className="w-56 h-56 object-contain rounded-xl"
                    />
                    <div className="mt-2 text-[11px] font-black text-neutral-800 uppercase tracking-wider">
                      {qrType === "join" ? "Scan with Phone Camera" : "Scan to Pay via UPI"}
                    </div>
                  </div>

                  {/* 3-Step Simple Guide */}
                  <div className="w-full max-w-lg grid grid-cols-3 gap-2 text-center pt-2">
                    <div className={`p-2 rounded-xl border ${themeStyles.bgSoft}`}>
                      <div className="text-base font-black">1. 📱 Scan</div>
                      <div className="text-[10px] font-medium leading-tight mt-0.5">Open camera & tap the link</div>
                    </div>
                    <div className={`p-2 rounded-xl border ${themeStyles.bgSoft}`}>
                      <div className="text-base font-black">2. ✍️ Register</div>
                      <div className="text-[10px] font-medium leading-tight mt-0.5">Enter details & pick shift</div>
                    </div>
                    <div className={`p-2 rounded-xl border ${themeStyles.bgSoft}`}>
                      <div className="text-base font-black">3. 🪑 Start</div>
                      <div className="text-[10px] font-medium leading-tight mt-0.5">Show desk & take your seat</div>
                    </div>
                  </div>
                </div>

                {/* Key Amenities Grid */}
                <div className="relative z-10 space-y-2">
                  <div className="text-center">
                    <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500">
                      — Premium Study Facilities Included —
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {amenities.filter((a) => a.enabled).map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl border border-neutral-200 bg-neutral-50/70 flex items-center gap-2.5 text-left"
                      >
                        <span className="text-lg shrink-0">{item.icon}</span>
                        <span className="text-xs font-bold text-neutral-800 leading-tight">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing / Plan Callout */}
                <div className="relative z-10 text-center pt-2">
                  <div className={`p-3 rounded-2xl border-2 border-dashed ${themeStyles.border} bg-neutral-50 flex items-center justify-around flex-wrap gap-2`}>
                    <div className="text-left">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase">Membership Rates</div>
                      <div className={`text-sm font-black ${themeStyles.primary}`}>{pricingCallout}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase">Daily Timings</div>
                      <div className="text-xs font-extrabold text-neutral-800">{hours}</div>
                    </div>
                  </div>
                </div>

                {/* Footer Bar with Address & Contact */}
                <div className="relative z-10 pt-4 border-t-2 border-neutral-200 flex flex-wrap items-center justify-between text-xs text-neutral-700 gap-2">
                  <div className="flex items-center gap-2 font-bold">
                    <span>📞 Helpline / WhatsApp:</span>
                    <span className="font-mono text-sm font-black text-neutral-900">{phone}</span>
                  </div>
                  <div className="text-right font-medium text-[11px] text-neutral-600 max-w-xs truncate">
                    📍 {address}
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TEMPLATE 2: RECEPTION COUNTER TENT CARD (FOLDABLE) */}
            {/* ------------------------------------------------------------- */}
            {template === "counter_tent" && (
              <div className="p-8 flex flex-col justify-between h-full min-h-[1123px] relative bg-white">
                {/* Top Half: Front Facing Student */}
                <div className="flex-1 flex flex-col justify-between p-6 border-2 border-neutral-300 rounded-2xl bg-white relative">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                    <div className="flex items-center gap-3">
                      <LibraryLogo slug={slug} logoUrl={library.logo_url} name={headline} size="lg" />
                      <div>
                        <h2 className={`text-xl font-black uppercase tracking-tight ${themeStyles.primary}`}>
                          {headline || library.name}
                        </h2>
                        <p className="text-[11px] font-semibold text-neutral-600">Front Desk Counter Stand</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${themeStyles.bgPrimary}`}>
                      Self-Admission & Renewals
                    </span>
                  </div>

                  <div className="my-4 flex items-center justify-around gap-4">
                    <div className={`p-3 rounded-2xl border-2 ${themeStyles.border} bg-white shadow-sm shrink-0`}>
                      <img src={qrImageSrc} alt="Admission QR" className="w-40 h-40 object-contain rounded-lg" />
                    </div>
                    <div className="space-y-2 max-w-xs text-left">
                      <h3 className="text-base font-black text-neutral-900">
                        {qrType === "join" ? "📱 Scan to Admit or Renew" : "💸 Scan to Pay Monthly Fee"}
                      </h3>
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        Instant digital registration on your phone. Submit your details & UPI Soundbox UTR here at the counter.
                      </p>
                      <div className="p-2 rounded-xl bg-neutral-100 text-[11px] font-mono text-neutral-800 space-y-0.5 border border-neutral-200">
                        <div><strong>UPI ID:</strong> {library.upi_id || "targetlibrary@upi"}</div>
                        <div><strong>Payee:</strong> {library.upi_name || library.name}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-600 border-t border-neutral-200 pt-2">
                    <span>📞 {phone}</span>
                    <span>📍 {address}</span>
                  </div>
                </div>

                {/* Central Fold Line Indicator */}
                {showFoldGuide && (
                  <div className="my-6 flex items-center justify-center gap-3 text-neutral-400 text-xs font-mono font-bold select-none">
                    <span className="w-16 border-t-2 border-dashed border-neutral-400" />
                    <span>✂️ FOLD HERE FOR 3D ACRYLIC STAND / TENT CARD ✂️</span>
                    <span className="w-16 border-t-2 border-dashed border-neutral-400" />
                  </div>
                )}

                {/* Bottom Half: Reverse Side Facing Hall or Desk */}
                <div className="flex-1 flex flex-col justify-between p-6 border-2 border-neutral-300 rounded-2xl bg-neutral-50 relative">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🤫</span>
                      <div>
                        <h2 className="text-lg font-black text-neutral-900">Study Hall Etiquette & Rules</h2>
                        <p className="text-[11px] text-neutral-600">Please maintain an undisturbed environment</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-neutral-500">Notice Board</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 my-4">
                    <div className="p-3 rounded-xl bg-white border border-neutral-200 text-left space-y-1">
                      <div className="text-xs font-black text-neutral-900 flex items-center gap-1.5">
                        <span>🤫</span> 1. Strict Silence Zone
                      </div>
                      <div className="text-[11px] text-neutral-600 leading-tight">
                        Zero talking or whispers inside study hall. Use lobby for phone calls.
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-neutral-200 text-left space-y-1">
                      <div className="text-xs font-black text-neutral-900 flex items-center gap-1.5">
                        <span>📵</span> 2. Mobile on Silent
                      </div>
                      <div className="text-[11px] text-neutral-600 leading-tight">
                        Turn off ringers and vibration alarms before entering the hall.
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-neutral-200 text-left space-y-1">
                      <div className="text-xs font-black text-neutral-900 flex items-center gap-1.5">
                        <span>👟</span> 3. Shoe Discipline
                      </div>
                      <div className="text-[11px] text-neutral-600 leading-tight">
                        Place shoes neatly in the outside shoe rack to maintain cleanliness.
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-neutral-200 text-left space-y-1">
                      <div className="text-xs font-black text-neutral-900 flex items-center gap-1.5">
                        <span>📶</span> 4. Wi-Fi Access
                      </div>
                      <div className="text-[11px] font-mono text-neutral-700 leading-tight">
                        SSID: <strong>{wifiSsid || "StudyLibrary"}</strong><br />
                        Pass: <strong>{wifiPassword || "focus2026"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-neutral-500 font-medium border-t border-neutral-200 pt-2">
                    Thank you for keeping our reading hall peaceful and productive for everyone.
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TEMPLATE 3: TABLE WI-FI STAND (SINGLE OR 4-UP) */}
            {/* ------------------------------------------------------------- */}
            {template === "wifi_card" && (
              <div className="p-8 h-full min-h-[1123px] flex flex-col justify-between bg-white">
                {wifiLayout === "single" ? (
                  // Single Big Wi-Fi Stand Card
                  <div className="flex-1 flex flex-col items-center justify-center p-8 border-4 border-neutral-800 rounded-3xl text-center space-y-6">
                    <div className="flex items-center gap-3">
                      <LibraryLogo slug={slug} logoUrl={library.logo_url} name={headline} size="xl" />
                      <div className="text-left">
                        <h2 className={`text-2xl font-black uppercase ${themeStyles.primary}`}>
                          {headline || library.name}
                        </h2>
                        <p className="text-xs font-bold text-neutral-600">High-Speed Commercial Wi-Fi Network</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-3xl bg-white border-4 border-neutral-900 shadow-xl">
                      <img src={wifiQrImageSrc} alt="Wi-Fi QR Code" className="w-64 h-64 object-contain rounded-xl" />
                      <div className="mt-2 text-xs font-black uppercase tracking-wider text-neutral-900">
                        Scan with Phone Camera to Connect Instantly
                      </div>
                    </div>

                    <div className="w-full max-w-md p-4 rounded-2xl bg-neutral-100 border-2 border-neutral-300 font-mono text-left space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500 font-bold">Network (SSID):</span>
                        <span className="font-black text-neutral-900 text-base">{wifiSsid || "StudyLibrary_5G"}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-neutral-300 pt-2">
                        <span className="text-neutral-500 font-bold">Password:</span>
                        <span className="font-black text-neutral-900 text-base">{wifiPassword || "focus@2026"}</span>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-500 max-w-sm">
                      Please avoid high-bandwidth streaming or torrent downloads to preserve speeds for all students.
                    </p>
                  </div>
                ) : (
                  // 4-in-1 Sheet for Cutting Out Individual Desk Stands
                  <div className="grid grid-cols-2 grid-rows-2 gap-6 h-full flex-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="p-5 border-2 border-dashed border-neutral-400 rounded-2xl flex flex-col justify-between text-center bg-white"
                      >
                        <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                          <div className="text-left">
                            <div className={`text-xs font-black uppercase truncate max-w-[140px] ${themeStyles.primary}`}>
                              {headline || library.name}
                            </div>
                            <div className="text-[9px] text-neutral-500">Desk Wi-Fi Hotspot</div>
                          </div>
                          <span className="text-xl">📶</span>
                        </div>

                        <div className="my-2 flex flex-col items-center">
                          <img src={wifiQrImageSrc} alt="Wi-Fi QR" className="w-28 h-28 object-contain rounded-lg border border-neutral-300 p-1" />
                          <span className="text-[9px] font-bold text-neutral-600 mt-1">Scan camera to auto-connect</span>
                        </div>

                        <div className="p-2 rounded-xl bg-neutral-100 font-mono text-[10px] text-left space-y-0.5 border border-neutral-200">
                          <div><strong>SSID:</strong> {wifiSsid || "StudyLibrary"}</div>
                          <div><strong>Pass:</strong> {wifiPassword || "focus@2026"}</div>
                        </div>

                        <div className="text-[8px] text-neutral-400 mt-1 font-mono">
                          ✂️ Cut along dashed border for desk stand #{i}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TEMPLATE 4: READING HALL QUIET STUDY RULES POSTER */}
            {/* ------------------------------------------------------------- */}
            {template === "rules_poster" && (
              <div className="p-10 sm:p-14 flex flex-col justify-between h-full min-h-[1123px] relative bg-white">
                {/* Border Frame */}
                <div className="absolute inset-4 border-4 border-neutral-900 pointer-events-none rounded-xl" />
                <div className="absolute inset-6 border border-neutral-400 pointer-events-none rounded-lg" />

                <div className="relative z-10 text-center space-y-2 pt-2">
                  <LibraryLogo slug={slug} logoUrl={library.logo_url} name={headline} size="xl" className="mx-auto" />
                  <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-900">
                    {headline || library.name}
                  </h1>
                  <div className="inline-block px-4 py-1 rounded-full bg-neutral-900 text-white text-xs font-black uppercase tracking-widest">
                    Reading Hall Rules & Silence Protocol
                  </div>
                </div>

                <div className="relative z-10 space-y-4 my-6">
                  {[
                    { num: "01", icon: "🤫", title: "Maintain Absolute Silence", desc: "No talking, discussions, or whispering in the study hall. For conversations, please step outside to the lobby." },
                    { num: "02", icon: "📵", title: "Mute All Mobile Phones", desc: "Keep all devices on complete Silent or Vibrate mode. Phone calls must be answered outside the hall doors." },
                    { num: "03", icon: "👟", title: "Footwear Discipline", desc: "Leave shoes and slippers in the designated shoe rack at the entrance. Barefoot or socks only in the carpeted area." },
                    { num: "04", icon: "🔌", title: "Dedicated Desk & Charging", desc: "Sit only on your allocated seat. Sockets are meant for study devices (laptop/tablet/phone) only." },
                    { num: "05", icon: "⏰", title: "Shift Punctuality", desc: "Please vacate your seat on time at the end of your shift to avoid inconvenience to the incoming student." },
                    { num: "06", icon: "🗑️", title: "Cleanliness & Desk Care", desc: "Keep your carrel tidy. Dispose of wrappers and waste in the dustbins. Food items are strictly prohibited inside." },
                  ].map((rule) => (
                    <div key={rule.num} className="p-3.5 rounded-xl border border-neutral-300 bg-neutral-50 flex items-start gap-4 text-left">
                      <span className="font-mono text-base font-black text-neutral-400">{rule.num}</span>
                      <span className="text-2xl shrink-0">{rule.icon}</span>
                      <div>
                        <h3 className="text-sm font-black text-neutral-900 leading-snug">{rule.title}</h3>
                        <p className="text-xs text-neutral-600 leading-relaxed mt-0.5">{rule.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative z-10 pt-4 border-t-2 border-neutral-300 flex items-center justify-between text-xs text-neutral-600">
                  <div>
                    <p className="font-bold text-neutral-800">Authorized by Administration</p>
                    <p className="text-[10px] text-neutral-500">Helpline: {phone}</p>
                  </div>
                  <div className="text-right text-[11px] text-neutral-500 max-w-xs">
                    Thank you for your cooperation in maintaining an elite, focused study atmosphere.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Print Styling */}
      <style jsx global>{`
        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
        }
      `}</style>
    </div>
  );
}
