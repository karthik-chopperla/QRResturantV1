"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import logoImage from "@/assets/images/QRFast_Logo-removebg-preview.png";
import {
  Calendar,
  Check,
  Plus,
  Minus,
  MessageSquare,
  Globe,
  Users,
  Smartphone,
  LineChart,
  HardDrive,
  Shield,
  Activity,
  RefreshCw,
  Sliders,
  Languages,
  BookOpen,
  HelpCircle,
  Sparkles,
} from "lucide-react";

// --- FAQ Item Accordion Helper ---
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-slate-200/80 py-4 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 sm:py-2 text-left font-semibold text-slate-800 hover:text-slate-950 transition-colors text-sm sm:text-base cursor-pointer select-none min-h-[44px]"
      >
        <span>{question}</span>
        <span className="ml-4 text-slate-400">
          {isOpen ? <Minus className="size-4 stroke-[2.5]" /> : <Plus className="size-4 stroke-[2.5]" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-3 text-slate-500 text-xs sm:text-sm leading-relaxed font-normal pt-2">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Main Pricing Page Component ---
export default function PricingPage() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

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
      transition: { staggerChildren: 0.08 },
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

  const heroBadges = [
    "No Hidden Charges",
    "Free Setup Assistance",
    "Hosting Included",
    "Ongoing Support",
  ];

  const trustStripBadges = [
    "Free Setup Assistance",
    "Secure Cloud Hosting",
    "No Hidden Charges",
    "Cancel Anytime",
  ];

  const pricingTiers = [
    {
      name: "QRFast for Restaurants",
      setupPrice: "₹11,999",
      monthlyPrice: "₹499",
      description: "Everything your restaurant needs to go digital — one simple plan, no surprises.",
      highlights: [
        "1 QR Digital Menu",
        "Unlimited Menu Items & Updates",
        "QR Ordering Enabled",
        "Kitchen Display System",
        "Direct UPI Integration",
        "Restaurant Dashboard & Analytics",
        "Free Custom Domain Setup",
        "Premium Cloud Hosting & SSL",
        "Automatic Nightly Backups",
        "Ongoing Support & Maintenance",
      ],
      ctaText: "Get Started",
    },
  ];

  const coreInclusions = [
    { title: "Secure Cloud Hosting", desc: "Premium high-speed cloud hosting ensures menu access never goes down." },
    { title: "SSL Certificate", desc: "Full encryption to protect transactions and secure restaurant assets." },
    { title: "Automatic Backups", desc: "Menu structures and sales histories backed up securely every night." },
    { title: "Unlimited Menu Updates", desc: "Add seasonal items, disable sold-out dishes, and edit prices instantly." },
    { title: "Technical Support", desc: "Dedicated support engineers ready to help with menu configuration changes." },
    { title: "Security Updates", desc: "Regular compliance upgrades to protect payments and user data." },
    { title: "Performance Monitoring", desc: "Active latency checks to keep page load times fast for dine-in guests." },
    { title: "Mobile & Desktop Dashboard", desc: "Monitor live operations, sales metrics, and queues on any device." },
  ];

  const addOns = [
    {
      title: "Online Reservations",
      desc: "Allow customers to book tables and secure seats in advance.",
      price: "₹999/mo",
      icon: <Calendar className="size-5 text-[#0f9f90]" />,
    },
    {
      title: "Loyalty Program",
      desc: "Retain dining customers with cashback, points, and digital stamps.",
      price: "₹1,499/mo",
      icon: <Sparkles className="size-5 text-[#0f9f90]" />,
    },
    {
      title: "WhatsApp Ordering",
      desc: "Send digital order receipts and confirmations straight to WhatsApp.",
      price: "₹799/mo",
      icon: <MessageSquare className="size-5 text-[#0f9f90]" />,
    },
    {
      title: "Custom Domain",
      desc: "Host your digital menu under your own web domain (e.g., menu.yourbrand.com).",
      price: "₹2,499 (one-time)",
      icon: <Globe className="size-5 text-[#0f9f90]" />,
    },
    {
      title: "POS Integration",
      desc: "Sync QR orders automatically to your physical billing machines (POS).",
      price: "₹1,999/mo",
      icon: <Sliders className="size-5 text-[#0f9f90]" />,
    },
    {
      title: "Inventory Management",
      desc: "Track ingredient stock levels, alert on low stock, and log costs.",
      price: "₹1,799/mo",
      icon: <HardDrive className="size-5 text-[#0f9f90]" />,
    },
    {
      title: "Multi-language Support",
      desc: "Translate your menu into multiple local and foreign languages.",
      price: "₹999 (one-time)",
      icon: <Languages className="size-5 text-[#0f9f90]" />,
    },
  ];

  const faqs = [
    {
      q: "Do customers need an app?",
      a: "No. Customers simply scan the table QR code using their default smartphone camera and the menu opens in their web browser instantly. No installations required.",
    },
    {
      q: "Can I update my menu?",
      a: "Yes. You can add, edit, or disable menu items, modify prices, and upload new food pictures in real time from your admin dashboard.",
    },
    {
      q: "Can I use my own domain?",
      a: "Yes. Your plan includes free custom domain setup. We will map your digital menu to your restaurant's domain name (e.g., menu.yourname.com).",
    },
    {
      q: "Is hosting included?",
      a: "Yes. Premium cloud server hosting, SSL encryption certificates, domain, and automatic data backups are fully covered in your monthly plan.",
    },
    {
      q: "Can I cancel the monthly plan?",
      a: "Yes. Our platform subscription is month-to-month. You are free to pause or cancel your subscription plan at any time without hidden fees.",
    },
    {
      q: "How long does setup take?",
      a: "Setup typically takes 3 to 5 business days. This includes digital menu design, custom QR code layout configuration, and terminal testing.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between selection:bg-[#0f9f90]/20 selection:text-[#0d8a7c]">
      
      {/* Premium Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-[#F8FAFC] w-full select-none">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image
              src={logoImage}
              alt="QRFast Logo"
              height={36}
              className="h-9 w-auto object-contain"
            />
          </Link>
          <nav className="hidden sm:flex items-center gap-8">
            <Link href="/#features" className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-sm font-semibold text-slate-900 transition-colors">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-sm font-semibold transition-all hover:scale-[1.02]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* SECTION 1: HERO */}
      <section className="py-24 md:py-32 text-center px-4 overflow-hidden">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-4xl mx-auto space-y-6"
        >
          <motion.span
            variants={itemVariants}
            className="text-xs font-bold text-[#0f9f90] bg-[#0f9f90]/10 border border-[#0f9f90]/25 px-3 py-1 rounded-full uppercase tracking-wider inline-block"
          >
            TRANSPARENT PRICING
          </motion.span>
          
          <motion.h1
            variants={itemVariants}
            className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl"
          >
            Simple & Transparent Pricing
          </motion.h1>
          
          <motion.p
            variants={itemVariants}
            className="mx-auto max-w-2xl text-sm leading-relaxed font-normal text-slate-500 sm:text-base"
          >
            Choose the perfect QRFast solution for your restaurant. Every plan includes secure hosting, ongoing updates and dedicated support.
          </motion.p>

          {/* Staggered Trust Badges */}
          <motion.div
            variants={badgeContainerVariants}
            className="flex flex-wrap items-center justify-center gap-3 pt-6 max-w-3xl mx-auto"
          >
            {heroBadges.map((badge, idx) => (
              <motion.div
                key={idx}
                variants={badgeVariants}
                className="flex items-center gap-2 bg-white border border-[#D8DEE8]/60 rounded-full px-4 py-1.5 shadow-sm"
              >
                <div className="size-4 rounded-full bg-[#0f9f90]/10 flex items-center justify-center">
                  <Check className="size-2.5 text-[#0f9f90] stroke-[3]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 tracking-tight">
                  {badge}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* SECTION 2: PRICING OVERVIEW */}
      <section className="pb-16 px-4">
        <div className="w-[92%] max-w-lg mx-auto flex justify-center">
          {pricingTiers.map((tier, idx) => {
            const cardBorder = "border border-[#0f9f90]/20 shadow-[0_1px_3px_rgba(15,23,42,0.03),0_16px_48px_rgba(15,23,42,0.08),0_48px_96px_rgba(15,23,42,0.04)]";
            
            const hoverAnim = prefersReducedMotion 
              ? {} 
              : { 
                  y: -6, 
                  shadow: "0_20px_50px_rgba(15,23,42,0.12)" 
                };

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={hoverAnim}
                className={`bg-white rounded-[28px] p-8 flex flex-col justify-between relative transition-all duration-300 w-full ${cardBorder}`}
              >
                <div className="space-y-6">
                  <div className="pt-2">
                    <h3 className="text-lg font-bold text-slate-900">{tier.name}</h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed min-h-[48px]">
                      {tier.description}
                    </p>
                  </div>

                  {/* Pricing Hierarchy Stacking */}
                  <div className="border-t border-b border-slate-100 py-6 space-y-4 text-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">One-time Setup</span>
                      <span className="text-3xl font-extrabold text-slate-950 block mt-1">{tier.setupPrice}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-slate-300 font-medium text-xs my-0.5">+</span>
                      <span className="text-xl font-bold text-[#0f9f90] block">{tier.monthlyPrice}/mo</span>
                      <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">Domain, Hosting & Maintenance</span>
                    </div>
                  </div>

                  {/* Highlights */}
                  <div className="space-y-4">
                    <ul className="space-y-3 text-xs text-slate-600">
                      {tier.highlights.map((highlight, hIdx) => (
                        <li key={hIdx} className="flex items-start gap-2.5">
                          <Check className="size-4 text-[#0f9f90] shrink-0 mt-0.5" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-8">
                  <motion.button
                    whileHover={prefersReducedMotion ? {} : { y: -2 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="w-full bg-[#0f9f90] hover:bg-[#0d8a7c] hover:shadow-md hover:shadow-[#0f9f90]/15 text-white py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-250 cursor-pointer"
                  >
                    {tier.ctaText}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: TRUST STRIP */}
      <section className="py-12 px-4 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-3.5 border-b border-slate-100 pb-16">
          {trustStripBadges.map((badge, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-white border border-[#D8DEE8]/60 rounded-full px-4.5 py-1.5 shadow-sm"
            >
              <div className="size-4 rounded-full bg-[#0f9f90]/10 flex items-center justify-center shrink-0">
                <Check className="size-2.5 text-[#0f9f90] stroke-[3]" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700 tracking-tight">
                {badge}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: EVERY PLAN INCLUDES */}
      <section className="py-24 md:py-32 px-4 bg-white border-t border-b border-[#D8DEE8]/60">
        <div className="w-[85%] max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <span className="text-xs font-bold text-[#0f9f90] bg-[#0f9f90]/10 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
              INCLUDED BENEFITS
            </span>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              Every QRFast Plan Includes
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {coreInclusions.map((feat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="flex flex-col gap-2.5 text-left"
              >
                <div className="size-5 rounded-full bg-[#0f9f90]/10 border border-[#0f9f90]/25 flex items-center justify-center shrink-0">
                  <Check className="size-3 text-[#0f9f90] stroke-[3]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{feat.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: WHY MONTHLY? */}
      <section className="py-24 md:py-32 px-4 bg-[#F8FAFC]">
        <div className="w-[85%] max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-left">
            <span className="text-xs font-bold text-[#0f9f90] bg-[#0f9f90]/10 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
              VALUABLE COVERAGE
            </span>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              Why is there a monthly platform fee?
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed font-normal">
              Running a real-time ordering system requires dedicated, fast server hosting and consistent security operations. Our monthly platform fee ensures your restaurant never runs offline and stays completely updated with premium standards.
            </p>
          </div>

          <div className="bg-white border border-[#D8DEE8]/60 rounded-3xl p-8 grid grid-cols-1 gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            {[
              { title: "Hosting & Uptime", desc: "Provides high-speed tableside menu rendering without server crashes." },
              { title: "Security Monitoring", desc: "Keeps customer data secure and transaction systems compliant." },
              { title: "Daily Backups", desc: "Ensures menu configs and historical sales data are safely backed up." },
              { title: "Performance Improvements", desc: "Active checks to keep page load times fast for dine-in guests." },
              { title: "Feature Updates", desc: "Access regular stability updates and feature patches automatically." },
              { title: "Technical Support", desc: "Access to support engineers to resolve table or menu changes instantly." },
              { title: "Unlimited Menu Updates", desc: "Update recipes, prices, and imagery on your dashboard without additional cost." },
            ].map((item, idx) => (
              <div key={idx} className="flex gap-3 text-left">
                <Check className="size-4 text-[#0f9f90] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">{item.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6: OPTIONAL ADD-ONS */}
      <section className="py-24 md:py-32 px-4 bg-[#F8FAFC]">
        <div className="w-[85%] max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <span className="text-xs font-bold text-[#0f9f90] bg-[#0f9f90]/10 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
              PREMIUM ADD-ONS
            </span>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              Enhance Your Operations With Optional Add-ons
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {addOns.map((add, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.15 }}
                whileHover={prefersReducedMotion ? {} : { y: -4 }}
                transition={{ duration: 0.3 }}
                className="bg-white border border-[#D8DEE8]/60 p-6 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_16px_rgba(15,23,42,0.04)] flex flex-col justify-between space-y-4 text-left transition-all duration-300"
              >
                <div className="space-y-3">
                  <div className="size-9 rounded-xl bg-[#0f9f90]/10 flex items-center justify-center">
                    {add.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{add.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      {add.desc}
                    </p>
                  </div>
                </div>
                <div className="text-xs font-bold text-[#0f9f90] border-t border-slate-50 pt-3">
                  Starting from {add.price}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: FAQ ACCORDION */}
      <section className="py-24 md:py-32 px-4 bg-white">
        <div className="w-[85%] max-w-3xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <HelpCircle className="size-8 text-[#0f9f90] mx-auto" />
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="bg-white border border-[#D8DEE8]/60 rounded-[28px] p-6 md:p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
            {faqs.map((faq, idx) => (
              <FAQItem key={idx} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 9: FINAL CTA (Identical to homepage CTA) */}
      <section className="pb-24 px-4 bg-[#F8FAFC]">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="w-[85%] max-w-5xl mx-auto bg-white border border-[#D8DEE8] rounded-[32px] py-16 md:py-24 px-6 md:px-12 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.04)] flex flex-col items-center text-center relative"
        >
          <motion.h2
            variants={itemVariants}
            className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl max-w-2xl"
          >
            Ready to Bring QRFast to Your Restaurant?
          </motion.h2>

          <motion.p
            variants={itemVariants}
            className="mt-6 text-sm leading-relaxed font-normal text-slate-500 sm:text-base max-w-2xl"
          >
            Let&apos;s build a modern restaurant experience your customers will love.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 w-full sm:w-auto"
          >
            <motion.button
              whileHover={prefersReducedMotion ? {} : { y: -3 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full sm:w-auto bg-[#0f9f90] hover:bg-[#0d8a7c] text-white py-3.5 px-7 rounded-2xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(15,159,144,0.15)] transition-all duration-250 cursor-pointer"
            >
              <Calendar className="size-4" />
              Get QRFast for Your Restaurant
            </motion.button>

            <Link href="https://wa.me/yourwhatsappnumber" target="_blank" className="w-full sm:w-auto">
              <motion.button
                whileHover={prefersReducedMotion ? {} : { y: -3 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full sm:w-auto bg-white border border-[#1f1d1dff] hover:bg-slate-50 text-slate-700 py-3.5 px-7 rounded-2xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all duration-250 cursor-pointer"
              >
                <svg className="size-4 fill-[#25D366]" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.48 1.977 14.021.952 11.398.95c-5.437 0-9.86 4.371-9.864 9.802-.001 1.764.471 3.486 1.365 5.02L1.879 21.5l5.83-1.517.003-.004-.065-.125z" />
                </svg>
                Chat on WhatsApp
              </motion.button>
            </Link>
          </motion.div>

          {/* Subtext */}
          <motion.div variants={itemVariants} className="mt-8 border-t border-slate-100 pt-6 w-full max-w-md">
            <p className="text-[10px] font-bold text-[#0f9f90] uppercase tracking-wider block">
              Usually respond within 30 minutes
            </p>
            <p className="text-[11px] font-medium text-slate-400 mt-1">
              No spam. No obligation.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* Subtle Mini Footer */}
      <footer className="border-t border-slate-200/50 py-8 text-center text-xs text-slate-400 bg-white w-full select-none">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} QRFast. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
