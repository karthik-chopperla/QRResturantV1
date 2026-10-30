"use client";

import { useState, useEffect } from "react";
import { motion, Variants } from "framer-motion";
import Link from "next/link";
import { Calendar, Check } from "lucide-react";

export default function DecisionSection() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  // Stagger animation container
  const containerVariants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
        staggerChildren: 0.15,
        when: "beforeChildren",
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  const badgeContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const badgeVariants: Variants = {
    hidden: { opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  const badges = [
    "Custom Built For Your Restaurant",
    "Deployment Included",
    "Ongoing Support",
    "Secure Payment Integration",
  ];

  return (
    <section className="bg-[#F8FAFC] py-24 border-t border-[#D8DEE8]/60 select-none overflow-hidden">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="w-[92%] max-w-5xl mx-auto bg-white border border-[#D8DEE8] rounded-[32px] py-12 md:py-24 px-5 md:px-12 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.04)] flex flex-col items-center text-center relative"
      >
        {/* Headline */}
        <motion.h2
          variants={itemVariants}
          className="text-2xl sm:text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl max-w-2xl"
        >
          Ready to Transform Your Restaurant?
        </motion.h2>

        {/* Subheading */}
        <motion.p
          variants={itemVariants}
          className="mt-6 text-sm leading-relaxed font-normal text-slate-500 sm:text-base max-w-2xl"
        >
          From QR ordering and kitchen management to payments and analytics, we&apos;ll build a modern restaurant experience your customers love and your staff enjoys using.
        </motion.p>

        {/* Trust Badges */}
        <motion.div
          variants={badgeContainerVariants}
          className="flex flex-wrap items-center justify-center gap-3 mt-10 max-w-3xl"
        >
          {badges.map((badge, idx) => (
            <motion.div
              key={idx}
              variants={badgeVariants}
              className="flex items-center gap-2 bg-[#F8FAFC] border border-slate-200/80 rounded-full px-4 py-1.5"
            >
              <div className="size-4 rounded-full bg-[#0f9f90]/10 border border-[#0f9f90]/25 flex items-center justify-center">
                <Check className="size-2.5 text-[#0f9f90] stroke-[3]" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700 tracking-tight">
                {badge}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 w-full sm:w-auto"
        >
          {/* Primary CTA */}
          <motion.button
            whileHover={prefersReducedMotion ? {} : { y: -3 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full sm:w-auto bg-[#0f9f90] hover:bg-[#0d8a7c] text-white py-3.5 px-7 rounded-2xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(15,159,144,0.15)] hover:shadow-[0_8px_20px_rgba(15,159,144,0.25)] transition-all duration-250 cursor-pointer"
          >
            <Calendar className="size-4" />
            Get QRFast for Your Restaurant
          </motion.button>

          {/* Secondary CTA */}
          <Link href="/pricing" className="w-full sm:w-auto">
            <motion.button
              whileHover={prefersReducedMotion ? {} : { y: -3 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full sm:w-auto bg-white border border-[#1f1d1dff] hover:bg-slate-50 text-slate-700 py-3.5 px-7 rounded-2xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center shadow-sm transition-all duration-250 cursor-pointer"
            >
              Explore Plans
            </motion.button>
          </Link>
        </motion.div>

        {/* Tertiary WhatsApp CTA */}
        <motion.div variants={itemVariants} className="mt-8">
          <Link
            href="https://wa.me/yourwhatsappnumber"
            target="_blank"
            className="group inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <span>💬 Prefer chatting?</span>
            <span className="flex items-center gap-1">
              Chat with us on WhatsApp
              <svg
                className="size-3.5 fill-[#25D366] transition-transform duration-250 group-hover:translate-x-0.5"
                viewBox="0 0 24 24"
              >
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.48 1.977 14.021.952 11.398.95c-5.437 0-9.86 4.371-9.864 9.802-.001 1.764.471 3.486 1.365 5.02L1.879 21.5l5.83-1.517.003-.004-.065-.125z" />
              </svg>
            </span>
          </Link>
        </motion.div>

        {/* Small Trust Text */}
        <motion.div variants={itemVariants} className="mt-8 border-t border-slate-100 pt-6 w-full max-w-md">
          <p className="text-[10px] font-bold text-[#0f9f90] uppercase tracking-wider block">
            Usually respond within 30 minutes
          </p>
          <p className="text-[11px] font-medium text-slate-400 mt-1">
            No spam. No obligation. Just a quick conversation about your restaurant.
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
