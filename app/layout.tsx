import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import HeaderNavbar from "@/lib/HeaderNavbar";
import TenantFooter from "@/lib/TenantFooter";
import AuthGate from "@/lib/AuthGate";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Library Management System",
  description: "Seat, member and subscription management workspace",
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1850px] h-[500px] bg-radial from-rose-500/[calc(var(--glow-opacity)*0.7)] via-transparent to-transparent pointer-events-none z-0" />
        
        <HeaderNavbar />
        <main className="w-full flex-1 relative z-10 flex flex-col">
          <AuthGate>{children}</AuthGate>
        </main>
        
        <TenantFooter />
      </body>
    </html>
  );
}
