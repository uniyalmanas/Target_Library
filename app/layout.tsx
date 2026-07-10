import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import ThemeToggle from "@/lib/ThemeToggle";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "The Target Library — Management System",
  description: "Seat, member and subscription management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (localStorage.theme === 'light' || (!('theme' in localStorage) && !window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.remove('dark')
              } else {
                document.documentElement.classList.add('dark')
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans relative overflow-x-hidden transition-colors duration-200">
        {/* Glow effect in background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-radial from-rose-500/[calc(var(--glow-opacity)*0.7)] via-transparent to-transparent pointer-events-none z-0" />
        
        <nav className="border-b border-panel-border bg-background/70 backdrop-blur-md sticky top-0 z-50 transition-all duration-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
            <Link href="/" className="flex items-center gap-2.5 group">
              <img 
                src="/lib-logo.png" 
                alt="The Target Library Logo" 
                className="w-6 h-6 rounded-md object-contain group-hover:scale-105 transition-transform duration-200" 
              />
              <span className="font-extrabold text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-amber-500 dark:from-rose-500 dark:to-amber-400">
                THE TARGET LIBRARY
              </span>
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/" className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors">Seats</Link>
              <Link href="/new-receipt" className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors">New Receipt</Link>
              <Link href="/dashboard" className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors">Dashboard</Link>
              <Link href="/members" className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors">Members</Link>
              <Link href="/import" className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 font-medium transition-colors">Bulk Import</Link>
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8 w-full flex-1 relative z-10">{children}</main>
        
        <footer className="border-t border-panel-border bg-background py-6 mt-auto">
          <div className="max-w-6xl mx-auto px-6 text-center text-xs text-text-muted">
            &copy; {new Date().getFullYear()} The Target Library, Dehradun. Internal Study Space Management System.
          </div>
        </footer>
      </body>
    </html>
  );
}
