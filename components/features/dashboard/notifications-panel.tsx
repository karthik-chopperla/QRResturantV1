"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markNotificationRead, clearAllNotifications, deleteNotification } from "@/actions/notifications";
import {
  Bell,
  CheckCheck,
  X,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Receipt,
  Volume2,
  VolumeX
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { unlockAudio, playDoorbell } from "@/lib/sound";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
};

const colorMap: Record<
  string,
  {
    border: string;
    iconText: string;
    iconBg: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    tintBg: string;
  }
> = {
  blue: {
    border: "bg-blue-500",
    iconText: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-950/50",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeText: "text-blue-700 dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-800",
    tintBg: "bg-blue-500/[0.05] dark:bg-blue-500/[0.08]",
  },
  emerald: {
    border: "bg-emerald-500",
    iconText: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/50",
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    badgeBorder: "border-emerald-200 dark:border-emerald-800",
    tintBg: "bg-emerald-500/[0.05] dark:bg-emerald-500/[0.08]",
  },
  green: {
    border: "bg-green-500",
    iconText: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-50 dark:bg-green-950/50",
    badgeBg: "bg-green-50 dark:bg-green-950/40",
    badgeText: "text-green-700 dark:text-green-300",
    badgeBorder: "border-green-200 dark:border-green-800",
    tintBg: "bg-green-500/[0.05] dark:bg-green-500/[0.08]",
  },
  red: {
    border: "bg-red-500",
    iconText: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-50 dark:bg-red-950/50",
    badgeBg: "bg-red-50 dark:bg-red-950/40",
    badgeText: "text-red-700 dark:text-red-300",
    badgeBorder: "border-red-200 dark:border-red-800",
    tintBg: "bg-red-500/[0.05] dark:bg-red-500/[0.08]",
  },
  orange: {
    border: "bg-orange-500",
    iconText: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-50 dark:bg-orange-950/50",
    badgeBg: "bg-orange-50 dark:bg-orange-950/40",
    badgeText: "text-orange-700 dark:text-orange-300",
    badgeBorder: "border-orange-200 dark:border-orange-800",
    tintBg: "bg-orange-500/[0.05] dark:bg-orange-500/[0.08]",
  },
  purple: {
    border: "bg-purple-500",
    iconText: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-50 dark:bg-purple-950/50",
    badgeBg: "bg-purple-50 dark:bg-purple-950/40",
    badgeText: "text-purple-700 dark:text-purple-300",
    badgeBorder: "border-purple-200 dark:border-purple-800",
    tintBg: "bg-purple-500/[0.05] dark:bg-purple-500/[0.08]",
  },
  cyan: {
    border: "bg-cyan-500",
    iconText: "text-cyan-600 dark:text-cyan-400",
    iconBg: "bg-cyan-50 dark:bg-cyan-950/50",
    badgeBg: "bg-cyan-50 dark:bg-cyan-950/40",
    badgeText: "text-cyan-700 dark:text-cyan-300",
    badgeBorder: "border-cyan-200 dark:border-cyan-800",
    tintBg: "bg-cyan-500/[0.05] dark:bg-cyan-500/[0.08]",
  },
  amber: {
    border: "bg-amber-500",
    iconText: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-amber-950/50",
    badgeBg: "bg-amber-50 dark:bg-amber-950/40",
    badgeText: "text-amber-700 dark:text-amber-300",
    badgeBorder: "border-amber-200 dark:border-amber-800",
    tintBg: "bg-amber-500/[0.05] dark:bg-amber-500/[0.08]",
  },
};

function parseNotification(n: Notification) {
  const titleLower = n.title.toLowerCase();
  const msgLower = n.message.toLowerCase();

  let tableNumber = "";
  const tableMatch = n.title.match(/Table\s+(\w+)/i) || n.message.match(/Table\s+(\w+)/i);
  if (tableMatch) {
    tableNumber = tableMatch[1];
  }

  let typeLabel = "";
  let icon = Bell;
  let colorClass = "blue";

  if (n.type === "NEW_ORDER" || titleLower.includes("new order")) {
    typeLabel = "New Order";
    icon = ShoppingBag;
    colorClass = "blue";
  } else if (titleLower.includes("ready") || msgLower.includes("ready") || n.type === "KITCHEN_READY") {
    typeLabel = "Order Ready";
    icon = CheckCircle2;
    colorClass = "green";
  } else if (titleLower.includes("cancel") || msgLower.includes("cancelled")) {
    typeLabel = "Order Cancelled";
    icon = AlertCircle;
    colorClass = "orange";
  } else if (titleLower.includes("refund") || msgLower.includes("refund")) {
    typeLabel = "Refund";
    icon = RefreshCw;
    colorClass = "purple";
  } else if (n.type === "PAYMENT" || titleLower.includes("payment")) {
    if (titleLower.includes("failed") || msgLower.includes("failed") || titleLower.includes("fail") || msgLower.includes("fail")) {
      typeLabel = "Payment Failed";
      icon = CreditCard;
      colorClass = "red";
    } else {
      typeLabel = "Payment Received";
      icon = CreditCard;
      colorClass = "emerald";
    }
  } else if (n.type === "CALL_WAITER" || titleLower.includes("waiter")) {
    typeLabel = "Waiter Requested";
    icon = Bell;
    colorClass = "cyan";
  } else if (n.type === "REQUEST_BILL" || titleLower.includes("bill")) {
    typeLabel = "Bill Requested";
    icon = Receipt;
    colorClass = "amber";
  } else {
    typeLabel = n.title;
    icon = Bell;
    colorClass = "blue";
  }

  const displayTitle = tableNumber ? `${typeLabel} • Table ${tableNumber}` : typeLabel;

  return {
    displayTitle,
    description: n.message,
    icon,
    colorClass,
    tableNumber,
    typeLabel,
  };
}

function getRelativeTime(date: Date | string | number, tick?: number): string {
  if (tick) {
    // Dummy condition to prevent typescript/eslint warning for unused variable
  }
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

function formatAbsoluteTimestamp(date: Date | string | number): string {
  const d = new Date(date);
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? "0" + minutes : minutes;

  return `${day} ${month} ${year} • ${hours}:${minutesStr} ${ampm}`;
}

export function NotificationsPanel({ notifications }: { notifications: Notification[] }) {
  const queryClient = useQueryClient();
  const [clearing, setClearing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [timeTick, setTimeTick] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevCount = useRef(notifications.length);

  const handleToggleSound = useCallback(async () => {
    if (!soundEnabled) await unlockAudio();
    setSoundEnabled((prev) => !prev);
  }, [soundEnabled]);

  useEffect(() => {
    if (soundEnabled && notifications.length > prevCount.current && prevCount.current > 0) {
      playDoorbell();
    }
    prevCount.current = notifications.length;
  }, [notifications.length, soundEnabled]);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setTimeTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRead = async (ids: string[]) => {
    try {
      await unlockAudio();
      const result = await markNotificationRead(ids);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Failed to mark notification as read.");
    }
  };

  const handleDelete = async (ids: string[]) => {
    try {
      const result = await deleteNotification(ids);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Notification dismissed.");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Failed to dismiss notification.");
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const result = await clearAllNotifications();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("All notifications cleared.");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Failed to clear notifications.");
    } finally {
      setClearing(false);
    }
  };

  const groupNotifications = (list: Notification[]) => {
    const groups: Record<
      string,
      {
        key: string;
        type: string;
        title: string;
        message: string;
        createdAt: Date;
        isRead: boolean;
        ids: string[];
        notifications: Notification[];
      }
    > = {};

    list.forEach((n) => {
      const parsed = parseNotification(n);
      const timeKey = new Date(n.createdAt).setSeconds(0, 0);
      const key = `${parsed.typeLabel}-${parsed.tableNumber}-${timeKey}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          type: n.type,
          title: parsed.displayTitle,
          message: n.message,
          createdAt: new Date(n.createdAt),
          isRead: n.isRead,
          ids: [n.id],
          notifications: [n],
        };
      } else {
        groups[key].ids.push(n.id);
        groups[key].notifications.push(n);
        if (!n.isRead) {
          groups[key].isRead = false;
        }
      }
    });

    return Object.values(groups).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  const grouped = groupNotifications(notifications);

  return (
    <Card className="border-border/60 flex flex-col justify-start h-full overflow-hidden bg-card shadow-sm">
      <CardHeader className="sticky top-0 z-10 bg-card border-b border-border/40 px-6 flex-shrink-0 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bell className="size-4 text-foreground/80" />
          Notifications
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            onClick={handleToggleSound}
            title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted transition-all rounded-md"
              onClick={handleClearAll}
              disabled={clearing}
            >
              <CheckCheck className="size-3.5" />
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-6 space-y-4 pr-3 custom-scrollbar">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex items-center justify-center size-12 rounded-full bg-muted/40 mb-3">
              <Bell className="size-6 text-muted-foreground/60 animate-pulse" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No notifications yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
              We&apos;ll notify you when something happens.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {grouped.map((n) => {
                const parsed = parseNotification(n.notifications[0]);
                const colors = colorMap[parsed.colorClass] || colorMap.blue;
                const Icon = parsed.icon;

                return (
                  <motion.div
                    key={n.key}
                    layoutId={n.key}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      x: -30,
                      height: 0,
                      marginBottom: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                      borderWidth: 0,
                      transition: {
                        height: { duration: 0.2 },
                        opacity: { duration: 0.15 },
                        x: { duration: 0.2 },
                      },
                    }}
                    style={{ overflow: "hidden" }}
                    className="w-full"
                  >
                    <div
                      onClick={() => !n.isRead && handleRead(n.ids)}
                      className={`group relative w-full rounded-2xl border text-left flex items-start p-4 transition-all duration-200 cursor-pointer select-none ${n.isRead
                        ? "bg-card border-border/60 hover:shadow-md hover:-translate-y-[2px]"
                        : `${colors.tintBg} ${colors.badgeBorder} border hover:shadow-md hover:-translate-y-[2px]`
                      }`}
                    >
                      {/* Colored vertical accent bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-[4px] rounded-l-2xl ${colors.border}`} />

                      {/* Circular status icon */}
                      <div className={`flex-shrink-0 flex items-center justify-center size-10 rounded-full ${colors.iconBg} ml-1`}>
                        <Icon className={`size-5 ${colors.iconText}`} />
                      </div>

                      {/* Center Content */}
                      <div className="flex-1 min-w-0 ml-3 pr-4">
                        <p className={`text-sm text-foreground leading-tight ${n.isRead ? "font-medium" : "font-bold"}`}>
                          {n.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground leading-normal">
                          {n.ids.length > 1 ? `${n.ids.length} similar notifications` : parsed.description}
                        </p>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {formatAbsoluteTimestamp(n.createdAt)}
                        </p>
                      </div>

                      {/* Right Side */}
                      <div className="flex-shrink-0 flex flex-col items-end justify-between self-stretch pl-1 min-w-[75px]">
                        {/* NEW badge */}
                        {!n.isRead ? (
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider border ${colors.badgeBg} ${colors.badgeText} ${colors.badgeBorder}`}>
                            NEW
                          </span>
                        ) : (
                          <div className="h-4" />
                        )}
                        {/* Relative time */}
                        <span className="text-[11px] text-muted-foreground font-medium mt-auto">
                          {mounted ? getRelativeTime(n.createdAt, timeTick) : ""}
                        </span>
                      </div>

                      {/* Small X button: dark cross with a white circular background */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(n.ids);
                        }}
                        className="absolute top-3 right-3 flex items-center justify-center size-6 rounded-full bg-white dark:bg-zinc-800 shadow-sm border border-border/40 text-zinc-950 dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-700 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-200 active:scale-95 cursor-pointer"
                        aria-label="Dismiss notification"
                      >
                        <X className="size-3 text-zinc-950 dark:text-zinc-50" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
