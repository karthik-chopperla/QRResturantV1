"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, animate } from "framer-motion";
import {
  Bell,
  ChefHat,
  CreditCard,
  QrCode,
  ShoppingCart,
  Star,
  Search,
  ArrowUp,
  ArrowDown,
  Clock,
  Sparkles,
  User,
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

export default function DashboardShowcase() {
  const [tick, setTick] = useState(0);
  const [hasTriggered, setHasTriggered] = useState(false);

  // Auto-operating simulator tick loop
  useEffect(() => {
    if (hasTriggered) {
      const timer = setInterval(() => {
        setTick((prev) => (prev + 1) % 4);
      }, 8000);
      return () => clearInterval(timer);
    }
  }, [hasTriggered]);

  // State calculations based on current tick
  const getMetrics = () => {
    switch (tick) {
      case 1: return { revenue: 48530, orders: 187, activeTables: "22 / 30", notifications: 4 };
      case 2: return { revenue: 48810, orders: 188, activeTables: "21 / 30", notifications: 5 };
      case 3: return { revenue: 49160, orders: 189, activeTables: "22 / 30", notifications: 6 };
      default: return { revenue: 48250, orders: 186, activeTables: "21 / 30", notifications: 3 };
    }
  };

  const getOrders = () => {
    switch (tick) {
      case 1:
        return [
          { id: "107", table: "Table 2", items: "1x Club Sandwich, 1x Cold Coffee", status: "Preparing", time: "10 min" },
          { id: "104", table: "Table 5", items: "2x Margherita Pizza, 1x Coke", status: "Preparing", time: "8 min" },
          { id: "105", table: "Table 3", items: "1x Pasta Alfredo, 1x Sprite", status: "Ready" }
        ];
      case 2:
        return [
          { id: "107", table: "Table 2", items: "1x Club Sandwich, 1x Cold Coffee", status: "Preparing", time: "8 min" },
          { id: "104", table: "Table 5", items: "2x Margherita Pizza, 1x Coke", status: "Ready" },
          { id: "105", table: "Table 3", items: "1x Pasta Alfredo, 1x Sprite", status: "Ready" }
        ];
      case 3:
        return [
          { id: "107", table: "Table 2", items: "1x Club Sandwich, 1x Cold Coffee", status: "Preparing", time: "6 min" },
          { id: "104", table: "Table 5", items: "2x Margherita Pizza, 1x Coke", status: "Completed" }
        ];
      default:
        return [
          { id: "104", table: "Table 5", items: "2x Margherita Pizza, 1x Coke", status: "Preparing", time: "8 min" },
          { id: "105", table: "Table 3", items: "1x Pasta Alfredo, 1x Sprite", status: "Ready" },
          { id: "106", table: "Table 7", items: "1x Veg Burger, 1x Fries", status: "Completed" }
        ];
    }
  };

  const getKitchenQueue = () => {
    switch (tick) {
      case 1:
        return [
          { id: "kp", name: "Margherita Pizza", progress: 75, time: "2 mins", status: "Preparing" },
          { id: "cs", name: "Club Sandwich", progress: 20, time: "6 mins", status: "Preparing" },
          { id: "pa", name: "Pasta Alfredo", progress: 100, time: "Ready", status: "Ready" }
        ];
      case 2:
        return [
          { id: "kp", name: "Margherita Pizza", progress: 100, time: "Ready", status: "Ready" },
          { id: "cs", name: "Club Sandwich", progress: 40, time: "5 mins", status: "Preparing" }
        ];
      case 3:
        return [
          { id: "cs", name: "Club Sandwich", progress: 60, time: "3 mins", status: "Preparing" }
        ];
      default:
        return [
          { id: "kp", name: "Margherita Pizza", progress: 60, time: "3 mins", status: "Preparing" },
          { id: "pa", name: "Pasta Alfredo", progress: 100, time: "Ready", status: "Ready" }
        ];
    }
  };

  const getTables = () => {
    const base = [
      { id: "T1", status: "Occupied" },
      { id: "T2", status: "Available" },
      { id: "T3", status: "Waiting Payment" },
      { id: "T4", status: "Preparing" },
      { id: "T5", status: "Reserved" },
      { id: "T6", status: "Available" }
    ];
    if (tick === 1) {
      base[1].status = "Preparing";
    } else if (tick === 2) {
      base[1].status = "Preparing";
      base[2].status = "Available";
    } else if (tick === 3) {
      base[1].status = "Preparing";
      base[2].status = "Available";
      base[4].status = "Occupied";
    }
    return base;
  };

  const metrics = getMetrics();
  const orders = getOrders();
  const kitchenItems = getKitchenQueue();
  const tables = getTables();

  // Dynamic SVG path for revenue chart
  const satY = 30 - ((metrics.revenue - 48250) / 10);
  const pathD = `M 10 90 L 60 70 L 110 80 L 160 50 L 210 40 L 260 ${satY}`;
  const fillD = `${pathD} L 260 110 L 10 110 Z`;

  return (
    <motion.section
      onViewportEnter={() => {
        if (!hasTriggered) {
          setHasTriggered(true);
        }
      }}
      viewport={{ once: true, amount: 0.1 }}
      className="relative w-full overflow-hidden bg-[#F8FAFC] py-24 select-none border-t border-[#D8DEE8]/60"
    >
      {/* Header Container */}
      <div className="relative z-10 mb-12 max-w-4xl px-4 text-center mx-auto">
        <h2 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Everything You Need.
          <br />
          One Dashboard.
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed font-normal text-slate-500 sm:text-base">
          Monitor orders, tables, payments, kitchen activity and revenue in real time—all from a single dashboard.
        </p>
      </div>

      {/* Main Dashboard Panel Showcase */}
      <div className="w-[92%] max-w-7xl mx-auto rounded-[24px] border border-[#D8DEE8] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03),0_12px_36px_rgba(15,23,42,0.08),0_32px_64px_rgba(15,23,42,0.04)] overflow-hidden">
        
        {/* Top Navbar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-lg">
              <Sparkles className="size-5 text-[#0f9f90]" />
              QRFast
            </div>
            <span className="h-4 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
              </span>
              LIVE HUB
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 w-1/3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search orders, tables, dishes..." 
                disabled
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
              <Bell className="size-4" />
              <motion.span 
                key={metrics.notifications}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-1 right-1 size-4 bg-[#0f9f90] text-[9px] font-bold text-white rounded-full flex items-center justify-center"
              >
                {metrics.notifications}
              </motion.span>
            </div>
            <span className="h-6 w-[1px] bg-slate-100" />
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center font-bold text-xs text-slate-700">
                RS
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-slate-700">Rahul Sharma</span>
            </div>
          </div>
        </div>

        {/* Top KPI Row */}
        <div className="flex overflow-x-auto lg:grid lg:grid-cols-5 gap-4 p-6 border-b border-slate-100 snap-x snap-mandatory scrollbar-none">
          {/* Card 1 */}
          <div className="min-w-[200px] flex-1 snap-start bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Today's Revenue</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {hasTriggered ? <CountUp value={metrics.revenue} prefix="₹" /> : "₹48,250"}
              </span>
              <span className="text-[11px] font-semibold text-[#10b981] flex items-center gap-0.5">
                <ArrowUp className="size-3" /> +12%
              </span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="min-w-[200px] flex-1 snap-start bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Orders Today</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {hasTriggered ? <CountUp value={metrics.orders} /> : "186"}
              </span>
              <span className="text-[11px] font-semibold text-[#10b981] flex items-center gap-0.5">
                <ArrowUp className="size-3" /> +18
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="min-w-[200px] flex-1 snap-start bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Active Tables</span>
            <div className="mt-2">
              <span className="text-2xl font-bold text-slate-900">{metrics.activeTables}</span>
              <span className="text-[10px] text-slate-400 ml-1.5">Dine-in floor</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="min-w-[200px] flex-1 snap-start bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Avg Wait Time</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">8 min</span>
              <span className="text-[11px] font-semibold text-[#ef4444] flex items-center gap-0.5">
                <ArrowDown className="size-3" /> -2 min
              </span>
            </div>
          </div>

          {/* Card 5 */}
          <div className="min-w-[200px] flex-1 snap-start bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Customer Rating</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">4.9</span>
              <span className="text-amber-400 text-lg">★</span>
              <span className="text-[10px] text-slate-400 ml-1">94 reviews</span>
            </div>
          </div>
        </div>

        {/* Dashboard Main Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 bg-slate-50/50">
          
          {/* Left Column: Live Orders */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-[#D8DEE8] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Live Orders</h3>
                  <p className="text-xs text-slate-400">Manage ongoing customer requests</p>
                </div>
                <div className="text-xs font-semibold text-[#0f9f90] bg-[#0f9f90]/10 px-2.5 py-1 rounded-full">
                  {orders.length} Active
                </div>
              </div>

              {/* Live Order List */}
              <div className="space-y-4 min-h-[300px]">
                <AnimatePresence mode="popLayout">
                  {orders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.5 }}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-100 hover:border-slate-200/80 rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-300"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-900">Order #{order.id}</span>
                          <span className="text-xs font-semibold text-slate-400">•</span>
                          <span className="text-xs font-medium text-slate-500">{order.table}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800">{order.items}</p>
                      </div>

                      <div className="flex items-center gap-3 mt-3 sm:mt-0">
                        {order.status === "Preparing" && (
                          <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-medium">
                            <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
                            Preparing ({order.time})
                          </div>
                        )}
                        {order.status === "Ready" && (
                          <div className="flex items-center gap-3">
                            <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-[#10b981]" />
                              Ready
                            </div>
                            <button className="text-xs font-semibold text-[#0f9f90] border border-[#0f9f90]/20 bg-[#0f9f90]/5 hover:bg-[#0f9f90]/10 px-3 py-1.5 rounded-lg transition-colors">
                              Notify Waiter
                            </button>
                          </div>
                        )}
                        {order.status === "Completed" && (
                          <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-slate-400" />
                            Completed
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right Column: Kitchen Queue */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-[#D8DEE8] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.02)] h-full">
              <div className="mb-6">
                <h3 className="text-base font-semibold text-slate-900">Kitchen Queue</h3>
                <p className="text-xs text-slate-400">Current preparation queues</p>
              </div>

              <div className="space-y-5 min-h-[300px]">
                <AnimatePresence mode="popLayout">
                  {kitchenItems.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.5 }}
                      className="space-y-2 border-b border-slate-50 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        <span className="font-medium text-slate-400">{item.time}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-amber-400 to-[#10b981]"
                            animate={{ width: `${item.progress}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md ${
                          item.status === "Ready" 
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                            : "bg-amber-50 text-amber-600 border border-amber-100"
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-6 bg-slate-50/50 border-t border-slate-100">
          
          {/* Bottom Left: Revenue Trend */}
          <div className="bg-white rounded-2xl border border-[#D8DEE8] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.02)] group">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Revenue Trend</h3>
                <p className="text-[10px] text-slate-400">Weekly performance metrics</p>
              </div>
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">Sat</span>
            </div>

            {/* SVG Line Chart with Draw Animation & Hover Tooltip */}
            <div className="relative h-[120px] w-full mt-6">
              <svg viewBox="0 0 270 110" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="revenue-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f9f90" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#0f9f90" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Horizontal helper lines */}
                <line x1="10" y1="30" x2="260" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="10" y1="60" x2="260" y2="60" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="10" y1="90" x2="260" y2="90" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="2 2" />

                {/* Shaded Area */}
                <motion.path
                  d={fillD}
                  fill="url(#revenue-grad)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.2, delay: 0.5 }}
                />

                {/* Line Path */}
                <motion.path
                  d={pathD}
                  fill="none"
                  stroke="#0f9f90"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                />

                {/* Saturday dot with pulse */}
                <circle cx="260" cy={satY} r="3" fill="#0f9f90" />
                <circle cx="260" cy={satY} r="7" fill="#0f9f90" className="animate-ping opacity-25" />
              </svg>

              {/* Tooltip Overlay */}
              <div className="absolute top-1 right-8 bg-slate-900 text-white rounded-lg px-2.5 py-1 text-[10px] font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="font-semibold">Sat: ₹{metrics.revenue.toLocaleString()}</div>
                <div className="text-slate-400">Revenue (+12%)</div>
              </div>
            </div>

            <div className="flex justify-between text-[9px] font-bold text-slate-400 mt-4 px-2">
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>
          </div>

          {/* Bottom Center: Popular Dishes */}
          <div className="bg-white rounded-2xl border border-[#D8DEE8] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-900">Popular Dishes</h3>
              <p className="text-[10px] text-slate-400">Most ordered items today</p>
            </div>

            <div className="space-y-4">
              {/* Dish 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <span>🍕</span>
                    <span>Margherita Pizza</span>
                  </div>
                  <span className="font-bold text-slate-900">42 Orders</span>
                </div>
                <div className="h-1.5 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-slate-700 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: "84%" }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Dish 2 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <span>🍔</span>
                    <span>Classic Burger</span>
                  </div>
                  <span className="font-bold text-slate-900">31 Orders</span>
                </div>
                <div className="h-1.5 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-slate-700 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: "62%" }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Dish 3 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <span>🥤</span>
                    <span>Cold Coffee</span>
                  </div>
                  <span className="font-bold text-slate-900">28 Orders</span>
                </div>
                <div className="h-1.5 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-slate-700 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: "56%" }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Right: Live Tables floor */}
          <div className="bg-white rounded-2xl border border-[#D8DEE8] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-900">Live Tables</h3>
              <p className="text-[10px] text-slate-400">Current layout statuses</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {tables.map((table) => (
                <div 
                  key={table.id}
                  className="flex flex-col items-center justify-center p-3 border border-slate-100 hover:border-slate-200/80 rounded-xl transition-all duration-300"
                >
                  <span className="text-xs font-bold text-slate-800">{table.id}</span>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className={`size-1.5 rounded-full ${
                      table.status === "Available" ? "bg-emerald-500" :
                      table.status === "Preparing" ? "bg-amber-500" :
                      table.status === "Waiting Payment" ? "bg-yellow-500" :
                      table.status === "Occupied" ? "bg-rose-500" : "bg-slate-400"
                    }`} />
                    <span className="text-[9px] font-semibold text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-[54px]">
                      {table.status.split(" ")[0]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
