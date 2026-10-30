"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, animate, useInView } from "framer-motion";
import {
  Bell,
  ChefHat,
  CreditCard,
  QrCode,
  ShoppingCart,
  Star,
  Check,
  Search,
  Plus,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

// Count Up helper component for metrics
function CountUp({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 60, damping: 15 });
  const displayValue = useTransform(springValue, (latest) =>
    `${prefix}${Math.floor(latest).toLocaleString()}${suffix}`
  );
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const unsubscribe = displayValue.onChange((v) => {
      if (ref.current) ref.current.textContent = v;
    });
    return () => unsubscribe();
  }, [displayValue]);

  useEffect(() => {
    animate(motionValue, value, { duration: 2, ease: "easeOut" });
  }, [motionValue, value]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
}

// --- Reusable Premium Phone Mockup ---
function Phone({ children }: { children: React.ReactNode }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  return (
    <motion.div
      animate={prefersReducedMotion ? {} : { y: [0, -5, 0] }}
      transition={{
        duration: 7,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="relative w-[260px] sm:w-[295px] h-[536px] sm:h-[608px] bg-[#1e293b] rounded-[38px] sm:rounded-[42px] p-[4px] sm:p-[5px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.04)] border border-[#334155]/80 select-none flex flex-col"
    >
      {/* Volume buttons (Left) */}
      <div className="absolute top-[90px] -left-[2px] w-[2px] h-10 bg-[#334155] rounded-l" />
      <div className="absolute top-[140px] -left-[2px] w-[2px] h-10 bg-[#334155] rounded-l" />
      {/* Power button (Right) */}
      <div className="absolute top-[110px] -right-[2px] w-[2px] h-14 bg-[#334155] rounded-r" />

      {/* Screen area with rounded corners */}
      <div className="relative w-full h-full bg-white rounded-[38px] overflow-hidden border-[2px] border-slate-950 flex flex-col shadow-[inset_0_1px_2px_rgba(0,0,0,0.1),inset_0_8px_16px_rgba(0,0,0,0.06)]">
        {/* Notch / Dynamic Island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-950 rounded-full z-50 flex items-center justify-between px-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
          <span className="w-4 h-1 bg-slate-900 rounded-full" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
        </div>

        {/* Screen Glass Shine Overlay */}
        <div className="absolute inset-0 pointer-events-none z-40 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.08]" />

        {/* Inner display content */}
        {children}
      </div>
    </motion.div>
  );
}

// --- Reusable Premium Laptop Mockup ---
function Laptop({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[540px] flex flex-col items-center select-none">
      {/* Laptop Screen (Lid) */}
      <div className="relative w-full aspect-[16/10] bg-[#1e293b] rounded-t-2xl p-[6px] border border-[#334155] shadow-lg flex flex-col">
        {/* Screen Bezel (Inner Border) */}
        <div className="relative w-full h-full bg-slate-950 rounded-[10px] overflow-hidden p-[3px] flex flex-col">

          {/* Inner Display (the application UI) */}
          <div className="relative w-full h-full bg-white rounded-[7px] overflow-hidden flex flex-col shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
            {/* Webcam dot */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 size-1 bg-slate-900 rounded-full z-50" />

            {/* Screen reflection */}
            <div className="absolute inset-0 pointer-events-none z-40 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.06]" />

            {children}
          </div>
        </div>
      </div>

      {/* Hinge */}
      <div className="w-full h-1 bg-[#0f172a] shadow-inner" />

      {/* Laptop Base (Body) */}
      <div className="relative w-[105%] h-3 bg-black border-t border-[#f1f5f9] border-b border-[#cbd5e1] rounded-b-xl shadow-[0_12px_24px_rgba(15,23,42,0.08),0_24px_48px_rgba(15,23,42,0.06)] flex flex-col items-center">
        {/* Trackpad cut */}
        <div className="w-24 h-1.5 bg-[#cbd5e1] border border-t-[#b8c2cc] border-b-white rounded-b-sm" />

        {/* Keyboard recess / hint */}
        <div className="absolute top-0.5 w-[90%] h-0.5 bg-[#94a3b8] opacity-50 rounded-full" />
      </div>
    </div>
  );
}

// --- Row 1 Mockup: QR Digital Menu ---
function Row1Mockup() {
  const [cartCount, setCartCount] = useState(0);
  const [isClicked, setIsClicked] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [dotAnim, setDotAnim] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Scroll down
      setScrollOffset(-80);

      // 2. Click "Add to Cart" & trigger fly animation
      setTimeout(() => {
        setIsClicked(true);
        setDotAnim(true);
        setTimeout(() => setIsClicked(false), 200);
      }, 1800);

      // 3. Dot lands, increment cart badge
      setTimeout(() => {
        setDotAnim(false);
        setCartCount(1);
      }, 2400);

      // 4. Reset
      setTimeout(() => {
        setScrollOffset(0);
        setCartCount(0);
      }, 6500);
    }, 8500);

    return () => clearInterval(interval);
  }, []);

  return (
    <Phone>
      {/* Header */}
      <div className="pt-6 pb-2 border-b border-slate-100 bg-white sticky top-0 z-20 space-y-2 px-3">
        <div className="flex justify-between items-center px-1 text-[10px] font-bold text-slate-400">
          <span>12:30 PM</span>
          <div className="flex gap-1">
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <div>
            <h5 className="text-xs font-bold text-slate-800">Table 7</h5>
            <p className="text-[9px] text-slate-400 font-medium">Bistro Royale</p>
          </div>
          <div className="relative">
            <ShoppingCart className="size-4 text-slate-600" />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 size-3.5 bg-[#0f9f90] text-[8px] font-bold text-white rounded-full flex items-center justify-center shadow-sm"
              >
                {cartCount}
              </motion.span>
            )}
          </div>
        </div>
      </div>

      {/* Menu scroll area */}
      <div className="flex-1 overflow-hidden py-3 space-y-4 px-3">
        <motion.div
          animate={{ y: scrollOffset }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="space-y-4"
        >
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-bold bg-slate-900 text-white px-2.5 py-1 rounded-full whitespace-nowrap">Starters</span>
            <span className="text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap">Mains</span>
            <span className="text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap">Drinks</span>
          </div>

          {/* Search bar */}
          <div className="relative bg-slate-50 border border-slate-100 rounded-xl p-2 flex items-center gap-2">
            <Search className="size-3 text-slate-400" />
            <span className="text-[10px] text-slate-400">Search menu...</span>
          </div>

          {/* Dish 1 */}
          <div className="border border-slate-100 rounded-xl p-3 flex gap-3 bg-white">
            <div className="size-16 bg-slate-50 rounded-lg flex items-center justify-center text-xl border border-slate-100">
              🥟
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h6 className="text-[11px] font-bold text-slate-800">Paneer Tikka Miel</h6>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">Spicy cottage cheese skewers with bell peppers.</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-950">₹240</span>
                <motion.button
                  animate={isClicked ? { scale: 0.85 } : { scale: 1 }}
                  className={`size-6 rounded-full flex items-center justify-center border transition-all duration-300 ${cartCount > 0
                    ? "bg-[#0f9f90] border-[#0f9f90] text-white"
                    : "bg-white border-slate-200 text-slate-400"
                    }`}
                >
                  {cartCount > 0 ? (
                    <motion.svg
                      width="10"
                      height="8"
                      viewBox="0 0 10 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <motion.path
                        d="M1 4L4 7L9 1"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    </motion.svg>
                  ) : (
                    <Plus className="size-3 stroke-[3]" />
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          {/* Dish 2 */}
          <div className="border border-slate-100 rounded-xl p-3 flex gap-3 bg-white">
            <div className="size-16 bg-slate-50 rounded-lg flex items-center justify-center text-xl border border-slate-100">
              🍕
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h6 className="text-[11px] font-bold text-slate-800">Margherita Pizza</h6>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">Classic mozzarella with fresh basil leaves.</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-950">₹320</span>
                <span className="size-6 bg-white border border-slate-200 text-slate-400 rounded-full flex items-center justify-center">
                  <Plus className="size-3 stroke-[3]" />
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Floating dumpling flying dot micro-interaction */}
      {dotAnim && (
        <motion.div
          initial={{ x: 220, y: 175, opacity: 1, scale: 1 }}
          animate={{ x: 225, y: 35, opacity: [1, 1, 0.8, 0], scale: [1, 1.2, 0.6, 0.3] }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute size-5 bg-[#0f9f90] rounded-full z-50 flex items-center justify-center text-[10px] font-bold text-white shadow-md shadow-[#0f9f90]/30"
        >
          🥟
        </motion.div>
      )}

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-3 left-3 right-3 bg-[#0f9f90] text-white p-3 rounded-2xl flex items-center justify-between shadow-lg"
        >
          <span className="text-[10px] font-bold">1 Item Added</span>
          <span className="text-[11px] font-bold flex items-center gap-1">
            View Cart <ArrowRight className="size-3" />
          </span>
        </motion.div>
      )}
    </Phone>
  );
}

// --- Row 2 Mockup: Kitchen Display System (KDS) ---
interface KDSTicket {
  id: string;
  table: string;
  item: string;
  progress: number;
  time: string;
  status: "New" | "Preparing" | "Ready";
}

function Row2Mockup() {
  const [tickets, setTickets] = useState<KDSTicket[]>([
    { id: "108", table: "T4", item: "1x Garlic Bread", progress: 0, time: "01:05", status: "New" },
    { id: "107", table: "T12", item: "2x Margherita Pizza", progress: 65, time: "04:12", status: "Preparing" },
    { id: "106", table: "T8", item: "1x Veg Burger", progress: 100, time: "05:40", status: "Ready" }
  ]);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 3);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (step === 1) {
      setTickets([
        { id: "108", table: "T4", item: "1x Garlic Bread", progress: 20, time: "01:10", status: "Preparing" },
        { id: "107", table: "T12", item: "2x Margherita Pizza", progress: 100, time: "04:25", status: "Ready" },
        { id: "106", table: "T8", item: "1x Veg Burger", progress: 100, time: "05:40", status: "Ready" }
      ]);
    } else if (step === 2) {
      setTickets([
        { id: "108", table: "T4", item: "1x Garlic Bread", progress: 75, time: "02:30", status: "Preparing" },
        { id: "107", table: "T12", item: "2x Margherita Pizza", progress: 100, time: "04:25", status: "Ready" }
      ]);
    } else {
      setTickets([
        { id: "108", table: "T4", item: "1x Garlic Bread", progress: 0, time: "01:05", status: "New" },
        { id: "107", table: "T12", item: "2x Margherita Pizza", progress: 65, time: "04:12", status: "Preparing" },
        { id: "106", table: "T8", item: "1x Veg Burger", progress: 100, time: "05:40", status: "Ready" }
      ]);
    }
  }, [step]);

  return (
    <Laptop>
      <div className="flex-1 flex flex-col justify-between p-4 bg-white h-full overflow-hidden select-none">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider block">KITCHEN SCREEN</span>
            <span className="text-xs font-semibold text-slate-900">Active Queue</span>
          </div>
          <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
            Chef Terminal #1
          </span>
        </div>

        {/* KDS Columns */}
        <div className="flex-1 grid grid-cols-3 gap-3 mt-4 overflow-hidden">
          {["New", "Preparing", "Ready"].map((col) => (
            <div key={col} className="bg-slate-50/50 border border-slate-100 rounded-xl p-2 flex flex-col gap-2.5 overflow-hidden">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-1">{col}</span>
              <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                <AnimatePresence>
                  {tickets
                    .filter((t) => t.status === col)
                    .map((t) => (
                      <motion.div
                        layoutId={t.id}
                        key={t.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
                        className="bg-white border border-[#D8DEE8]/60 p-2.5 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-1.5"
                      >
                        <div className="flex justify-between items-center text-[9px]">
                          <span className="font-bold text-slate-900">#{t.id}</span>
                          <span className="font-semibold text-slate-400">{t.table}</span>
                        </div>
                        <p className="text-[10px] font-medium text-slate-700 leading-tight">{t.item}</p>

                        <div className="space-y-1 pt-0.5">
                          <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                            <span>Progress</span>
                            <span>{t.time}</span>
                          </div>
                          <div className="relative h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              className="absolute left-0 top-0 h-full bg-[#0f9f90] rounded-full"
                              animate={{ width: `${t.progress}%` }}
                              transition={{ duration: 1 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Laptop>
  );
}

// --- Row 3 Mockup: Payments ---
function Row3Mockup() {
  const [payStep, setPayStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPayStep((prev) => (prev + 1) % 3);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <Phone>
      <div className="pt-6 pb-2 text-[10px] font-bold text-slate-400 flex justify-between items-center border-b border-slate-50 bg-white z-20 px-3">
        <span>Checkout</span>
        <span>Secure Gateway</span>
      </div>

      <div className="flex-1 flex flex-col justify-center px-4">
        <AnimatePresence mode="wait">
          {payStep === 0 && (
            <motion.div
              key="bill"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Total Payable</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">₹865.00</h3>
                <p className="text-[9px] text-slate-400 mt-0.5">Table 7 • Bistro Royale</p>
              </div>

              <div className="space-y-2 border border-slate-100 rounded-2xl p-3 bg-slate-50/50">
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                  <span>Paneer Tikka</span>
                  <span>₹240</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                  <span>Margherita Pizza</span>
                  <span>₹320</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                  <span>GST & Service Charge</span>
                  <span>₹135</span>
                </div>
              </div>

              <button className="w-full bg-[#0f9f90] hover:bg-[#0d8a7c] text-white py-3 rounded-2xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors">
                <CreditCard className="size-4" /> Pay with UPI
              </button>
            </motion.div>
          )}

          {payStep === 1 && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative size-12 rounded-full border-2 border-slate-100 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-t-[#0f9f90] border-transparent animate-spin" />
              </div>
              <div className="text-center">
                <h6 className="text-xs font-bold text-slate-800">Processing Payment</h6>
                <p className="text-[9px] text-slate-400 mt-0.5">Do not close this screen</p>
              </div>
            </motion.div>
          )}

          {payStep === 2 && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <div className="flex flex-col items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="size-12 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10 mb-3"
                >
                  <svg
                    width="18"
                    height="14"
                    viewBox="0 0 18 14"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M1 7L6 12L17 1"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                    />
                  </svg>
                </motion.div>
                <span className="text-[10px] font-bold text-emerald-600 tracking-wider block uppercase">Payment Success</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">₹865.00</h3>
              </div>

              <div className="space-y-2 border border-slate-100 rounded-2xl p-3 bg-slate-50/50 text-[10px] text-slate-500">
                <div className="flex justify-between">
                  <span>Transaction ID</span>
                  <span className="font-mono text-slate-700">TXN-4928-UPI</span>
                </div>
                <div className="flex justify-between">
                  <span>Timestamp</span>
                  <span className="text-slate-700">12:31:42 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Method</span>
                  <span className="text-slate-700">GPay (UPI)</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="py-2.5 px-3 border-t border-slate-50 text-[9px] text-slate-400 text-center font-medium">
        Receipt emailed automatically
      </div>
    </Phone>
  );
}

// --- Row 4 Mockup: Analytics ---
function Row4Mockup() {
  const [revenue, setRevenue] = useState(48250);
  const [orders, setOrders] = useState(186);

  useEffect(() => {
    const timer = setInterval(() => {
      setRevenue((prev) => (prev === 48250 ? 49160 : 48250));
      setOrders((prev) => (prev === 186 ? 189 : 186));
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <Laptop>
      <div className="flex-1 flex flex-col justify-between p-4 bg-white h-full overflow-hidden select-none">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider block">ANALYTICS PANEL</span>
            <span className="text-xs font-semibold text-slate-900">Performance Metrics</span>
          </div>
          <TrendingUp className="size-4 text-slate-600" />
        </div>

        {/* Analytics KPI Row */}
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Today's Sales</span>
            <div className="text-base font-bold text-slate-950 mt-0.5">
              <CountUp value={revenue} prefix="₹" />
            </div>
          </div>
          <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Total Orders</span>
            <div className="text-base font-bold text-slate-950 mt-0.5">
              <CountUp value={orders} />
            </div>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="relative h-[80px] w-full mt-4">
          <svg viewBox="0 0 270 80" preserveAspectRatio="none" className="w-full h-full">
            <path
              d="M 10 70 L 60 50 L 110 60 L 160 30 L 210 20 L 260 15"
              fill="none"
              stroke="#0f9f90"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="260" cy="15" r="3" fill="#0f9f90" />
            <circle cx="260" cy="15" r="6" fill="#0f9f90" className="animate-ping opacity-25" />
          </svg>

          {/* Hover Tooltip display */}
          <div className="absolute top-0 right-10 bg-slate-950 text-white rounded px-1.5 py-0.5 text-[8px] font-semibold shadow-sm">
            Peak Hours (1-2 PM)
          </div>
        </div>

        {/* Donut Chart / popular item breakdown */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-500">
          <span>Top Item: Margherita Pizza (40%)</span>
          <span>Average Ticket: ₹465</span>
        </div>
      </div>
    </Laptop>
  );
}

// --- Row 5 Mockup: Customer Experience ---
function Row5Mockup() {
  const [stars, setStars] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(4.8);

  useEffect(() => {
    const timer = setInterval(() => {
      // 1. Reset
      setStars(0);
      setShowReview(false);
      setRating(4.8);

      // 2. Animate rating stars fill
      setTimeout(() => setStars(1), 800);
      setTimeout(() => setStars(2), 1100);
      setTimeout(() => setStars(3), 1400);
      setTimeout(() => setStars(4), 1700);
      setTimeout(() => setStars(5), 2000);

      // 3. Show review & update average
      setTimeout(() => {
        setShowReview(true);
        setRating(4.9);
      }, 2500);

    }, 8000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Phone>
      <div className="pt-6 pb-2 text-[10px] font-bold text-slate-400 flex justify-between items-center border-b border-slate-50 bg-white z-20 px-3">
        <span>Table 7 Feedback</span>
        <span className="text-emerald-500 font-semibold">{rating}★</span>
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-6 px-4">
        <div className="text-center space-y-1">
          <h6 className="text-xs font-bold text-slate-800">Rate Your Experience</h6>
          <p className="text-[9px] text-slate-400 font-medium">Bistro Royale appreciates your feedback</p>
        </div>

        {/* Stars container */}
        <div className="flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((index) => (
            <Star
              key={index}
              className={`size-6 transition-all duration-300 ${index <= stars
                ? "fill-yellow-400 text-yellow-400 scale-110"
                : "text-slate-200"
                }`}
            />
          ))}
        </div>

        {/* Testimonial card */}
        <div className="h-[90px] flex items-center justify-center">
          <AnimatePresence>
            {showReview && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-2 text-left"
              >
                <p className="text-[10px] font-medium leading-relaxed text-slate-700">
                  &quot;Food arrived in 11 minutes. Excellent service.&quot;
                </p>
                <div className="text-[9px] font-semibold text-slate-400">— Rahul Sharma</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="py-3 px-3">
        <button className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-colors">
          Submit Review
        </button>
      </div>
    </Phone>
  );
}

// --- Typewriter Component ---
function Typewriter({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const [displayText, setDisplayText] = useState("");
  const count = useMotionValue(0);

  useEffect(() => {
    if (!isInView) return;

    const controls = animate(count, text.length, {
      duration: Math.min(text.length * 0.015, 2.0), // Typing speed, max 2 seconds for long descriptions
      ease: "linear",
      onUpdate: (latest) => {
        setDisplayText(text.slice(0, Math.round(latest)));
      },
    });

    return () => controls.stop();
  }, [isInView, text, count]);

  return (
    <p ref={ref} className={className}>
      {displayText}
    </p>
  );
}

// --- Main Showcase Component ---
export default function ModernRestaurants() {
  const rows = [
    {
      id: "menu",
      headline: "Beautiful Digital Menus",
      description: "Customers simply scan a QR code to browse your menu, customize their order and place it instantly—without downloading an app.",
      badge: "No App Required",
      mockup: <Row1Mockup />,
      alignLeft: true
    },
    {
      id: "kitchen",
      headline: "Keep Your Kitchen in Sync",
      description: "Orders move directly from customer to kitchen, reducing mistakes and speeding up preparation.",
      badge: "Live Kitchen Updates",
      mockup: <Row2Mockup />,
      alignLeft: false
    },
    {
      id: "payments",
      headline: "Fast & Secure Payments",
      description: "Customers pay instantly using UPI, cards or digital wallets without waiting for the bill.",
      badge: "UPI • Cards • Wallets",
      mockup: <Row3Mockup />,
      alignLeft: true
    },
    {
      id: "analytics",
      headline: "Make Smarter Business Decisions",
      description: "Track revenue, best-selling dishes, customer behaviour and peak hours using real-time insights.",
      badge: "Live Insights",
      mockup: <Row4Mockup />,
      alignLeft: false
    },
    {
      id: "customer",
      headline: "Turn Great Service Into Loyal Customers",
      description: "Collect ratings and feedback automatically after every order and discover what your customers love.",
      badge: "Automatic Reviews",
      mockup: <Row5Mockup />,
      alignLeft: true
    }
  ];

  return (
    <section className="select-none overflow-hidden border-t border-[#D8DEE8]/60">

      {/* Section Header */}
      <div className="bg-[#FFFFFF] pt-24 pb-12">
        <div className="max-w-4xl px-4 text-center mx-auto">
          <span className="text-xs font-bold text-[#0f9f90] bg-[#0f9f90]/10 border border-[#0f9f90]/25 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
            BUILT FOR MODERN RESTAURANTS
          </span>
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl mt-4">
            Everything working in one seamless platform
          </h2>
          <Typewriter
            text="From digital menus to kitchen operations, payments and analytics—everything works together in one seamless platform."
            className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed font-normal text-slate-500 sm:text-base min-h-[40px]"
          />
        </div>
      </div>

      {/* alternating showcase grid */}
      <div>
        {rows.map((row, idx) => {
          const isEven = idx % 2 === 1;
          const bgClass = isEven ? "bg-[#F3f4f6]" : "bg-[#FFFFFF]";
          const isLaptop = row.id === "kitchen" || row.id === "analytics";

          // Subtle layout offset: Phones shifted up (-16px), Laptops shifted down (+16px)
          const offsetClass = isLaptop ? "translate-y-[16px]" : "translate-y-[-16px]";

          return (
            <div key={row.id} className={`${bgClass} py-24 md:py-32 border-b border-slate-100/50 last:border-b-0`}>
              <motion.div
                initial={{ opacity: 0.9, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-[92%] max-w-6xl mx-auto"
              >
                <div className={`flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-24 ${row.alignLeft ? "" : "lg:flex-row-reverse"
                  }`}>
                  {/* Text Side (width limited to max-w-md for comfortable reading) */}
                  <div className="flex-1 space-y-4 max-w-md">
                    <span className="text-[10px] font-bold text-[#0f9f90] bg-[#0f9f90]/10 px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
                      {row.badge}
                    </span>
                    <h3 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
                      {row.headline}
                    </h3>
                    <Typewriter
                      text={row.description}
                      className="text-slate-500 text-sm leading-relaxed font-normal min-h-[48px]"
                    />
                  </div>

                  {/* Mockup Side */}
                  <div className="flex-1 flex items-center justify-center w-full">
                    <div className={`w-full flex justify-center transition-transform duration-500 ${offsetClass}`}>
                      {row.mockup}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
