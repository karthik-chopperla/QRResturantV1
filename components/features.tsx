"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  ChefHat,
  CreditCard,
  QrCode,
  ShoppingCart,
  Star,
} from "lucide-react";

export default function Features() {
  const [step, setStep] = useState(0);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    if (hasTriggered && step < 6) {
      const delays = [200, 800, 600, 600, 1000, 600]; // timing for steps (completes under 4s)
      const delay = delays[step] || 600;
      const timer = setTimeout(() => {
        setStep((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [step, hasTriggered]);

  const getDotCoords = (currentStep: number) => {
    const s = Math.min(Math.max(currentStep, 1), 6) - 1;
    return {
      desktop: [
        { cx: 16.67, cy: 25 },
        { cx: 50, cy: 25 },
        { cx: 83.33, cy: 25 },
        { cx: 83.33, cy: 75 },
        { cx: 50, cy: 75 },
        { cx: 16.67, cy: 75 },
      ][s],
      tablet: [
        { cx: 25, cy: 16.67 },
        { cx: 75, cy: 16.67 },
        { cx: 25, cy: 50 },
        { cx: 75, cy: 50 },
        { cx: 25, cy: 83.33 },
        { cx: 75, cy: 83.33 },
      ][s],
      mobile: [
        { cx: 50, cy: 8.33 },
        { cx: 50, cy: 25 },
        { cx: 50, cy: 41.67 },
        { cx: 50, cy: 58.33 },
        { cx: 50, cy: 75 },
        { cx: 50, cy: 91.67 },
      ][s],
    };
  };

  return (
    <motion.section
      id="features"
      onViewportEnter={() => {
        if (!hasTriggered) {
          setHasTriggered(true);
          setStep(1);
        }
      }}
      viewport={{ once: true, amount: 0.15 }}
      className="relative flex flex-col items-center overflow-hidden bg-[#F8FAFC] py-20 select-none"
    >
      {/* Heading */}
      <div className="relative z-10 mb-10 max-w-3xl px-4 text-center">
        <h2 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Experience Your Restaurant in
          <br />
          Real Time
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed font-normal text-slate-400 sm:text-base">
          From the moment a customer scans the QR code until the food reaches
          the table, DineDesk keeps everything connected.
        </p>
      </div>

      <div className="relative z-10 w-full max-w-6xl px-4">
        {/* Desktop Connector Line */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-y-0 left-4 right-4 -z-10 w-[calc(100%-2rem)] h-full pointer-events-none hidden lg:block"
        >
          <path
            d="M 16.67,25 L 50,25 L 83.33,25 L 83.33,75 L 50,75 L 16.67,75"
            fill="none"
            stroke="#eaeaea"
            strokeWidth="0.3"
            strokeDasharray="1 1.5"
          />
          {step > 0 && (
            <motion.circle
              r="0.8"
              fill="#0f9f90"
              animate={{ 
                cx: getDotCoords(step).desktop.cx, 
                cy: getDotCoords(step).desktop.cy 
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          )}
        </svg>

        {/* Tablet Connector Line */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-y-0 left-4 right-4 -z-10 w-[calc(100%-2rem)] h-full pointer-events-none hidden md:block lg:hidden"
        >
          <path
            d="M 25,16.67 L 75,16.67 L 25,50 L 75,50 L 25,83.33 L 75,83.33"
            fill="none"
            stroke="#eaeaea"
            strokeWidth="0.4"
            strokeDasharray="1 1.5"
          />
          {step > 0 && (
            <motion.circle
              r="1"
              fill="#0f9f90"
              animate={{ 
                cx: getDotCoords(step).tablet.cx, 
                cy: getDotCoords(step).tablet.cy 
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          )}
        </svg>

        {/* Mobile Connector Line */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-y-0 left-4 right-4 -z-10 w-[calc(100%-2rem)] h-full pointer-events-none block md:hidden"
        >
          <path
            d="M 50,8.33 L 50,91.67"
            fill="none"
            stroke="#eaeaea"
            strokeWidth="0.5"
            strokeDasharray="1 1.5"
          />
          {step > 0 && (
            <motion.circle
              r="1.2"
              fill="#0f9f90"
              animate={{ 
                cx: getDotCoords(step).mobile.cx, 
                cy: getDotCoords(step).mobile.cy 
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          )}
        </svg>

        {/* Grid with 32px gap for breathing room */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Customer Scanned */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: step >= 1 ? 1 : 0.4, y: step >= 1 ? 0 : 15 }}
            transition={{ duration: 0.5 }}
            className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_6px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.08),0_32px_64px_rgba(15,23,42,0.06)] md:order-1 lg:order-1"
          >
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 border border-emerald-100">
                  <QrCode className="size-5" />
                </div>

                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    Customer Scanned
                  </h4>

                  <span className="text-xs font-medium text-slate-400">
                    Table 7
                  </span>
                </div>
              </div>

              <div className="relative overflow-hidden space-y-2 rounded-2xl border border-slate-800 bg-[#121214] p-4 font-mono text-xs text-slate-300">
                {/* Scanning Laser Line */}
                {step >= 1 && (
                  <motion.div
                    className="absolute left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-[#10b981] to-transparent shadow-[0_0_8px_#10b981] pointer-events-none"
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}

                <div className="flex items-center justify-between text-[#10b981]">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-[#10b981] animate-pulse" />
                    <span className="font-semibold">Terminal Active</span>
                  </div>
                  <span className="text-[10px] text-slate-600">tty1</span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-400">
                  <div>$ dinedesk-scanner --init</div>
                  <div className="text-slate-500">Scanning Table 7...</div>
                  <div className="font-semibold text-[#10b981] flex items-center min-h-[16px]">
                    {step >= 1 && (
                      <motion.span
                        initial={{ width: 0 }}
                        animate={{ width: "auto" }}
                        transition={{ duration: 1.2, ease: "linear", delay: 0.5 }}
                        className="inline-block overflow-hidden whitespace-nowrap border-r-2 border-[#10b981]"
                      >
                        Menu opened successfully.
                      </motion.span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 2: New Order (Primary Focus) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: step >= 2 ? 1 : 0.4, y: step >= 2 ? 0 : 15 }}
            transition={{ duration: 0.5 }}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-[24px] border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_6px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.08),0_32px_64px_rgba(15,23,42,0.06)] md:order-2 lg:order-2 ${
              step >= 2 ? "p-8 lg:scale-[1.04] lg:z-20" : "p-6"
            } ${step === 2 ? "border-orange-300" : "border-[rgba(15,23,42,0.08)]"}`}
          >
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600 border border-orange-100">
                    <ShoppingCart className="size-5" />
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-slate-900">
                      New Order
                    </h4>

                    <span className="text-xs font-medium text-slate-400">
                      Table 7 • Dine-in
                    </span>
                  </div>
                </div>

                {step >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="flex items-center gap-1.5 rounded-full border border-[#d0f0e0] bg-[#e8f8f0] px-2.5 py-1"
                  >
                    <span className="size-1.5 rounded-full bg-[#10b981] animate-pulse" />
                    <span className="text-[10px] font-bold tracking-wider text-[#10b981]">
                      RECEIVED
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Clean whitespace layout instead of multiple separator lines */}
              <div className="space-y-4 text-sm text-slate-700 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-600">
                    2x Paneer Butter Masala
                  </span>
                  <span className="font-semibold text-slate-900">₹640</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-600">
                    1x Garlic Naan
                  </span>
                  <span className="font-semibold text-slate-900">₹90</span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                  <span>GST & Serv. Charge</span>
                  <span>₹135</span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                  <span className="font-semibold text-slate-900">Total Amount</span>
                  <span className="font-bold text-slate-900 text-base">₹865</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Payment Approved */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: step >= 3 ? 1 : 0.4, y: step >= 3 ? 0 : 15 }}
            transition={{ duration: 0.5 }}
            className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_6px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.08),0_32px_64px_rgba(15,23,42,0.06)] md:order-3 lg:order-3"
          >
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 border transition-colors ${
                    step >= 3 
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                      : "bg-slate-50 text-slate-400 border-slate-100"
                  }`}>
                    <CreditCard className="size-5" />
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-slate-900">
                      Payment {step >= 3 ? "Approved" : "Pending"}
                    </h4>

                    <span className="text-xs font-medium text-slate-400">
                      UPI Transaction
                    </span>
                  </div>
                </div>

                {step >= 3 ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex size-6 items-center justify-center rounded-full bg-[#10b981]"
                  >
                    <svg
                      width="12"
                      height="10"
                      viewBox="0 0 12 10"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <motion.path
                        d="M1 5L4.5 8.5L11 1"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                      />
                    </svg>
                  </motion.div>
                ) : (
                  <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>

              {/* Clean whitespace separated items */}
              <div className="space-y-3 text-xs text-slate-500 pt-4">
                <div className="flex items-center justify-between">
                  <span>Transaction ID</span>
                  <span className="font-mono text-slate-700">TXN-8392-UPI</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Amount Collected</span>
                  <span className="font-semibold text-slate-900 text-sm">₹865</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Timestamp</span>
                  <span>{step >= 3 ? "12:42:08 PM" : "Awaiting..."}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Gateway Status</span>
                  <span className={step >= 3 ? "text-emerald-600 font-semibold" : "text-amber-500 font-semibold"}>
                    {step >= 3 ? "SUCCESS" : "PENDING_VERIFICATION"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 4: Kitchen Status */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: step >= 4 ? 1 : 0.4, y: step >= 4 ? 0 : 15 }}
            transition={{ duration: 0.5 }}
            className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_6px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.08),0_32px_64px_rgba(15,23,42,0.06)] md:order-4 lg:order-6"
          >
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 border border-amber-100">
                  <ChefHat className="size-5" />
                </div>

                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    Kitchen Status
                  </h4>

                  <span className="text-xs font-medium text-slate-400">
                    Preparing Order #104
                  </span>
                </div>
              </div>

              {/* Clean spacing whitespace layout */}
              <div className="space-y-4 pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Estimated Prep Time
                  </span>

                  <span className="text-base font-bold text-slate-800">
                    12 mins
                  </span>
                </div>

                <div className="relative h-2 w-full rounded-full bg-slate-100">
                  {/* progress fill */}
                  <motion.div
                    className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-amber-400 to-[#10b981]"
                    initial={{ width: "0%" }}
                    animate={{ width: step >= 4 ? "75%" : "0%" }}
                    transition={{ duration: 3, ease: "easeOut" }}
                  />

                  {/* moving indicator dot */}
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 size-3.5 -ml-1.5 rounded-full bg-[#10b981] border-2 border-white shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    initial={{ left: "0%" }}
                    animate={{ left: step >= 4 ? "75%" : "0%" }}
                    transition={{ duration: 3, ease: "easeOut" }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Received</span>
                  <span>Preparing</span>
                  <span>Ready</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 5: Ready to Serve */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: step >= 5 ? 1 : 0, y: step >= 5 ? 0 : 15 }}
            transition={{ duration: 0.5 }}
            className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_6px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.08),0_32px_64px_rgba(15,23,42,0.06)] md:order-5 lg:order-5"
          >
            <div>
              <div className="mb-6 flex items-center gap-3">
                <motion.div
                  animate={step >= 5 ? { rotate: [0, -15, 15, -10, 10, -5, 5, 0] } : {}}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 border border-indigo-100"
                >
                  <Bell className="size-5" />
                </motion.div>

                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    Ready to Serve
                  </h4>

                  <span className="text-xs font-medium text-slate-400">
                    Table 7 • Hot & Fresh
                  </span>
                </div>
              </div>

              {/* Clean spacing wrapper without border line */}
              <div className="pt-4">
                <button className="relative w-full overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50/50 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-600 transition-colors hover:bg-indigo-50">
                  <span className="relative z-10">Notify Waiter</span>
                  <motion.span
                    className="absolute inset-0 bg-indigo-100 opacity-20"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Card 6: Customer Review */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: step >= 6 ? 1 : 0, y: step >= 6 ? 0 : 15 }}
            transition={{ duration: 0.5 }}
            className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_6px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.08),0_32px_64px_rgba(15,23,42,0.06)] md:order-6 lg:order-4"
          >
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-yellow-50 p-2.5 text-yellow-600 border border-yellow-100">
                  <Star className="size-5" />
                </div>

                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    Customer Review
                  </h4>

                  <span className="text-xs font-medium text-slate-400">
                    Table 7 • 12 mins ago
                  </span>
                </div>
              </div>

              {/* Clean spacing review block */}
              <div className="space-y-3 pt-4">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className="size-3.5 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>

                <p className="text-sm font-medium leading-relaxed text-slate-700">
                  &quot;Food arrived in just 12 minutes. Ordering was effortless.&quot;
                </p>

                <div className="text-xs font-medium text-slate-400">
                  — Rahul Sharma
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}