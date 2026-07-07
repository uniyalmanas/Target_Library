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
      <div className="w-[100px] h-8 rounded-lg bg-neutral-200 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 animate-pulse" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 px-3 rounded-lg bg-neutral-200 dark:bg-neutral-900 hover:bg-neutral-300 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-800 transition-all cursor-pointer flex items-center justify-center font-semibold text-xs gap-1.5 shadow-xs"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <>
          <span className="text-amber-500">☀️</span> Light Mode
        </>
      ) : (
        <>
          <span className="text-indigo-400">🌙</span> Dark Mode
        </>
      )}
    </button>
  );
}
