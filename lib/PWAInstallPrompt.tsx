"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Global programmatic install trigger
export function triggerPWAInstall() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trigger-pwa-install"));
  }
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showGenericModal, setShowGenericModal] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default true until client checks
  const [mounted, setMounted] = useState(false);

  // Handle installation action
  const handleInstallClick = useCallback(async () => {
    // 1. If already in standalone app mode
    const isWindowStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
    const isNavStandalone = typeof navigator !== "undefined" && (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isWindowStandalone || isNavStandalone) {
      alert("LibraryOS is already installed and running as an application!");
      return;
    }

    // 2. iOS Safari
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    // 3. Android / Chromium with captured beforeinstallprompt
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setDismissed(true);
          setDeferredPrompt(null);
        }
      } catch (e) {
        console.error("PWA install error", e);
      }
      return;
    }

    // 4. Fallback for browsers where prompt has not fired or desktop
    setShowGenericModal(true);
  }, [deferredPrompt, isIOS]);

  useEffect(() => {
    setMounted(true);

    // Register service worker for PWA offline & installation capability
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.debug("ServiceWorker registration skipped:", err);
      });
    }

    // 1. Check if already installed & running in standalone mode
    const checkStandalone = () => {
      const isWindowStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isNavStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
      return isWindowStandalone || isNavStandalone;
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      return;
    }

    // 2. Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Check dismiss timestamp (hide drawer for 3 days if dismissed)
    const lastDismissed = localStorage.getItem("pwa_prompt_dismissed_until");
    if (lastDismissed && Number(lastDismissed) > Date.now()) {
      setDismissed(true);
    } else {
      setDismissed(false);
    }

    // 4. Capture native Android / Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Auto display banner if not previously dismissed
      const dismissedUntil = localStorage.getItem("pwa_prompt_dismissed_until");
      if (!dismissedUntil || Number(dismissedUntil) <= Date.now()) {
        setDismissed(false);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for global programmatic trigger (e.g. from navbar or pricing button)
    const handleGlobalTrigger = () => {
      handleInstallClick();
    };
    window.addEventListener("trigger-pwa-install", handleGlobalTrigger);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("trigger-pwa-install", handleGlobalTrigger);
    };
  }, [handleInstallClick]);

  const handleDismiss = () => {
    setDismissed(true);
    // Dismiss for 3 days
    const threeDaysFromNow = Date.now() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem("pwa_prompt_dismissed_until", threeDaysFromNow.toString());
  };

  return (
    <>
      {/* Floating Bottom Action Drawer */}
      {!dismissed && !isStandalone && (
        <aside
          aria-label="Install LibraryOS Application"
          className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 print:hidden"
        >
          <div className="bg-card-bg/95 backdrop-blur-xl border border-panel-border shadow-2xl rounded-3xl p-4 sm:p-5 flex flex-col gap-3 relative ring-1 ring-black/5 dark:ring-white/10">
            {/* Close button */}
            <button
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              className="absolute top-3 right-3 p-1.5 rounded-full text-text-muted hover:text-text-main hover:bg-neutral-500/10 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3.5 pr-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 p-0.5 shadow-md shrink-0 flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center overflow-hidden">
                  <Image
                    src="/lib-logo.png"
                    alt="Library App Icon"
                    width={44}
                    height={44}
                    className="object-contain"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-extrabold text-sm text-text-main leading-snug">
                    Install Library Mobile App
                  </h4>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    Fast
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                  Add to your phone home screen for instant 1-tap full-screen access.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleInstallClick}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-xs shadow-md shadow-rose-600/25 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📲</span>
                <span>{isIOS ? "How to Install on iPhone" : "Install App"}</span>
              </button>
              <button
                onClick={handleDismiss}
                className="py-2.5 px-3 rounded-xl border border-panel-border bg-neutral-500/5 hover:bg-neutral-500/10 text-text-muted hover:text-text-main font-bold text-xs transition cursor-pointer"
              >
                Not Now
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs p-4 flex items-end sm:items-center justify-center animate-in fade-in duration-200"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="bg-card-bg border border-panel-border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍎</span>
                <h3 className="font-extrabold text-base text-text-main">
                  Install on iPhone / iPad
                </h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-text-muted hover:text-text-main p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Apple requires saving directly through Safari:
            </p>

            <ol className="space-y-3 text-xs text-text-main">
              <li className="flex items-start gap-3 bg-neutral-500/5 p-3 rounded-2xl border border-panel-border">
                <span className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-600 font-black flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  Tap the <strong className="text-text-main">Share</strong> button at the bottom of your Safari browser:
                  <div className="mt-1 flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>(Share icon)</span>
                  </div>
                </div>
              </li>

              <li className="flex items-start gap-3 bg-neutral-500/5 p-3 rounded-2xl border border-panel-border">
                <span className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-600 font-black flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  Scroll down the share sheet and tap <strong className="text-text-main">&quot;Add to Home Screen&quot;</strong>.
                </div>
              </li>

              <li className="flex items-start gap-3 bg-neutral-500/5 p-3 rounded-2xl border border-panel-border">
                <span className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-600 font-black flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  Tap <strong className="text-text-main">&quot;Add&quot;</strong> in the top right corner. The app icon will appear on your home screen!
                </div>
              </li>
            </ol>

            <button
              onClick={() => {
                setShowIOSModal(false);
                handleDismiss();
              }}
              className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md transition active:scale-95"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Generic Browser / Desktop Instructions Modal */}
      {showGenericModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setShowGenericModal(false)}
        >
          <div
            className="bg-card-bg border border-panel-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📲</span>
                <h3 className="font-extrabold text-base text-text-main">
                  Install LibraryOS App
                </h3>
              </div>
              <button
                onClick={() => setShowGenericModal(false)}
                className="text-text-muted hover:text-text-main p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted">
              You can install LibraryOS as a native lightweight app directly through your browser:
            </p>

            <div className="space-y-2.5 text-xs text-text-main">
              <div className="bg-neutral-500/5 p-3.5 rounded-2xl border border-panel-border space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-text-main">
                  <span>🤖</span> On Android (Chrome / Edge / Samsung)
                </div>
                <p className="text-text-muted text-[11px] leading-relaxed">
                  Tap the three dots menu <strong className="text-text-main">(⋮)</strong> at the top right of your browser, then tap <strong className="text-rose-600 dark:text-rose-400">&quot;Install App&quot;</strong> or <strong className="text-text-main">&quot;Add to Home screen&quot;</strong>.
                </p>
              </div>

              <div className="bg-neutral-500/5 p-3.5 rounded-2xl border border-panel-border space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-text-main">
                  <span>💻</span> On Windows / Mac / Chromebook
                </div>
                <p className="text-text-muted text-[11px] leading-relaxed">
                  Look for the <strong className="text-rose-600 dark:text-rose-400">Install app icon (⊞)</strong> on the right end of your browser address/URL bar, and click <strong>Install</strong>.
                </p>
              </div>

              <div className="bg-neutral-500/5 p-3.5 rounded-2xl border border-panel-border space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-text-main">
                  <span>🍎</span> On iPhone / iPad
                </div>
                <p className="text-text-muted text-[11px] leading-relaxed">
                  Tap the Safari <strong>Share</strong> button <span className="font-mono">⎋</span> and select <strong className="text-text-main">&quot;Add to Home Screen&quot;</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGenericModal(false)}
              className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md transition active:scale-95 cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
