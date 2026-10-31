import Link from "next/link";
import Image from "next/image";
import localFont from "next/font/local";
import bgImage from "@/assets/images/herobg.png";
import logoImage from "@/assets/images/QRFast_Logo-removebg-preview.png";

const headingFont = localFont({
  src: "../app/fonts/GeistVF.woff",
  weight: "100 900",
});

export default function Hero() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between font-system">
      {/* Background Image Container */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Image
          src={bgImage}
          alt="Elegant Restaurant Background"
          fill
          priority
          placeholder="blur"
          className="object-cover object-center opacity-100 select-none pointer-events-none"
        />
        {/* Subtle radial and linear gradients to blend the image beautifully (with decreased opacity) */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#021f24]/60 via-[#021f24]/30 to-[#021f24]/80 opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_70%)]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#021f24]/70 backdrop-blur-md w-full">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image
              src={logoImage}
              alt="QRFast Logo"
              height={36}
              className="h-9 w-auto object-contain"
            />
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            <Link href="#features" className="relative text-sm font-medium text-white transition-colors after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-full after:scale-x-0 after:bg-white after:transition-transform after:duration-300 after:origin-left hover:after:scale-x-100">
              Features
            </Link>
            <Link href="#how-it-works" className="relative text-sm font-medium text-white transition-colors after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-full after:scale-x-0 after:bg-white after:transition-transform after:duration-300 after:origin-left hover:after:scale-x-100">
              How it Works
            </Link>
            <Link href="#contact" className="relative text-sm font-medium text-white transition-colors after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-full after:scale-x-0 after:bg-white after:transition-transform after:duration-300 after:origin-left hover:after:scale-x-100">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-950 transition-all hover:opacity-90 hover:scale-105 sm:px-4 sm:text-sm"
            >
              Sign In
            </Link>
            <Link
              href="#get-started"
              className="bg-transparent border-2 border-white px-3 py-2 text-xs font-medium text-white transition-all hover:bg-white/10 active:bg-white/20 whitespace-nowrap rounded-full hover:scale-105 sm:px-4 sm:text-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 flex-1 flex flex-col justify-center text-left py-16">
        <h1 className={`${headingFont.className} text-3xl font-black tracking-tight sm:text-5xl lg:text-7xl max-w-3xl text-white leading-none`}>
          Let Customers Scan,
          <br />
          Order & Pay
          <span className="block font-serif text-xl sm:text-3xl lg:text-5xl font-semibold text-amber-300 mt-2 sm:mt-4 italic normal-case">
            Without Waiting for a Waiter.
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-white/80 sm:text-base lg:text-lg">
          Let your customers scan, order, and pay from their phone. No app download needed.
          Streamline your kitchen, reduce staff workload, and increase table turnover.
        </p>
      </section>
    </div>
  );
}
