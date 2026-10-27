import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Bebas_Neue, Geist_Mono, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui";
import { Football, Ticker } from "@/components/graphics";
import LogoutButton from "@/components/LogoutButton";
import { authEnabled } from "@/lib/auth";
import "./globals.css";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const bebas = Bebas_Neue({ variable: "--font-bebas", subsets: ["latin"], weight: "400" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Comment Picker",
  description: "Verify Instagram contest entries against your rules and draw winners fairly.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${bebas.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <header className="sticky top-0 z-40 bg-kbfc-navy/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
            <Link href="/" className="group flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-kbfc-yellow shadow-glow ring-2 ring-white/80 transition group-hover:rotate-[25deg]">
                <Football className="h-8 w-8" />
              </span>
              <span className="leading-none">
                <span className="font-display block text-2xl text-white">
                  Comment <span className="text-kbfc-yellow">Picker</span>
                </span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55 sm:block">Predict · Comment · Win</span>
              </span>
            </Link>
            <nav className="flex gap-1 text-sm font-semibold">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-white/80 transition hover:bg-white/10 hover:text-kbfc-yellow">Contests</Link>
              <Link href="/settings" className="rounded-lg px-3 py-1.5 text-white/80 transition hover:bg-white/10 hover:text-kbfc-yellow">Settings</Link>
              {authEnabled() && <LogoutButton />}
            </nav>
          </div>
          <div className="h-1.5 bg-[repeating-linear-gradient(-45deg,#fed100_0_10px,#f7ea48_10px_20px)]" />
        </header>
        <Ticker />
        <main className="mx-auto max-w-6xl overflow-x-clip px-4 pb-16 pt-8">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
