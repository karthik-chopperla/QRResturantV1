import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      {/* Subtle Dot Grid Background (reduced to approx 1% opacity slate dots) */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.025)_1.5px,transparent_1.5px)] [background-size:24px_24px] pointer-events-none" />

      {/* Back to Home Link absolute in top-left (aligned 40-48px from edges) */}
      <Link
        href="/"
        className="absolute top-6 left-10 sm:top-8 sm:left-12 z-50 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-[#0F172A] transition-all duration-200 group"
      >
        <span className="transition-transform duration-200 group-hover:-translate-x-0.5">&larr;</span> Back to Home
      </Link>

      {/* Floating Theme Toggle absolute in top-right (aligned 40-48px from edges) */}
      <div className="absolute top-6 right-10 sm:top-8 sm:right-12 z-50">
        <ThemeToggle />
      </div>

      <main className="w-full flex items-center justify-center py-12 z-10">
        {children}
      </main>
    </div>
  );
}
