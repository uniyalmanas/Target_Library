"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.theme;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (savedTheme === "light" || (!savedTheme && !systemPrefersDark)) {
      document.documentElement.classList.remove("dark");
      setTheme("light");
    } else {
      document.documentElement.classList.add("dark");
      setTheme("dark");
    }
  }, []);

  const toggleTheme = () => {
    if (theme === "dark") {
      document.documentElement.classList.remove("dark");
      localStorage.theme = "light";
      setTheme("light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.theme = "dark";
      setTheme("dark");
    }
  };

  if (!mounted) {
    return (
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-200 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 animate-pulse shrink-0" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-200/80 dark:bg-neutral-900/80 hover:bg-neutral-300 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-800 transition-all cursor-pointer flex items-center justify-center shadow-xs shrink-0 active:scale-95"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <span className="text-amber-400 text-base leading-none select-none">☀️</span>
      ) : (
        <span className="text-indigo-400 text-base leading-none select-none">🌙</span>
      )}
    </button>
  );
}
