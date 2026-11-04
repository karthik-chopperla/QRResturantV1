import Image from "next/image";
import Link from "next/link";
import logoImage from "@/assets/images/dinedesk-logo.png";

export default function Hero() {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex h-24 w-full max-w-7xl items-center justify-end px-4 sm:px-6">
        <Link
          href="/login"
          className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          Sign In
        </Link>
      </header>
      <section className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="relative aspect-[3/2] w-full max-w-5xl">
          <Image
            src={logoImage}
            alt="DineDesk Restaurant Management System"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 1024px"
            className="object-contain"
          />
        </div>
      </section>
    </main>
  );
}
