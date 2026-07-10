"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "Target2026";
    
    if (password === correctPassword) {
      sessionStorage.setItem("target_lib_auth", "true");
      router.replace("/");
      // Force page refresh to update Navbar state
      setTimeout(() => {
        window.location.reload();
      }, 50);
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="bg-panel-bg border border-panel-border rounded-2xl p-8 w-full max-w-sm shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-radial from-rose-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col items-center text-center mb-6">
          <img 
            src="/lib-logo.png" 
            alt="The Target Library Logo" 
            className="w-14 h-14 object-contain mb-3"
          />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Librarian Portal
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Sign in to manage seats, billing, and members.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
              Enter Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
              required
              className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-rose-500 transition-all font-mono"
            />
          </div>

          {error && (
            <p className="text-rose-600 dark:text-rose-400 text-xs font-semibold">
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-2.5 rounded-lg shadow-md shadow-rose-600/10 cursor-pointer transition-all active:scale-95"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
