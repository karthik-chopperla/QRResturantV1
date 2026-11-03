import Image from "next/image";
import Link from "next/link";
import logoImage from "@/assets/images/dinedesk-logo.png";

export default function Hero() {
  return (
    <main className="min-h-screen bg-slate-950">
      <header className="mx-auto flex h-24 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="DineDesk home" className="relative block h-20 w-32 sm:h-22 sm:w-40">
          <Image
            src={logoImage}
            alt="DineDesk Restaurant Management System"
            fill
            priority
            sizes="(max-width: 640px) 128px, 160px"
            className="object-contain"
          />
        </Link>
        <Link
          href="/login"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Sign In
        </Link>
      </header>
    </main>
  );
}
